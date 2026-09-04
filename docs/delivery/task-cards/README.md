---
id: TASK-CARDS
type: index
status: current
authority: informative
description: 'Index of delivery task cards — one bounded, reviewable task per card, per TEMPLATE-TASK-CARD.'
---

# Task cards

One card per bounded task (`TEMPLATE-TASK-CARD`); sizing rules live in
`OPERATING-MODEL`. Cards are durable: they outlive the dispatch briefs
built from them. Status lifecycle: **draft → merged | abandoned** —
durable-record states only, the terminal one written by the watchtower at
merge time. Live execution state belongs to the backlog (ergo, per
`ORC-ERGO-DELIVERY`), not here; the orc journal holds
attempt/candidate/outcome/verdict history, not live state. `dispatched`
exists only for repos without a live-state home.

| ID | Title | Status |
|---|---|---|
| `TASK-001` | [Repair lane-watchdog attribution and testability](TASK-001.md) | draft |
