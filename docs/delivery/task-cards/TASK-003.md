---
id: TASK-003
type: task-card
status: draft
authority: normative
description: 'Recover the blocked watchdog hardening candidate with explicit runtime lock-failure handling and silent atomic marker claims.'
provenance: 'Successor to TASK-002 / orc run 4L532F, rejected candidate 6f5bb4267189edbfd052815381e1bb39c37e97ce, 2026-09-04'
---

# TASK-003 — Complete watchdog state synchronization

## Outcome

The watchdog delivers the `TASK-002` command-contract and marker-cleanup
hardening, serializes shared sensor state across cooperating monitors, and
cannot mistake a runtime lock-open failure for ordinary contention. Repeated
suppression claims remain silent on both stdout and stderr.

## Governing docs

- `TASK-002`
- `TASK-001`
- `HEADLESS-SEATS`
- `OPERATING-MODEL`
- `ENGINEERING-METHOD`
- `ORC-ERGO-DELIVERY`

## In scope

- Recover the cumulative watchdog implementation and tests from rejected
  `TASK-002` candidate `6f5bb4267189edbfd052815381e1bb39c37e97ce` onto a
  fresh branch based on trunk.
- Preserve exact `lsof -Fn -p` test enforcement and fail-closed,
  process-incarnation marker cleanup from `TASK-002`.
- Preserve cooperative advisory locking across both sensor snapshots, marker
  operations, and cleanup while keeping heartbeat behavior outside the lock.
- Distinguish ordinary lock contention from a runtime failure to open or
  acquire the lock; the latter is an explicit nonzero failure, never a silent
  sensor skip.
- Suppress the expected no-clobber diagnostic when an existing marker rejects
  a repeated atomic claim.
- Add deterministic real-entry regressions for both final-convergence
  findings from orc run `4L532F`.

## Out of scope

- New sensors, structured protocol adapters, process ownership, automatic
  termination, or ledger integration.
- Changes to thresholds, selectors, alert text, evidence attribution, time
  parsing, or heartbeat predicates.
- A cross-harness supervisor/daemon or its normative contract.
- Linux support or a dependency/package manifest.

## File territory

- `.agents/skills/watchtower-loop/lane-watchdog.sh`
- `.agents/skills/watchtower-loop/lane-watchdog.test.mjs`
- `docs/delivery/decisions/` only if a genuinely local/mechanical choice earns
  a decision record

Do not edit the gate, governing docs, task-card statuses, or task-card index
in this task.

## Must not change

- The watchdog remains notification-only and must not spawn, stop, signal, or
  reap harness processes or mutate orc/ergo.
- Existing thresholds, environment override names, selectors, process-owned
  evidence rules, parser behavior, and alert predicates remain compatible.
- Cleanup remains limited to watchdog-owned Codex and alternate-Claude marker
  files and must preserve every live process incarnation when discovery is
  incomplete.
- Lock contention may skip sensor work only for that iteration; it must not
  suppress heartbeat output or alter marker state.
- Do not delete, skip, weaken, or narrow any test, gate, or check to make it
  pass.

## Acceptance criteria

1. All seven `TASK-002` acceptance criteria pass on the fresh candidate.
2. Two cooperating watchdogs sharing one state directory produce at most one
   first alert and marker claim for one continuous suspect incarnation; the
   lock covers marker cleanup as well as claim/recovery.
3. A deterministic real-entry probe removes or makes the lock path unusable
   after startup but before acquisition; the watchdog emits an explicit
   diagnostic and exits nonzero instead of silently skipping sensors.
4. Ordinary lock contention remains distinguishable from criterion 3: sensor
   state is untouched, heartbeat still runs, and the bounded iteration exits
   successfully.
5. A repeated suspect iteration with an existing marker emits neither a
   duplicate alert nor a no-clobber diagnostic on stderr.
6. The current focused tests are demonstrated red against rejected candidate
   `6f5bb4267189edbfd052815381e1bb39c37e97ce` for both runtime lock failure
   and repeated-claim stderr noise.
7. Tests use isolated fake processes, time, filesystem, and commands; lock
   holders exit normally without signals, real harnesses, notifications, or
   wall-clock sleeps.
8. `/bin/zsh -n`, the focused suite, `git diff --check`, and
   `node scripts/check.mjs` pass with no leftover marker or test artifacts.

## Verification commands

```bash
/bin/zsh -n .agents/skills/watchtower-loop/lane-watchdog.sh
node --test .agents/skills/watchtower-loop/lane-watchdog.test.mjs
git diff --check master...HEAD
node scripts/check.mjs
```
