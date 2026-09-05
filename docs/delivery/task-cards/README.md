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
| `TASK-001` | [Repair lane-watchdog attribution and testability](TASK-001.md) | merged |
| `TASK-002` | [Harden watchdog command contracts and marker cleanup](TASK-002.md) | abandoned |
| `TASK-003` | [Complete watchdog state synchronization](TASK-003.md) | merged |
| `TASK-004` | [Document script usage](TASK-004.md) | merged |
| `TASK-005` | [Adopt Antigravity ship lanes](TASK-005.md) | abandoned |
| `TASK-006` | [Complete Antigravity routing policy](TASK-006.md) | merged |
| `TASK-007` | [Detect stalled Antigravity lanes](TASK-007.md) | merged |
| `TASK-008` | [Remove ADC auth from Antigravity routing](TASK-008.md) | merged |
| `TASK-009` | [Publish cross-project lane-supervision adoption guide](TASK-009.md) | merged |
