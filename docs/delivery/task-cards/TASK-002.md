---
id: TASK-002
type: task-card
status: draft
authority: normative
description: 'Close TASK-001 follow-ups by enforcing lsof command shape in tests and bounding stale watchdog marker state.'
provenance: 'TZQVCD final convergence findings, candidate 352773b475adf903c6d4577d4830491fa45a265f, 2026-09-04'
---

# TASK-002 — Harden watchdog command contracts and marker cleanup

## Outcome

The `TASK-001` watchdog lever detects regressions in its required `lsof -Fn`
protocol and does not accumulate suppression markers for process incarnations
that have disappeared. Existing advisory stall behavior remains unchanged.

## Governing docs

- `TASK-001`
- `HEADLESS-SEATS`
- `OPERATING-MODEL`
- `ENGINEERING-METHOD`
- `ORC-ERGO-DELIVERY`

## In scope

- Make the fake `lsof` command accept only the production argument shape
  `-Fn -p <pid>` and fail otherwise, so changing the watchdog to table-mode
  output makes the real-entry-point suite red.
- Sweep Codex and alternate-Claude suppression markers after each sensor
  iteration when their recorded process incarnation was not observed in that
  iteration.
- Preserve markers for every currently observed matching process incarnation,
  including a Claude process whose own alternate-home transcript is presently
  unattributable.
- Add deterministic tests for process disappearance, unaffected live siblings,
  PID reuse, and command-selector failure.

## Out of scope

- New sensors, structured protocol adapters, process ownership, automatic
  termination, or ledger integration.
- Changes to thresholds, alert text, time parsing, evidence attribution, or
  heartbeat behavior.
- A cross-harness supervisor/daemon or its normative contract.
- Linux support or a dependency/package manifest.

## File territory

- `.agents/skills/watchtower-loop/lane-watchdog.sh`
- `.agents/skills/watchtower-loop/lane-watchdog.test.mjs`
- `docs/delivery/decisions/` only if a genuinely local/mechanical choice earns
  a decision record

Do not edit the gate, governing docs, task-card statuses, or the task-card
index in this task.

## Must not change

- The watchdog remains notification-only and must not spawn, stop, signal, or
  reap harness processes or mutate orc/ergo.
- Existing default thresholds, environment override names, selectors,
  process-owned evidence rules, time parser, and alert predicates remain
  compatible.
- Marker cleanup must be scoped to watchdog-owned Codex/alternate-Claude
  marker files and must not remove another live incarnation's suppression.
- Do not delete, skip, weaken, or narrow any test, gate, or check to make it
  pass.

## Acceptance criteria

1. The fake `lsof` returns fixture data only for the exact argument vector
   `-Fn -p <pid>`; any other shape exits nonzero.
2. The real-entry-point suite is demonstrated red when a temporary copy of the
   production call is changed from `lsof -Fn -p` to `lsof -p`.
3. After a suspect process disappears, its Codex or alternate-Claude marker is
   removed by a later iteration with no such incarnation.
4. Cleanup preserves current markers for live qualifying processes and does
   not cross sensors, live siblings, or a reused PID with a different start
   identity.
5. An observed Claude process with no attributable alternate-home transcript
   is non-conclusive and remains counted as a live incarnation for cleanup
   safety.
6. Tests use isolated fake processes/time/filesystem and no real harness,
   model, notification, signal, or wall-clock sleep.
7. `/bin/zsh -n`, the focused suite, and `node scripts/check.mjs` pass with no
   leftover marker/test artifacts.

## Verification commands

```bash
/bin/zsh -n .agents/skills/watchtower-loop/lane-watchdog.sh
node --test .agents/skills/watchtower-loop/lane-watchdog.test.mjs
node scripts/check.mjs
git diff --check
```
