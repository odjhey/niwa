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
#   3. heartbeat: only when THIS session's transcript is >=30min old.
#
# Config (env, all optional):
#   WD_TRANSCRIPT      this session's transcript (default: newest jsonl in
#                      ~/.claude/projects/<cwd-slug>/)
#   WD_ALT_HOME        alt-seat CLAUDE_CONFIG_DIR (default ~/.claude-alt; ADAPT)
#   WD_CODEX_SECS=900  WD_ALT_SECS=1200  WD_IDLE_SECS=1800
# Testability seams (production defaults preserve the persistent monitor):
#   WD_MAX_ITERATIONS=0 (unbounded)  WD_STATE_DIR=${TMPDIR:-/tmp}
#   WD_SAMPLE_SECS=60

slug=$(pwd | tr '/' '-')
TRANSCRIPT=${WD_TRANSCRIPT:-$(ls -t ~/.claude/projects/$slug/*.jsonl 2>/dev/null | head -1)}
ALT_HOME=${WD_ALT_HOME:-$HOME/.claude-alt}
CODEX_SECS=${WD_CODEX_SECS:-900}
ALT_SECS=${WD_ALT_SECS:-1200}
IDLE_SECS=${WD_IDLE_SECS:-1800}
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
  local pid=$1 sensor=$2 line file_path mtime
  local newest=0
  OWN_PATH=''
  OWN_MTIME=''

  while IFS= read -r line; do
    [[ "$line" == n* ]] || continue
    file_path=${line#n}
    case "$sensor" in
      codex) [[ "$file_path" == *sessions*rollout*.jsonl ]] || continue ;;
      alt) [[ "$file_path" == "$ALT_HOME"/projects/*/*.jsonl ]] || continue ;;
    esac
    mtime=$(stat -f %m "$file_path" 2>/dev/null) || continue
    if (( mtime >= newest )); then
      newest=$mtime
      OWN_PATH=$file_path
      OWN_MTIME=$mtime
    fi
  done < <(lsof -Fn -p "$pid" 2>/dev/null)
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
  transcript_mtime=$(stat -f %m "$TRANSCRIPT" 2>/dev/null || print -r -- "$now")
  idle_age=$(( now - transcript_mtime ))
  alt_n=0
  codex_discovery_ok=0
  alt_discovery_ok=0
  codex_observed_markers=()
  alt_observed_markers=()

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

  (( codex_discovery_ok )) && cleanup_missing_markers codex "${codex_observed_markers[@]}"
  (( alt_discovery_ok )) && cleanup_missing_markers alt "${alt_observed_markers[@]}"

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
