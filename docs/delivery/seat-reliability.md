---
id: SEAT-RELIABILITY
type: reference
status: current
authority: informative
description: 'Operational reliability log for external seats — launches, stalls, time-to-verdict, finding quality — and the evidence base for seat-policy rulings and seat trials.'
---

# Seat reliability log

Per-dispatch telemetry for external seats (verification seats above
all: they are the ones whose silence costs the most). A seat earns a
place in the `AGENTS.md` seat table on **measured evidence from this
log**, never on a model roster — the protocol is a bounded trial
(typically five paired rounds on byte-identical briefs), a closing
tally, and an operator ruling recorded in `DECISION-LOG`. Stall
thresholds and verified invocations live in `AGENTS.md` (Seat
defaults) and `HEADLESS-SEATS`; this file is the incident log and the
tally, not the policy.

Times local; date each row.

## Incident history

| # | Date | Seat | Brief | Outcome | Detail |
|---|---|---|---|---|---|
| *(none yet)* | | | | | |

Keep a running tally per seat beneath the table: launches, stalls
(count and %), bad verdicts.

## Paired runs (seat trial)

One row per seat per round; rounds share a brief and a candidate.

| Round | Brief (candidate) | Seat | t-first-output | t-verdict | Stalls | Verdict | Findings (B/M/m) | Notes |
|---|---|---|---|---|---|---|---|---|
| *(none yet)* | | | | | | | | |

For a trial seat, classify its findings against the seats of record:
**shared**, **unique-and-real**, or **false**. Unique-and-real findings
are the case for promotion; false ones the case against.

## Adjudications

One entry per paired round: which verdict became the verdict of
record (the union of confirmed findings, never the weaker verdict),
which orc run it was recorded to, and any disagreement between seats —
disagreements are data.

## Root-cause notes

Dated notes on stall signatures and what ruled hypotheses in or out
(e.g. "process alive, <0.1s CPU, no own rollout file = startup hang;
contention ruled out by a 6s smoke test under load"). Detection rules
that survive go into the watchdog script header and `HEADLESS-SEATS`.

## Closing tally

When a trial's named end is reached: the per-seat totals, the
recommendation, and the operator's pick — then the `DECISION-LOG`
entry that enacts it.
