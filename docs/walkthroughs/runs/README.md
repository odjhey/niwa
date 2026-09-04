---
id: WALKTHROUGH-RUNS
type: index
status: current
authority: informative
description: 'Index of walkthrough executions — one file per run, table of contents here; the seed of a future automated e2e suite.'
---

# Walkthrough runs

One file per execution — by the user-perspective checker, by a verifier
running "Today" steps during adversarial review, or by a demo rehearsal —
named `YYYY-MM-DD-NN.md` (`NN` = ordinal that day). Past runs are never
edited. The watchtower checks this index's recency each session
(`OPERATING-MODEL`, Continuity) and prompts the operator when it has gone
stale relative to merge activity.

## Run file format

```markdown
---
id: WALKTHROUGH-RUN-YYYY-MM-DD-NN
type: ledger
status: current
authority: informative
description: 'One sentence — scenarios run and overall result.'
---

# Run YYYY-MM-DD-NN

**Trunk commit:** <sha>  **Runner:** <role> **Source:** <dispatch/PR/rehearsal>

| Scenario | Step | Result | Evidence |
|---|---|---|---|
| 001 | 3 | PASS | `<command>` exit 0, output excerpt |
| 001 | 4 | FRICTION | confusing error text; filed issue #NN |
```

Every BUG/FRICTION row names where it was routed (task, issue, or docs
amendment) — never left unfiled.

## Runs

| Date | Run | Trunk commit | Scenarios | Result |
|---|---|---|---|---|
| *(none yet)* | | | | |
