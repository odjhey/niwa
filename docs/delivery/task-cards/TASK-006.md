---
id: TASK-006
type: task-card
status: draft
authority: normative
description: 'Recover the Antigravity routing policy after an orc assurance-binding defect and remove its generic stdout-stall contradiction.'
provenance: 'Successor to TASK-005 / orc run 2JVUJS, rejected candidate f5a37babcfa46647c8b6789d2503086ae4d5add3, 2026-09-04'
---

# TASK-006 — Complete Antigravity routing policy

## Outcome

The repository adopts the complete `TASK-005` Antigravity ship-routing,
verification, resume-deferral, and active-Qoder-retirement policy without
presenting buffered Antigravity stdout silence as meaningful stall evidence.

## Governing docs

- `TASK-005`
- `DOCS-ROOT`
- `OPERATING-MODEL`
- `NATIVE-SEATS`
- `HEADLESS-SEATS`
- `SEAT-RELIABILITY`
- `DECISION-LOG`
- `ORC-ERGO-DELIVERY`

## In scope

- Recover rejected `TASK-005` candidate
  `f5a37babcfa46647c8b6789d2503086ae4d5add3` onto a fresh branch.
- Qualify the generic `AGENTS.md` stall summary so Antigravity relies on its
  own attributable conversation-database evidence, never stdout or diagnostic
  log growth.
- Preserve every other `TASK-005` acceptance criterion and both approved
  decision records.

## Out of scope

- Implementing the Antigravity watchdog sensor or changing any script/test.
- Re-running Antigravity resume experiments.
- Uninstalling local Qoder files or rewriting historical merged records.
- Repairing the external orc-werk assurance-binding defect that forced this
  successor run.

## File territory

- `AGENTS.md`
- `docs/delivery/operating-model.md`
- `docs/playbooks/native-seats.md`
- `docs/playbooks/headless-seats.md`
- `docs/delivery/decisions/README.md`
- `docs/delivery/decisions/0001-antigravity-ship-routing.md`
- `docs/delivery/decisions/0002-antigravity-resume-deferral.md`

Do not edit scripts, tests, README, task cards, or the task-card index.

## Must not change

All `TASK-005` must-not-change requirements remain binding. In particular,
stdout and `--log-file` growth are not Antigravity progress evidence, and no
ship model family may verify its own candidate.

## Acceptance criteria

1. All nine `TASK-005` acceptance criteria pass on the recovered candidate.
2. `AGENTS.md` does not apply its generic output-silence rule to Antigravity;
   it points Antigravity stall claims to process-owned conversation `.db` and
   `.db-wal` evidence defined in `HEADLESS-SEATS`.
3. No active doc contradicts Antigravity's buffered-stdout or diagnostic-log
   semantics.
4. Only the authorized policy/decision files differ from trunk.
5. `node scripts/check.mjs`, `git diff --check`, and the active-doc Qoder sweep
   pass.

## Verification commands

```bash
node scripts/check.mjs
git diff --check master...HEAD
rg -n -i '\bqoder\b' AGENTS.md docs \
  --glob '!docs/delivery/task-cards/TASK-001.md' \
  --glob '!docs/delivery/task-cards/TASK-005.md' \
  --glob '!docs/delivery/task-cards/TASK-006.md'
```
