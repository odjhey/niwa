#!/bin/zsh
# Lane watchdog — supervises external seat lanes and nudges an idle watchtower.
# Durable home: .agents/skills/watchtower-loop/lane-watchdog.sh (v9, from the
# originating repo's 2026-09-03 dogfood; keep incident history in
# SEAT-RELIABILITY). macOS/zsh: uses `stat -f %m`, `lsof`, `pgrep`;
# ADAPT `stat` for GNU coreutils (`stat -c %Y`).
#
# Arm it as a persistent Monitor (or equivalent harness watch) whose stdout
# lines become notifications:
#   Monitor: command=<this file>, persistent=true
#
# Sensors (every 60s; each alert once per episode; all session-attributed):
#   1. codex lanes: any `codex exec` process alive >15min with <2s CPU AND
#      whose OWN open rollout file (found via lsof, per-lane) is silent
#      >15min is a startup hang. Per-process CPU alone false-positives on
#      healthy network-bound lanes (high-effort runs idle the CPU during
#      long API streams — observed 2026-09-03, lane was writing its rollout
#      3s before the flag); global rollout mtime alone masks a stalled
#      sibling. Both signals, per-lane, or no flag.
#   2. alt-seat lanes: CLAUDE_CONFIG_DIR seats buffer stdout, so liveness is
#      the seat's own session-transcript mtime, silent >20min = stall.
#   3. heartbeat: only when THIS session's transcript is >=30min old — the
#      transcript is written on every watchtower action, so this fires only
#      while genuinely idle; never while busy.
#
# Config (env, all optional):
#   WD_TRANSCRIPT      this session's transcript (default: newest jsonl in
#                      ~/.claude/projects/<cwd-slug>/)
#   WD_ALT_HOME        alt-seat CLAUDE_CONFIG_DIR (default ~/.claude-alt; ADAPT)
#   WD_CODEX_SECS=900  WD_ALT_SECS=1200  WD_IDLE_SECS=1800

slug=$(pwd | tr '/' '-')
TRANSCRIPT=${WD_TRANSCRIPT:-$(ls -t ~/.claude/projects/$slug/*.jsonl 2>/dev/null | head -1)}
ALT_HOME=${WD_ALT_HOME:-$HOME/.claude-alt}
CODEX_SECS=${WD_CODEX_SECS:-900}; ALT_SECS=${WD_ALT_SECS:-1200}; IDLE_SECS=${WD_IDLE_SECS:-1800}
alt_flagged=0
while true; do
  now=$(date +%s)
  idle_age=$(( now - $(stat -f %m "$TRANSCRIPT" 2>/dev/null || echo $now) ))
  for cpid in $(pgrep -f "codex exec"); do
    # real codex binaries only — shell wrappers carry "codex exec" in their
    # argv and false-positive (0 CPU, no rollout; observed 2026-09-03 v8)
    [ "$(ps -o comm= -p $cpid 2>/dev/null | tr -d ' ')" = "codex" ] || continue
    roage=''
    et=$(ps -o etime= -p $cpid 2>/dev/null | tr -d ' '); [ -z "$et" ] && continue
    ct=$(ps -o cputime= -p $cpid 2>/dev/null | tr -d ' ')
    esec=$(echo "$et" | awk -F'[:-]' '{ if (NF==4) print $1*86400+$2*3600+$3*60+$4; else if (NF==3) print $1*3600+$2*60+$3; else print $1*60+$2 }')
    csec=$(echo "$ct" | awk -F'[:.]' '{ print $1*60+$2 }')
    if [ "${esec:-0}" -gt "$CODEX_SECS" ] && [ "${csec:-99}" -lt 2 ]; then
      ro=$(lsof -p $cpid 2>/dev/null | awk '/sessions.*rollout.*\.jsonl/{print $NF; exit}')
      if [ -n "$ro" ]; then
        roage=$(( now - $(stat -f %m "$ro" 2>/dev/null || echo 0) ))
        [ $roage -le "$CODEX_SECS" ] && continue   # rollout fresh: healthy network-bound lane
      fi
      flagf=${TMPDIR:-/tmp}/.wd-flag-$cpid
      if [ ! -f "$flagf" ]; then
        echo "STALL: codex pid $cpid alive ${esec}s, ${csec}s CPU, own rollout ${roage:-none}s silent — hung (verify tee/-o target before killing)"
        touch "$flagf"
      fi
    fi
  done
  alt_n=$(pgrep -f "$(basename $ALT_HOME)" | wc -l | tr -d ' ')
  if [ "$alt_n" -gt 0 ]; then
    lnewest=$(ls -t $ALT_HOME/projects/*/*.jsonl 2>/dev/null | head -1)
    if [ -n "$lnewest" ]; then
      lage=$(( now - $(stat -f %m "$lnewest") ))
      if [ $lage -gt "$ALT_SECS" ] && [ $alt_flagged -eq 0 ]; then
        echo "ALT-SEAT STALL: $alt_n proc(s) alive, seat transcript silent ${lage}s"
        alt_flagged=1
      fi
      [ $lage -le "$ALT_SECS" ] && alt_flagged=0
    fi
  else alt_flagged=0; fi
  if [ -n "$TRANSCRIPT" ] && [ $idle_age -ge "$IDLE_SECS" ]; then
    echo "HEARTBEAT: idle $((idle_age/60))min, codex=$(pgrep -f 'codex exec' | wc -l | tr -d ' ') alt=$alt_n — board check due"
    sleep 120
  fi
  sleep 60
done
