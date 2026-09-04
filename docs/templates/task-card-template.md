---
id: TEMPLATE-TASK-CARD
type: template
status: current
authority: informative
description: 'Template for a bounded delivery task card — the durable, reviewable definition of one task.'
---

# Task card template

A task card is the **durable** record of one bounded task: what it claims to
implement, what bounds it, and how done is checked. It outlives the dispatch
(the just-in-time brief built from it — see `TEMPLATE-SHIP-BRIEF`). Keep the
card path-light and command-light except where a command *is* the acceptance
criterion; the brief is where command-exactness lives
(`ENGINEERING-METHOD` §5, two artifact tiers).

Sizing rules live in `OPERATING-MODEL` (Task sizing): one card = one
reviewable claim, zero unresolved ambiguities, checkable definition of done.
A card you cannot fill in completely is not ready to dispatch — the gap goes
back to a scout or a docs change first.

A card carries **durable-record states only**: `draft` when authored, then
`merged` or `abandoned`, written by the watchtower at merge (or abandonment)
time. Live execution state — claimed, in flight, awaiting assurance,
blocked — belongs to the backlog (ergo, under `ORC-ERGO-DELIVERY`), never
to the card; the orc journal holds attempt/candidate/outcome/verdict
history, not live state. The `dispatched` status exists only for repos
that run without a live-state home; a repo that has one retires it for
new cards.

Copy the block below into `docs/delivery/task-cards/TASK-<id>.md` and add
the card to the `TASK-CARDS` index. Fill every section; when one is
genuinely empty, write "None." rather than deleting the heading, so a
reviewer can tell "empty" from "forgotten".

```markdown
---
id: TASK-XXX
type: task-card
status: draft            # draft → merged | abandoned (see ORC-ERGO-DELIVERY)
authority: normative
description: 'One-line statement of the bounded task.'
provenance: '<repo/session/date or issue link that originated this task>'
---

# TASK-XXX — Title

## Outcome

One paragraph: the state of the world after this task merges, stated as the
reviewable claim ("implements <doc IDs>").

## Governing docs

Stable IDs of the docs this task implements or is constrained by.

## In scope

## Out of scope

Name what a reasonable implementer might otherwise include. "Out of scope"
items that are deferred decisions get an entry in `DECISION-LOG` with a
trigger.

## File territory

Files/directories this task owns. If dispatched in parallel with siblings,
name the boundary explicitly ("do NOT touch X; TASK-YYY owns it").

## Must not change

Contracts, interfaces, tests, and behavior that must survive this task
untouched. Includes the standing rule: no deleting, skipping, weakening, or
narrowing tests or checks to make them pass.

## Acceptance criteria

Enumerable and checkable — never "make it work". Each criterion is something
a verifier can confirm or refute against the diff or a command's output.

## Verification commands

The exact commands whose output demonstrates the acceptance criteria, ending
with `node scripts/check.mjs`.
```
