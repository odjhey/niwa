#!/bin/zsh
# Lane watchdog — supervises external seat lanes and nudges an idle watchtower.
# Durable home: .agents/skills/watchtower-loop/lane-watchdog.sh. macOS/zsh:
# uses `stat -f %m`, `lsof`, `pgrep`; ADAPT `stat` for GNU coreutils
# (`stat -c %Y`).
#
# Arm it as a persistent Monitor (or equivalent harness watch) whose stdout
# lines become notifications:
#   Monitor: command=<this file>, persistent=true
#
# Sensors (every 60s; each alert once per process incarnation and suspect
# episode; all session-attributed):
#   1. codex lanes: any `codex exec` process alive >15min with <2s CPU AND
#      whose OWN open rollout file (found via lsof, per-lane) is missing or
#      silent >15min is a startup hang claim. Per-process CPU alone
#      false-positives on healthy network-bound lanes; global rollout mtime
#      masks a stalled sibling. Both signals, per-lane, or no flag.
#   2. alt-seat lanes: CLAUDE_CONFIG_DIR seats buffer stdout, so liveness is
#      each process's own open session transcript under WD_ALT_HOME. A process
#      with no attributable transcript is non-conclusive.
#   3. agy lanes: Antigravity print-mode lanes (`agy ... -p/--print`).
#      Liveness is each process's own open conversation database or wal under
#      ~/.gemini/antigravity-cli/conversations/. An attributable database missing
#      after startup threshold (>60s) or silent >15min (>900s) is a stall claim.
#   4. heartbeat: only when THIS session's transcript is >=30min old.
#
# Config (env, all optional):
#   WD_TRANSCRIPT            this session's transcript (default: newest jsonl in
#                            ~/.claude/projects/<cwd-slug>/)
#   WD_ALT_HOME              alt-seat CLAUDE_CONFIG_DIR (default ~/.claude-alt; ADAPT)
#   WD_CODEX_SECS=900        WD_ALT_SECS=1200  WD_IDLE_SECS=1800
#   WD_AGY_STARTUP_SECS=60   WD_AGY_SECS=900
# Testability seams (production defaults preserve the persistent monitor):
#   WD_MAX_ITERATIONS=0 (unbounded)  WD_STATE_DIR=${TMPDIR:-/tmp}
#   WD_SAMPLE_SECS=60

# Signed 64-bit bounds as digit strings. An mtime is range-checked against
# these lexically, before any arithmetic: zsh cannot evaluate a magnitude past
# INT64_MAX without truncating and complaining on stderr, and INT64_MIN's own
# magnitude (9223372036854775808) is exactly such a value.
EPOCH_MAX_MAGNITUDE='9223372036854775807'
EPOCH_MIN_MAGNITUDE='9223372036854775808'
# Integer-typed so zsh reads their stored numeric value in arithmetic instead
# of re-parsing the text — re-parsing "-9223372036854775808" as a literal is
# the same magnitude trap.
typeset -i EPOCH_INT64_MAX PARSED_EPOCH cand_mtime best_mtime
typeset -i transcript_mtime idle_age
(( EPOCH_INT64_MAX = 10#$EPOCH_MAX_MAGNITUDE ))

# Validate one `stat -f %m` reading and set PARSED_EPOCH. Accepts a whole
# base-10 integer carrying at most one leading + or -, with any number of
# leading zeros, whose normalized value fits the signed 64-bit range
# -9223372036854775808..9223372036854775807. Everything else — whitespace,
# fractions, exponents, hex, lone or repeated signs, and values one beyond
# either bound — is non-conclusive: return 1 with no output, and the caller
# skips that reading.
parse_epoch_seconds() {
  local raw=$1 sign='' digits limit
  [[ "$raw" == (|[-+])<-> ]] || return 1
  [[ "$raw" == -* ]] && sign='-'
  digits=${raw#[-+]}
  # Normalize away leading zeros so the range check compares magnitudes.
  while (( ${#digits} > 1 )) && [[ "$digits" == 0* ]]; do
    digits=${digits#0}
  done
  if [[ -n "$sign" ]]; then
    limit=$EPOCH_MIN_MAGNITUDE
  else
    limit=$EPOCH_MAX_MAGNITUDE
  fi
  (( ${#digits} > ${#limit} )) && return 1
  # Equal-width decimal strings compare numerically byte-lexicographically.
  if (( ${#digits} == ${#limit} )) && [[ "$digits" > "$limit" ]]; then
    return 1
  fi
  # One base-10 conversion of the normalized signed token. `10#` keeps leading
  # zeros decimal and carries the sign inline, so INT64_MIN is converted
  # directly and its positive magnitude is never constructed.
  (( PARSED_EPOCH = 10#${sign}${digits} ))
  return 0
}

if (( ${+WD_TRANSCRIPT} )); then
  TRANSCRIPT=$WD_TRANSCRIPT
else
  TRANSCRIPT=''
  slug=$(pwd | tr '/' '-')
  candidates=( ~/.claude/projects/"$slug"/*.jsonl(N) )
  # No numeric sentinel: epoch mtimes may be negative (pre-1970), so "have we
  # seen a valid candidate yet" is tracked explicitly.
  have_best=0
  best_mtime=0
  for candidate in "${candidates[@]}"; do
    cand_text=$(stat -f %m "$candidate" 2>/dev/null)
    stat_status=$?
    if (( stat_status != 0 )) || ! parse_epoch_seconds "$cand_text"; then
      continue
    fi
    (( cand_mtime = PARSED_EPOCH ))
    if (( ! have_best )) || (( cand_mtime > best_mtime )); then
      have_best=1
      (( best_mtime = cand_mtime ))
      TRANSCRIPT=$candidate
    elif (( cand_mtime == best_mtime )) && [[ "$candidate" < "$TRANSCRIPT" ]]; then
      TRANSCRIPT=$candidate
    fi
  done
fi
ALT_HOME=${WD_ALT_HOME:-$HOME/.claude-alt}
CODEX_SECS=${WD_CODEX_SECS:-900}
ALT_SECS=${WD_ALT_SECS:-1200}
IDLE_SECS=${WD_IDLE_SECS:-1800}
AGY_STARTUP_SECS=${WD_AGY_STARTUP_SECS:-60}
AGY_SECS=${WD_AGY_SECS:-900}
MAX_ITERATIONS=${WD_MAX_ITERATIONS:-0}
STATE_DIR=${WD_STATE_DIR:-${TMPDIR:-/tmp}}
SAMPLE_SECS=${WD_SAMPLE_SECS:-60}
SENSOR_LOCK_FILE="$STATE_DIR/.wd-sensors.lock"
iteration=0

zmodload zsh/system || {
  print -u2 -r -- "lane-watchdog: zsh/system is required for sensor locking"
  exit 1
}
zsystem supports flock || {
  print -u2 -r -- "lane-watchdog: zsystem flock is not supported"
  exit 1
}
: >> "$SENSOR_LOCK_FILE" || {
  print -u2 -r -- "lane-watchdog: cannot create sensor lock $SENSOR_LOCK_FILE"
  exit 1
}

# macOS ps emits elapsed and CPU time as mm:ss, hh:mm:ss, or dd-hh:mm:ss;
# CPU seconds can include a fractional suffix (for example, 0:00.01).
parse_process_time() {
  local value=$1 days=0 has_days=0 hours=0 minutes
  local whole_seconds fraction seconds_value total index
  local hour_value minute_value second_value
  local -a fields

  # ps right-aligns fields; accept surrounding whitespace but reject embedded
  # whitespace because it is not part of any supported shape.
  while [[ "$value" == [[:space:]]* ]]; do value=${value#?}; done
  while [[ "$value" == *[[:space:]] ]]; do value=${value%?}; done
  [[ -n "$value" && "$value" != *[[:space:]]* ]] || return 1

  if [[ "$value" == *-* ]]; then
    days=${value%%-*}
    value=${value#*-}
    has_days=1
    [[ "$days" == <-> && "$value" != *-* ]] || return 1
  fi
  fields=("${(@s/:/)value}")
  if (( has_days )); then
    (( ${#fields} == 3 )) || return 1
  else
    (( ${#fields} == 2 || ${#fields} == 3 )) || return 1
  fi
  for (( index = 1; index < ${#fields}; index++ )); do
    [[ "${fields[$index]}" == <-> ]] || return 1
  done

  whole_seconds=${fields[-1]%%.*}
  [[ "$whole_seconds" == <-> ]] || return 1
  if [[ "${fields[-1]}" == *.* ]]; then
    fraction=${fields[-1]#*.}
    [[ "$fraction" == <-> ]] || return 1
  fi

  if (( ${#fields} == 2 )); then
    minutes=${fields[1]}
  else
    hours=${fields[1]}
    minutes=${fields[2]}
  fi
  hour_value=$(( 10#$hours ))
  minute_value=$(( 10#$minutes ))
  second_value=$(( 10#$whole_seconds ))
  (( minute_value <= 59 && second_value <= 59 )) || return 1
  (( ${#fields} == 2 || hour_value <= 23 )) || return 1

  seconds_value=$second_value
  [[ -n "$fraction" ]] && seconds_value=$(( second_value + 0.$fraction ))
  total=$(( 10#$days * 86400 + hour_value * 3600 + minute_value * 60 + seconds_value ))
  print -r -- "$total"
}

# Set OWN_PATH and OWN_MTIME to the newest open file owned by pid that matches
# the requested sensor. lsof's field output preserves whitespace in paths.
find_newest_own_file() {
  local pid=$1 sensor=$2 line file_path mtime lsof_output lsof_status stat_status
  local newest=0
  OWN_PATH=''
  OWN_MTIME=''
  OWN_LOOKUP_OK=0
  OWN_STAT_OK=1

  lsof_output=$(lsof -Fn -p "$pid" 2>/dev/null)
  lsof_status=$?
  if (( lsof_status == 0 )); then
    OWN_LOOKUP_OK=1
    while IFS= read -r line; do
      [[ "$line" == n* ]] || continue
      file_path=${line#n}
      case "$sensor" in
        codex) [[ "$file_path" == *sessions*rollout*.jsonl ]] || continue ;;
        alt) [[ "$file_path" == "$ALT_HOME"/projects/*/*.jsonl ]] || continue ;;
        agy)
          [[ "$file_path" != *.db-shm ]] || continue
          [[ "$file_path" != *conversation_summaries.db* ]] || continue
          [[ "$file_path" != *log* ]] || continue
          [[ "$file_path" != *stdout* ]] || continue
          [[ "$file_path" != *stderr* ]] || continue
          [[ "$file_path" == "$HOME"/.gemini/antigravity-cli/conversations/*.db || "$file_path" == "$HOME"/.gemini/antigravity-cli/conversations/*.db-wal ]] || continue
          ;;
      esac
      mtime=$(stat -f %m "$file_path" 2>/dev/null)
      stat_status=$?
      if (( stat_status != 0 )); then
        OWN_STAT_OK=0
        continue
      fi
      if (( mtime >= newest )); then
        newest=$mtime
        OWN_PATH=$file_path
        OWN_MTIME=$mtime
      fi
    done <<< "$lsof_output"
  fi
}

# Determine print mode from the first token-delimited mode option among
# -p, --print, -i, and --prompt-interactive in the flattened argv string.
# Selects only when that first mode option is -p or --print; fails closed if
# interactive, absent, or unclassifiable. Prompt text is treated strictly as data.
agy_is_print_mode() {
  local raw_args=$1
  local -a words
  words=(${=raw_args})
  local word
  for word in "${words[@]}"; do
    case "$word" in
      -p|--print) return 0 ;;
      -i|--prompt-interactive) return 1 ;;
    esac
  done
  return 1
}

# A start timestamp makes suppression belong to a process incarnation, not a
# reusable PID. Remove only markers for earlier incarnations of this PID.
marker_for_process() {
  local sensor=$1 pid=$2 started=$3 stale
  local identity=${started//[^[:alnum:]]/_}
  MARKER="$STATE_DIR/.wd-$sensor-$pid-$identity"
  for stale in "$STATE_DIR"/.wd-"$sensor"-"$pid"-*(N); do
    [[ "$stale" == "$MARKER" ]] || rm -f -- "$stale"
  done
}

clear_marker() {
  [[ -n "$MARKER" ]] && rm -f -- "$MARKER"
}

# Claim a new suspect episode atomically. The shared sensor lock serializes
# cooperating watchdogs; noclobber also makes the marker creation itself safe.
claim_marker() {
  setopt localoptions noclobber
  { : > "$MARKER" } 2>/dev/null
}

# Remove suppression state only after candidate discovery completed
# successfully. The observed paths are exact process-incarnation identities.
cleanup_missing_markers() {
  local sensor=$1 candidate observed found
  shift
  local -a observed_markers=("$@")

  for candidate in "$STATE_DIR"/.wd-"$sensor"-*(N); do
    found=0
    for observed in "${observed_markers[@]}"; do
      if [[ "$candidate" == "$observed" ]]; then
        found=1
        break
      fi
    done
    (( found )) || rm -f -- "$candidate"
  done
}

while true; do
  now=$(date +%s)
  transcript_mtime_text=$(stat -f %m "$TRANSCRIPT" 2>/dev/null)
  transcript_stat_status=$?
  if (( transcript_stat_status != 0 )) || ! parse_epoch_seconds "$transcript_mtime_text"; then
    # Unreadable or non-conclusive reads as "just touched", so the heartbeat
    # stays silent rather than acting on a value it cannot trust.
    (( transcript_mtime = now ))
  else
    (( transcript_mtime = PARSED_EPOCH ))
  fi
  # `now - transcript_mtime` overflows signed 64 bits only for an absurd
  # pre-1970 mtime, whose clamped age still meets every valid WD_IDLE_SECS
  # threshold under `>=`, so saturate at INT64_MAX instead of silently wrapping
  # to a small or negative age. Ordinary timestamps are unaffected and exact.
  if (( transcript_mtime < 0 && now > EPOCH_INT64_MAX + transcript_mtime )); then
    (( idle_age = EPOCH_INT64_MAX ))
  else
    (( idle_age = now - transcript_mtime ))
  fi
  alt_n=0
  codex_discovery_ok=0
  alt_discovery_ok=0
  agy_discovery_ok=0
  codex_observed_markers=()
  alt_observed_markers=()
  agy_observed_markers=()

  sensor_lock_fd=''
  # A positive timeout reports ordinary contention as status 2, distinct from
  # status 1 when the lock path cannot be opened.
  zsystem flock -t 0.001 -i 0.001 -f sensor_lock_fd "$SENSOR_LOCK_FILE" 2>/dev/null
  sensor_lock_status=$?
  if (( sensor_lock_status == 0 )); then

  codex_output=$(pgrep -f 'codex exec' 2>/dev/null)
  codex_status=$?
  if (( codex_status == 0 || codex_status == 1 )); then
    codex_discovery_ok=1
    codex_pids=("${(@f)codex_output}")
  else
    codex_pids=()
  fi
  for cpid in "${codex_pids[@]}"; do
    [[ -n "$cpid" ]] || continue
    comm=$(ps -o comm= -p "$cpid" 2>/dev/null)
    comm_status=$?
    comm=${comm//[[:space:]]/}
    if (( comm_status != 0 )) || [[ -z "$comm" ]]; then
      codex_discovery_ok=0
      continue
    fi
    [[ "$comm" == codex ]] || continue

    started=$(ps -o lstart= -p "$cpid" 2>/dev/null)
    started_status=$?
    if (( started_status != 0 )) || [[ -z "$started" ]]; then
      codex_discovery_ok=0
      continue
    fi
    marker_for_process codex "$cpid" "$started"
    codex_observed_markers+=("$MARKER")

    et=$(ps -o etime= -p "$cpid" 2>/dev/null)
    ct=$(ps -o cputime= -p "$cpid" 2>/dev/null)
    esec=$(parse_process_time "$et") || continue
    csec=$(parse_process_time "$ct") || continue

    if (( esec > CODEX_SECS && csec < 2 )); then
      find_newest_own_file "$cpid" codex
      roage=''
      rollout_status='missing'
      if [[ -n "$OWN_MTIME" ]]; then
        roage=$(( now - OWN_MTIME ))
        if (( roage <= CODEX_SECS )); then
          clear_marker
          continue
        fi
        rollout_status="${roage}s silent"
      fi
      if claim_marker; then
        print -r -- "STALL: codex pid $cpid alive ${esec}s, ${csec}s CPU, own rollout $rollout_status — hung (verify tee/-o target before killing)"
      fi
    else
      clear_marker
    fi
  done

  # Discover Claude executables without relying on CLAUDE_CONFIG_DIR being in
  # argv. Each PID becomes an alternate lane only when its own lsof evidence
  # identifies an open transcript under ALT_HOME.
  alt_output=$(pgrep -x 'claude' 2>/dev/null)
  alt_status=$?
  if (( alt_status == 0 || alt_status == 1 )); then
    alt_discovery_ok=1
    alt_pids=("${(@f)alt_output}")
  else
    alt_pids=()
  fi
  for apid in "${alt_pids[@]}"; do
    [[ -n "$apid" ]] || continue
    comm=$(ps -o comm= -p "$apid" 2>/dev/null)
    comm_status=$?
    comm=${comm//[[:space:]]/}
    if (( comm_status != 0 )) || [[ -z "$comm" ]]; then
      alt_discovery_ok=0
      continue
    fi
    [[ "$comm" == claude ]] || continue
    (( alt_n++ ))

    started=$(ps -o lstart= -p "$apid" 2>/dev/null)
    started_status=$?
    if (( started_status != 0 )) || [[ -z "$started" ]]; then
      alt_discovery_ok=0
      continue
    fi
    marker_for_process alt "$apid" "$started"
    alt_observed_markers+=("$MARKER")
    find_newest_own_file "$apid" alt
    # No process-owned transcript means this sensor has no conclusion. Do not
    # borrow a sibling/global transcript and do not manufacture a recovery.
    [[ -n "$OWN_MTIME" ]] || continue

    lage=$(( now - OWN_MTIME ))
    if (( lage > ALT_SECS )); then
      if claim_marker; then
        print -r -- "ALT-SEAT STALL: claude pid $apid alive, own transcript ${lage}s silent"
      fi
    else
      clear_marker
    fi
  done

  agy_output=$(pgrep -x 'agy' 2>/dev/null)
  agy_status=$?
  if (( agy_status == 0 || agy_status == 1 )); then
    agy_discovery_ok=1
    agy_pids=("${(@f)agy_output}")
  else
    agy_pids=()
  fi
  for apid in "${agy_pids[@]}"; do
    [[ -n "$apid" ]] || continue
    comm=$(ps -o comm= -p "$apid" 2>/dev/null)
    comm_status=$?
    comm=${comm//[[:space:]]/}
    if (( comm_status != 0 )) || [[ -z "$comm" ]]; then
      agy_discovery_ok=0
      continue
    fi
    [[ "$comm" == agy ]] || continue

    proc_args=$(ps -o args= -p "$apid" 2>/dev/null)
    args_status=$?
    trimmed_args=${proc_args//[[:space:]]/}
    if (( args_status != 0 )) || [[ -z "$trimmed_args" ]]; then
      agy_discovery_ok=0
      continue
    fi
    agy_is_print_mode "$proc_args" || continue

    started=$(ps -o lstart= -p "$apid" 2>/dev/null)
    started_status=$?
    if (( started_status != 0 )) || [[ -z "$started" ]]; then
      agy_discovery_ok=0
      continue
    fi
    marker_for_process agy "$apid" "$started"
    agy_observed_markers+=("$MARKER")

    et=$(ps -o etime= -p "$apid" 2>/dev/null)
    esec=$(parse_process_time "$et") || continue

    find_newest_own_file "$apid" agy
    if (( OWN_LOOKUP_OK == 0 || OWN_STAT_OK == 0 )); then
      agy_discovery_ok=0
      continue
    fi

    if [[ -z "$OWN_MTIME" ]]; then
      if (( esec > AGY_STARTUP_SECS )); then
        if claim_marker; then
          print -r -- "AGY STALL: agy pid $apid own conversation database missing after ${esec}s"
        fi
      fi
    else
      db_age=$(( now - OWN_MTIME ))
      if (( db_age > AGY_SECS )); then
        if claim_marker; then
          print -r -- "AGY STALL: agy pid $apid own conversation database ${db_age}s silent"
        fi
      else
        clear_marker
      fi
    fi
  done

  (( codex_discovery_ok )) && cleanup_missing_markers codex "${codex_observed_markers[@]}"
  (( alt_discovery_ok )) && cleanup_missing_markers alt "${alt_observed_markers[@]}"
  (( agy_discovery_ok )) && cleanup_missing_markers agy "${agy_observed_markers[@]}"

  if ! zsystem flock -u "$sensor_lock_fd"; then
    print -u2 -r -- "lane-watchdog: cannot release sensor lock $SENSOR_LOCK_FILE"
    exit 1
  fi
  elif (( sensor_lock_status != 2 )); then
    print -u2 -r -- "lane-watchdog: cannot acquire sensor lock $SENSOR_LOCK_FILE"
    exit 1
  fi

  heartbeat_delay=0
  if [[ -n "$TRANSCRIPT" ]] && (( idle_age >= IDLE_SECS )); then
    codex_n=$(pgrep -f 'codex exec' 2>/dev/null | wc -l | tr -d ' ')
    print -r -- "HEARTBEAT: idle $((idle_age/60))min, codex=$codex_n alt=$alt_n — board check due"
    heartbeat_delay=120
  fi

  (( iteration++ ))
  if (( MAX_ITERATIONS > 0 && iteration >= MAX_ITERATIONS )); then
    break
  fi
  (( heartbeat_delay > 0 )) && sleep "$heartbeat_delay"
  sleep "$SAMPLE_SECS"
done
