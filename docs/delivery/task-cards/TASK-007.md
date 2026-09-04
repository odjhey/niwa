---
id: TASK-007
type: task-card
status: draft
authority: normative
description: 'Add deterministic, process-attributed Antigravity stall detection and prove it in an alert-only live dogfood trial.'
provenance: 'Operator-approved Antigravity watchdog semantics and Antigravity 1.1.26 dogfood, 2026-09-04'
---

# TASK-007 — Detect stalled Antigravity lanes

## Outcome

The advisory lane watchdog identifies stalled Antigravity print-mode ship
lanes from each process's own conversation database, suppresses repeat alerts
per process incarnation and suspect episode, and is exercised against a real
Antigravity lane without terminating it.

## Governing docs

- `TASK-003`
- `TASK-006`
- `HEADLESS-SEATS`
- `ENGINEERING-METHOD`
- `OPERATING-MODEL`

## In scope

- Discover Antigravity candidates by exact process name `agy`, then select only
  print-mode (`-p` or `--print`) lanes so an interactive `agy` process is not
  treated as a headless ship lane.
- Attribute progress only to the selected process's own open
  `~/.gemini/antigravity-cli/conversations/<id>.db` or `.db-wal` file.
- Add `WD_AGY_STARTUP_SECS=60` and `WD_AGY_SECS=900` overrides.
- Emit `AGY STALL:` when a selected process older than the strict startup
  threshold has no attributable conversation database after a successful
  per-process file lookup, or when its newest attributable database evidence
  is strictly older than the silence threshold.
- Extend process-incarnation suppression, recovery, disappearance cleanup,
  fail-closed sensor discovery, and cooperative locking to Antigravity.
- Add deterministic real-entry tests and update the root operator README.
- Run a bounded alert-only live trial against Antigravity 1.1.26 using reduced
  thresholds; let the lane exit normally and inspect or signal no unrelated
  process.

## Out of scope

- Treating stdout, stderr, `--log-file`, shared databases, CPU time alone, or
  another lane's conversation as progress evidence.
- Antigravity session resume, structured-protocol integration, automatic
  termination, process ownership, signals, or child reaping.
- Changes to Codex, Pi, or alternate-Claude thresholds/evidence semantics.
- Linux support, Qoder support, or a dependency/package manifest.

## File territory

- `.agents/skills/watchtower-loop/lane-watchdog.sh`
- `.agents/skills/watchtower-loop/lane-watchdog.test.mjs`
- `README.md`
- `docs/delivery/decisions/` only if a genuinely local/mechanical choice earns
  a decision record

Do not edit governing docs, gate wiring, task-card statuses, or the task-card
index.

## Must not change

- The watchdog remains notification-only and never spawns, stops, signals,
  owns, or reaps a harness process or mutates orc/ergo.
- Existing Codex/Claude selectors, attribution, cleanup, suppression, parser,
  thresholds, alerts, heartbeat, and lock failure behavior remain compatible.
- Missing/failed `pgrep`, `ps comm`, `ps args`, `ps lstart`, or `lsof` evidence
  is non-conclusive for Antigravity cleanup and alerting; sensor-local failure
  must not disable conclusive cleanup for other sensors.
- Marker cleanup removes only `.wd-agy-*` state owned by disappeared
  Antigravity print-process incarnations and never the shared sensor lock or
  unrelated state.
- Do not delete, skip, weaken, or narrow any test, gate, or check.

## Acceptance criteria

1. Exact `pgrep -x agy`, exact `comm=agy`, and a token-delimited `-p` or
   `--print` selection exclude interactive/non-Antigravity processes without
   borrowing sibling evidence.
2. A successful exact `lsof -Fn -p <pid>` lookup considers only that PID's
   open conversation `.db` and `.db-wal`; `.db-shm`, shared summary databases,
   stdout/stderr, and diagnostic logs cannot keep it healthy.
3. With `WD_AGY_STARTUP_SECS=60`, no attributable database alerts only when
   elapsed time is strictly greater than 60 seconds. Failed/incomplete lookup
   is non-conclusive and does not alert.
4. With `WD_AGY_SECS=900`, attributable database silence alerts only when age
   is strictly greater than 900 seconds; fresh evidence clears suppression.
5. Alerts begin with `AGY STALL:`, identify PID and whether startup evidence is
   missing or the own database is silent, and occur once per incarnation and
   continuous suspect episode.
6. Recovery, PID reuse, process disappearance, live siblings, interactive
   `agy`, and per-sensor discovery errors preserve/remove only the correct
   markers.
7. The existing shared advisory lock serializes Antigravity marker claims and
   cleanup across cooperating watchdogs; busy contention leaves all sensor
   state untouched while heartbeat behavior continues.
8. Tests use isolated fake process/time/filesystem/commands, enforce exact
   command vectors, and go red for table-mode `lsof`, global/newest database
   borrowing, log-as-progress, or interactive-process selection mutations.
9. `README.md` documents both Antigravity variables, evidence, strict
   thresholds, output label, and alert-only limitations accurately.
10. A live reduced-threshold trial starts one real Antigravity print lane,
    observes it only through the watchdog, produces the expected advisory
    claim or records a concrete evidence-grounded incompatibility, and allows
    normal process exit without signal/kill/reaping.
11. `/bin/zsh -n`, the focused suite, `git diff --check`, and
    `node scripts/check.mjs` pass with no leftover test markers/artifacts.

## Verification commands

```bash
/bin/zsh -n .agents/skills/watchtower-loop/lane-watchdog.sh
node --test .agents/skills/watchtower-loop/lane-watchdog.test.mjs
git diff --check master...HEAD
node scripts/check.mjs
```
