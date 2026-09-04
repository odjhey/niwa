---
id: TASK-001
type: task-card
status: draft
authority: normative
description: 'Make the existing alert-only lane watchdog deterministic, testable, and correctly attributed per monitored process.'
provenance: 'Detecting Headless Stalls chat, /Users/odz/Downloads/Detecting Headless Stalls (2026-09-04).md; recon workflow 15a24b36-71c9-4803-adbc-bb86b51ed0b7'
---

# TASK-001 — Repair lane-watchdog attribution and testability

## Outcome

The existing watchtower lane watchdog implements the lane-attribution and
verify-before-kill rules described by `HEADLESS-SEATS`: every Codex or
alternate-account Claude alert is derived from that process's own evidence,
and its behavior is reproducible under a deterministic test harness. The
watchdog remains advisory and alert-only.

## Governing docs

- `HEADLESS-SEATS`
- `OPERATING-MODEL`
- `ENGINEERING-METHOD`
- `ORC-ERGO-DELIVERY`

## In scope

- Add bounded-iteration and isolated-state seams so the watchdog can run once
  under tests without sleeping forever or sharing alert markers with live use.
- Characterize the Codex and alternate-account Claude sensors using fake
  process, clock, filesystem, and notification commands; no real harness or
  model process may run in the tests.
- Attribute Codex rollout freshness and alternate-account Claude transcript
  freshness per process. Evidence from one sibling lane must not keep another
  lane healthy.
- Make alert suppression identify one process incarnation, re-arm after
  recovery, and avoid suppressing a later process that reuses a PID.
- Correctly parse elapsed and CPU times in `mm:ss`, `hh:mm:ss`, and
  `dd-hh:mm:ss` forms.
- Wire the watchdog test into the local gate.

## Out of scope

- Spawning or owning harness processes.
- Automatic abort, `SIGTERM`, `SIGKILL`, process-group control, or reaping.
- Structured event parsing, state-specific leases, run-artifact schemas, or a
  daemon/service.
- New Pi, Qoder, or ordinary-account Claude sensors.
- Changing the documented default thresholds or adding Linux support.
- Writing or deriving orc/ergo outcomes from watchdog observations.

A normative cross-harness supervision contract and owning runner remain parked
until progress semantics, action authority, ownership, completion, privacy,
version degradation, and portability are specified from authoritative evidence.

## File territory

- `.agents/skills/watchtower-loop/lane-watchdog.sh`
- `.agents/skills/watchtower-loop/lane-watchdog.test.mjs` (new)
- `scripts/check.mjs`
- `docs/delivery/decisions/` only if a genuinely local/mechanical choice earns
  a decision record

Do not edit `HEADLESS-SEATS`, `ORC-ERGO-DELIVERY`, task-card status, or other
product/process docs in this task.

## Must not change

- The watchdog remains notification-only: it must not spawn, stop, signal, or
  reap a harness process.
- Existing defaults remain Codex silence `900s`, alternate-Claude silence
  `1200s`, watchtower idle `1800s`, and sample interval `60s`.
- A Codex alert still requires elapsed age over threshold, low cumulative CPU,
  and its own missing-or-stale rollout evidence; fresh own rollout evidence
  suppresses the alert.
- A watchdog alert remains a claim requiring operator corroboration, never a
  stall verdict or delivery-ledger mutation.
- Do not delete, skip, weaken, or narrow any test, gate, or check to make it
  pass.

## Acceptance criteria

1. A deterministic test runs the real watchdog entry point for bounded
   iterations with fake external commands and no live process discovery,
   notification, harness invocation, or wall-clock sleep.
2. Two concurrent Codex fixtures prove that one lane's fresh own rollout does
   not suppress an alert for a qualifying stale sibling, and that the fresh
   lane does not alert.
3. Two concurrent alternate-Claude fixtures prove the same per-process
   isolation using each process's own open transcript under the configured
   alternate home; an unattributable process does not borrow a global newest
   transcript or produce a destructive conclusion.
4. Fixtures cover missing own evidence, elapsed/CPU boundary conditions, and
   all three documented process-time shapes.
5. Alert suppression emits once during one continuous suspect episode, clears
   after recovery, alerts again on a later suspect episode, and does not carry
   across PID reuse.
6. Paths containing whitespace, including the alternate home and state
   directory, are handled without word splitting.
7. Default thresholds and the existing environment override names remain
   compatible; test-only seams have safe production defaults.
8. The implementation contains no process-spawn ownership, native abort,
   signal, kill, or ledger-writing action.
9. The watchdog test is an unconditional step of `node scripts/check.mjs`.
10. The repository contains no leftover test/debug artifact or instrumentation
    token after the test run.

## Verification commands

```bash
node --test .agents/skills/watchtower-loop/lane-watchdog.test.mjs
node scripts/check.mjs
```
