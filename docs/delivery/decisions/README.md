---
id: DECISION-LOG
type: ledger
status: current
authority: informative
description: 'Decision-record convention and index — the async review queue for choices made where the docs are silent, plus deferrals with forcing triggers.'
---

# Decision records

One file per decision, named `NNNN-short-slug.md`, in this directory,
indexed below. Entries are numbered in rough chronological order and
**never renumbered**; a superseded entry says so in place and points
forward.

The directory is the **async review queue**: agents make local choices
without waiting, record them here as `review: pending`, and the operator's
check-in is a scan of this directory instead of a live review. Check-in
sessions are recorded one-file-per-session under `reviews/`
(`DECISION-REVIEW-LOG`). **Review cadence:** when 3+ entries are
`review: pending`, or the oldest pending entry is more than 7 days old,
the next operator session opens with a batch review of all pending
entries.

## The projection principle (docs run ahead of review)

The normative docs are the **projection** of every decision made so
far: a reader gets current semantics from the normative docs alone,
never by chasing ledger references. Records, sweep reviews, and task
cards are the dig-when-needed history behind that projection.

Because decide-and-record applies a ruling to the docs in the same
commit that files its record, the projection deliberately runs **ahead
of operator review**. This is the chosen operating posture — get work
done on the current docs now, pivot later if review says otherwise: an
operator review that amends or rejects a pending ruling produces a
redesign/repair task against the amended ruling, handled as normal
follow-up work, never as retroactive fault. Waiting on review is never
the default; pivoting on review is. Pending-review counts are a health
signal for review cadence, not a work blocker.

## The ambiguity split (what gets recorded vs what stops)

Blanket stop-and-report over-stops: shippers park work on choices the docs
were never going to specify (naming, layout, tooling detail), and operator
throughput becomes the bottleneck. So ambiguity splits by what it touches:

- **Contract-level** (a normative doc, interface, or published behavior) —
  **stop-and-report**. Park that scope, record it under "Ambiguities
  encountered", and let the docs be amended before dependent code lands.
- **Local/mechanical** (naming, layout, tooling detail, an implementation
  choice the docs are silent on) — **decide-and-record**. Implement your
  recommendation and write a `review: pending` decision record; do not wait.

Hard stops are never decide-and-record: changing approved normative
behavior, weakening the security posture, adding a forbidden dependency,
bypassing an architecture rule (see `AGENTS.md`).

## Scope

Product-contract rationale (why the normative docs say what they say) and
how-we-work delivery rulings share this one numbered sequence — one place
for the operator to scan beats a cleaner separation on paper. A repo with
versioned product docs may **version-scope** the ledger (e.g.
`docs/delivery/v1.x/decisions/`): a new version starts a fresh ledger
under its own directory, and the old one stays behind as the archived
trail.

## What earns a record

Record a ruling when it is (1) hard to reverse, (2) surprising without its
context, or (3) the outcome of a real trade-off. Absent all three it is
probably a no-op the next reader would have chosen anyway. The
highest-value records are the explicit **no**s and deliberate deviations
from the obvious path — "do not re-litigate this" is an anti-regression
guard for a future agent.

**Temporary process relaxations are themselves decisions** with a named end
trigger ("relaxed until <observable event>"), so the relaxation cannot
silently become the norm.

For deferrals, classify honestly:

- **Dormant** — a question sharp enough to phrase now, parked with a named
  trigger. When the trigger fires, the executing agent inherits a decided
  shape instead of an open debate. A dormant item without a named trigger
  is a defect in this queue.
- **Fog** — work you cannot yet frame precisely. Leave it as fog; do not
  force it into a record to feel productive.
- **Out of scope** — past the destination. It never graduates in place; it
  returns only as a fresh effort if the destination is redrawn.

## Record format

```markdown
---
id: DECISION-NNNN
type: decision
status: current            # current | superseded
authority: informative
description: 'One sentence.'
---

# NNNN — Title

**Kind:** ruling | deferral
**Review:** pending | approved | approved-with-follow-ups | rejected
**Decided by:** operator | agent recommendation
**Provenance:** <session/PR/issue and date this came from>

## Context

Why this needed a decision.

## Options considered

- Option A — trade-offs
- Option B — trade-offs

## Choice

What was picked (or, for a deferral, the precise parked question and its
**trigger**).

## Consequences

What this commits us to; what it forecloses. Checkable invariants it
creates, so tooling can enforce them.
```

Supersede in place: a revised decision gets a dated update appended with
evidence, and the old claim is marked `superseded`, never deleted — the
evolution is signal (`ENGINEERING-METHOD` §5).

## Index

Keep this table current — it is the queue's table of contents; the files
are the searchable detail.

| # | Title | Review |
|---|---|---|
| [0001](0001-antigravity-ship-routing.md) | Antigravity ship routing and assurance simplification | approved |
| [0002](0002-antigravity-resume-deferral.md) | Antigravity session resume deferral | approved |
