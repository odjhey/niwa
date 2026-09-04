# Niwa

Niwa is a docs-first repository for operating an agent delivery pipeline and its supporting documentation and lane-supervision tools. Start with the authoritative [docs root](docs/README.md); repository instructions are in [AGENTS.md](AGENTS.md), headless-seat guidance is in [HEADLESS-SEATS](docs/playbooks/headless-seats.md), and the delivery cycle and watchdog context are in the [watchtower-loop skill](.agents/skills/watchtower-loop/SKILL.md).

## Prerequisites

- Node.js 18 or newer. The Node.js tools have zero npm dependencies.
- For the watchdog: macOS and `/bin/zsh`, including the `zsh/system` module and `zsystem flock`, plus `date`, `head`, `ls`, `lsof`, `pgrep`, `ps`, `pwd`, `rm`, `sleep`, `stat`, `tr`, and `wc`. Its `stat -f %m` use is macOS-specific; Linux is not supported by these instructions.

## Quick start

Run these commands from the repository root:

```bash
# Full local gate
node scripts/check.mjs

# Query live documentation
node docs/scripts/find-docs.mjs --type playbook
node docs/scripts/find-docs.mjs --authority normative
node docs/scripts/find-docs.mjs --id HEADLESS-SEATS
node docs/scripts/find-docs.mjs delivery pipeline
node docs/scripts/find-docs.mjs --help

# Focused regression suites
node --test docs/scripts/docs-check.test.mjs
/bin/zsh -n .agents/skills/watchtower-loop/lane-watchdog.sh
node --test .agents/skills/watchtower-loop/lane-watchdog.test.mjs
```

The gate runs both focused suites, documentation validation, and the repository manifest check when applicable.

## Lane watchdog

For a persistent monitor, point `WD_TRANSCRIPT` at the current watchtower session transcript. `WD_ALT_HOME` is only needed when the alternate Claude configuration is somewhere other than its default:

```bash
WD_TRANSCRIPT="/absolute/path/to/current-watchtower-session.jsonl" \
WD_ALT_HOME="/absolute/path/to/alternate-claude-home" \
/bin/zsh .agents/skills/watchtower-loop/lane-watchdog.sh
```

For a bounded probe, use an isolated temporary state directory and set `WD_MAX_ITERATIONS=1`; this runs one iteration, cleans up its state even on failure, and exits without affecting the parent shell, so it is **not** a persistent monitor:

```bash
(
  watchdog_state=$(mktemp -d "${TMPDIR:-/tmp}/niwa-watchdog.XXXXXX") || exit
  trap 'rm -rf -- "$watchdog_state"' EXIT
  WD_TRANSCRIPT="/absolute/path/to/current-watchtower-session.jsonl" \
  WD_STATE_DIR="$watchdog_state" \
  WD_MAX_ITERATIONS=1 \
  /bin/zsh .agents/skills/watchtower-loop/lane-watchdog.sh
)
```

| Variable | Default | Meaning |
|---|---|---|
| `WD_TRANSCRIPT` | Newest `*.jsonl` in `~/.claude/projects/<cwd-slug>/` | This watchtower session's transcript for heartbeat idleness. `<cwd-slug>` is the current working directory with `/` changed to `-`; set an absolute path to avoid selecting the wrong session. |
| `WD_ALT_HOME` | `$HOME/.claude-alt` | Alternate Claude `CLAUDE_CONFIG_DIR`. A Claude process is attributable only through its own open transcript under `$WD_ALT_HOME/projects/*/*.jsonl`. |
| `WD_CODEX_SECS` | `900` seconds | Codex elapsed-time and own-rollout-silence threshold. A claim also requires less than 2 seconds of process CPU; the comparisons are strict (`>` threshold). |
| `WD_ALT_SECS` | `1200` seconds | Strict (`>`) alternate-Claude own-transcript silence threshold. |
| `WD_AGY_STARTUP_SECS` | `60` seconds | Strict (`>`) Antigravity startup threshold for missing own conversation database evidence. |
| `WD_AGY_SECS` | `900` seconds | Strict (`>`) Antigravity own conversation database (`.db` or `.db-wal`) silence threshold. |
| `WD_IDLE_SECS` | `1800` seconds | Watchtower transcript idle threshold for a heartbeat (`>=` threshold). |
| `WD_MAX_ITERATIONS` | `0` (unbounded) | Iteration limit. A positive value bounds the run; `1` performs one iteration without a sampling sleep. |
| `WD_STATE_DIR` | `${TMPDIR:-/tmp}` | Existing writable directory for the shared `.wd-sensors.lock` and process-incarnation alert markers. Cooperating watchdogs sharing it suppress duplicate alerts; conclusive recovery or disappearance clears owned marker state. |
| `WD_SAMPLE_SECS` | `60` seconds | Sleep between iterations. A heartbeat adds a 120-second delay before this sampling sleep. |

The watchdog writes advisory records to stdout:

- `STALL:` — a Codex process exceeded the elapsed threshold with less than 2 seconds of CPU and its own rollout is missing or exceeded the silence threshold.
- `ALT-SEAT STALL:` — an attributable alternate-Claude process's own open transcript exceeded its silence threshold.
- `AGY STALL:` — an Antigravity print-mode process exceeded the startup threshold without an attributable conversation database or exceeded the silence threshold since its newest own database update.
- `HEARTBEAT:` — this watchtower transcript reached the idle threshold; the board should be checked.

> **Alert-only:** every record is a claim that requires manual evidence verification before any process action. The watchdog never kills, signals, owns, or reaps a process.

## Script reference

| Path | Role |
|---|---|
| `scripts/check.mjs` | Supported operator entry point for the full local gate. |
| `docs/scripts/find-docs.mjs` | Supported operator entry point for frontmatter queries; `--help` lists all filters. |
| `.agents/skills/watchtower-loop/lane-watchdog.sh` | Supported macOS/zsh operator entry point for advisory lane monitoring. |
| `docs/scripts/docs-check.mjs` | Internal documentation-check module used by the gate and its regression suite; use the full gate for operator validation. |
| `docs/scripts/docs-check.test.mjs` | Internal regression suite, exposed above only for focused testing. |
| `.agents/skills/watchtower-loop/lane-watchdog.test.mjs` | Internal watchdog regression suite, exposed above only for focused testing. |

## Troubleshooting

- Missing `zsh/system` or `zsystem flock` support, an unusable startup lock path, and runtime lock acquire/release errors are fatal and print `lane-watchdog:` diagnostics to stderr.
- No process-owned alternate-Claude transcript is non-conclusive; the watchdog does not borrow a sibling or global transcript. Discovery failures likewise preserve existing sensor markers rather than inferring recovery. For Codex only, a missing own rollout can contribute to `STALL:` when the elapsed-time and CPU predicates also hold.
- Antigravity discovery requires exact `comm=agy` and a space/token-delimited `-p` or `--print` option (interactive `agy` is excluded); progress is attributed only to the selected PID's own open `$HOME/.gemini/antigravity-cli/conversations/*.db` or `*.db-wal`. A failed lookup or matched-file `stat` failure is non-conclusive and disables cleanup only for Antigravity.
- Run the watchdog from the intended working directory: default transcript discovery derives `<cwd-slug>` from that directory.

For contract questions, follow [DOCS-ROOT](docs/README.md) and the governing documents it registers rather than treating this usage guide as normative.
