---
id: DRIFT-SMELLS
type: playbook
status: current
authority: informative
description: 'Health-check checklist — the drift smells that mean a load-bearing practice has quietly stopped being true.'
---

# Drift smells

If something feels off, compare current practice against this list — the
drift is probably in whichever load-bearing practice quietly stopped being
true. Each entry pairs the practice (from `OPERATING-MODEL` /
`ENGINEERING-METHOD`) with its smell. Run this as a deliberate review at
milestone boundaries, not only when trouble is already visible.

| Practice | Drift smell |
|---|---|
| Verification with teeth, findings fixed pre-merge | Audit verdicts coming back clean-clean-clean (verifiers gone soft); findings "tracked as follow-ups" that never land; merge-then-patch creeping back |
| Docs lead code, checked both directions | Code semantics that exist nowhere in docs; shippers "resolving" ambiguity inline; a green docs check mistaken for docs being *correct* |
| Falsifiability proven, not assumed | Green suites nobody has ever seen fail; test counts rising while nobody re-checks that violations still turn the suite red |
| Operator steers at the right altitude | The operator (or watchtower) deciding implementation details; nobody asking the uncomfortable framing questions anymore |
| Resequencing absorbs into docs | Defending the plan against what usage is telling you; or resequencing constantly without absorbing the changes into docs |
| Every decision findable, every deferral triggered | Decisions that exist only in a conversation; "we'll handle that later" without a named trigger; known issues living in someone's head |
| Small tasks, zero-ambiguity dispatch | Mega-changes; shipper briefs that require judgment calls; parallel lanes fighting over the same files |
| Dormant-until-pulled | Building something whose trigger never fired; a "later" item with no trigger named — that is a wish, not a plan |
| User-perspective findings routed same-day | Rough edges everyone knows about that no task, issue, or docs amendment records; the walkthrough runs log stale relative to merge activity |
| Watchtower sizes dispatches, splits before dispatching | Ship reports that read like campaign logs; a dispatch running several times the healthy minutes-to-a-quarter-hour; the strong tier used for mechanical rounds, or the default tier grinding through interlocking contract decisions |
| No fact has two homes (`ORC-ERGO-DELIVERY`) | A task card carrying live state (`dispatched`, "in flight"); an orc run ACCEPTED whose candidate is not on trunk; an ergo task `done` with no result line; a seat re-dispatching "to see where things are" |
| Seat policy rests on measured evidence | A seat added to the table without a `SEAT-RELIABILITY` trial; stalls tolerated by habit instead of logged; a lane killed on an alert nobody verified |
| Decide-and-record keeps agents moving, queue gets reviewed | Shippers stopping on naming/layout choices (over-stopping); or the opposite — contract-level calls filed as "local" decisions; `review: pending` records accumulating with no review-session files |

## Calibrating audit cost

The adversarial pipeline is expensive per change. It pays while audits find
real defects. If several consecutive audits come back clean, **downscale
deliberately** — spot-audit, or direct-review small artifacts that codify
already-audited rulings (auditing those is circular) — and record the
downscale as a ruling in `DECISION-LOG`. Never let the practice silently
lapse: the failure mode is not "we audit too much", it is "nobody noticed
we stopped".

The inverse trigger: the first real defect an audit finds after a downscale
restores the full pipeline.
