---
name: delivery-loop
description: 'Ship-seat delivery protocol for this repo — working a claimed task in its worktree and recording the outcome into the orc ledger. Use when executing a ship or fix-round brief, when a brief names an orc run id, or before reporting a task done.'
---

# Ship-seat delivery loop

You are the **execution seat** for exactly one task: one worktree
under `.worktrees/<branch>`, one branch, one orc run. The full method
contract is `docs/delivery/orc-ergo-delivery.md`
(`ORC-ERGO-DELIVERY`); generic orc seat discipline is the
`orc-ledger` skill. This skill is the ship-side sequence.

`orc` below means the repo's canonical invocation, verbatim from
`ORC-ERGO-DELIVERY` §1 (aliases do not survive into spawned
processes); your brief carries it in full.

`<root>` is the primary checkout root (not your worktree); the
journal is always `<root>/.orc`.

## The sequence

1. **Orient.** Your brief names the run id and branch. If unsure of
   the run's state: `orc status <run-id> --journal <root>/.orc`
   (read-only) and trust its `next:` block over memory. **Never run
   `orc dispatch`** — dispatch is watchtower-only, including as a
   "just check where things are" move; the generic `orc-ledger`
   skill's advice to re-dispatch when unsure does not apply here
   (`ORC-ERGO-DELIVERY` §6).
2. **Work.** Complete the brief in your worktree. Gate green before
   anything else: `node scripts/check.mjs`.
3. **Record — before your worktree can be torn down** ("settle
   before reaping"):

       orc record <run-id> --work work-1 --outcome completed --evidence-ref "branch:<branch>" --model <your-model> --seat-ref <your-seat> --journal <root>/.orc

   Unsuccessful finish: `--outcome failed` with the reason as an
   evidence ref. Recording a false `completed` is a hard stop —
   the outcome you record is an observation, not an aspiration.
4. **Report** back as usual: scope, governing doc IDs, gate output,
   "Ambiguities encountered", plus the run id.

## Boundaries

- You never record a verdict (`--verdict` is the assurance seat's —
  no self-assurance, ever), never merge, never dispatch, never touch
  ergo state, and never edit the task card's status (the watchtower
  writes `merged`/`abandoned` at merge time).
- `--outcome` never sets candidate identity; the watchtower's next
  dispatch derives your branch head automatically. Do not hand-edit
  the run config.
- A fix-round brief means a rejected verdict opened a new attempt:
  fix on the **same branch**, addressing the findings the brief
  carries, then repeat steps 2–4.
- A refused command (permission, sandbox) is reported, never worked
  around; the watchtower can transcribe your recording on your
  behalf.
- Where the generic `orc-ledger` skill and `ORC-ERGO-DELIVERY`
  disagree, `ORC-ERGO-DELIVERY` governs in this repo.
