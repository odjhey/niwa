---
id: DECISION-REVIEW-LOG
type: index
status: current
authority: informative
description: 'Index of operator review sessions over accumulated review-pending decision records — one file per session, table of contents here.'
---

# Decision review sessions

One file per operator check-in over accumulated `review: pending` records,
named `YYYY-MM-DD.md` (suffix `-2`, `-3` for a second session the same
day). Past sessions are never edited; corrections land as a new session
file. The watchtower checks this index's recency each session and prompts
the operator when the pending queue is stale.

## Session file format

```markdown
---
id: DECISION-REVIEW-YYYY-MM-DD
type: ledger
status: current
authority: informative
description: 'One sentence — which decisions this session reviewed.'
---

# Review session YYYY-MM-DD

| Decision | Outcome | Notes / follow-ups |
|---|---|---|
| 0007 | approved | |
| 0008 | approved-with-follow-ups | weighting revisit → issue #NN |
| 0009 | rejected | rework dispatched as corrective task |
```

Update each reviewed decision's own `Review:` line in the same change.

## Sessions

| Date | Decisions reviewed | Outcomes |
|---|---|---|
| *(none yet)* | | |
