---
name: encode-lessons-in-structure
description: 'Apply when you catch yourself writing the same instruction into a second brief, or when the operator corrects the same thing twice. Encode the rule as a gate step, a test, a line in AGENTS.md or a brief template, or a script — not more prose.'
---

# Encode Lessons in Structure

Encode recurring corrections in mechanisms, not in text. Every operator correction, rejected change, and
surprising outcome is a signal. Capture it, route it to the right layer, close the loop.

**Why:** prose requires the reader to notice, remember, and comply. Here the reader is often a
freshly-dispatched seat with no memory of yesterday. A mechanism holds without cooperation.

**The trigger is the second time.** In one adopting repo the watchtower wrote dozens of briefs in a day
and retyped the same three constraints into half of them. Each retyping was a missed chance to encode.

## Pick the strongest rung available

Choose the strongest mechanism the situation allows — a weaker guard becomes the next template:

1. **A state that cannot exist** — remove the footgun rather than guard it.
2. **A failing test or gate step** — `scripts/check.mjs`, a `docs-check.mjs` rule, a lint rule. It fails
   the build without anyone reading anything.
3. **A line in the contract every seat inherits** — `AGENTS.md` hard rules, `TEMPLATE-SHIP-BRIEF`, or
   `TEMPLATE-VERIFY-BRIEF`. Use this when the rule needs judgment but must reach every seat.
4. **A canonical helper** other code copies — e.g. one exported constant instead of the same string
   literal in three files.
5. **Prose in a brief** — the weakest rung. Acceptable only for genuinely one-off context.

If a rule lives at rung 5 and you are writing it a second time, promote it. Per `ENGINEERING-METHOD` §1
("Two loads"), an always-loaded line must earn its slot — a gate step costs no context at all, which is
one more reason to prefer rung 2 over rung 3.

## Route by scope

- **One-off, session-local** → the handoff or a memory note.
- **Recurring across seats** → the inherited contract (rung 3), or a gate step (rung 2).
- **Systemic** → a decision record in `DECISION-LOG` **and** the relevant playbook, so it is both tracked
  and taught. Add the smell to `DRIFT-SMELLS` if lapsing would be silent.

## Corollary: do not paper over a symptom

If the fix is structural, use *only* the structural fix. The instruction is the symptom. A brief that
warns "remember to run the integration suite" is evidence that the gate should run it, or that the
contract should carry it.

## Anti-patterns

- Acknowledging without recording — "I'll keep that in mind" does not survive a compaction.
- Recording without routing — a memory note about a lint rule that should exist is wasted until the rule
  exists.
- Fixing one instance while the pattern stays — closing the bug and leaving the class open.

Distinct from `build-the-lever`, which is about throughput and reviewability on the work in front of you.
This is about a rule that keeps recurring.
