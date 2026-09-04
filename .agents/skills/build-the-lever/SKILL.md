---
name: build-the-lever
description: 'Apply to any non-trivial work — a migration, a sweep, a check, or anything fanned out to seats. Build the tool or the skill that does it, instead of doing it by hand or re-explaining it per brief. The artifact is what a reviewer reruns.'
---

# Build the Lever

When work is not trivial, build the thing that does it — or proves it — instead of doing it by hand.

**Why:** throughput, and confidence. A script runs the same way every time and reruns for free. It is one
artifact a reviewer can read and re-execute. Hand-done work can only be re-verified by redoing it.

**Pattern:** default to building the lever. Skip it only when the task is genuinely trivial.

- Do the first unit by hand to learn the recipe, then build the tool and rerun it on that unit, diffing
  against your hand-done version.
- Make the lever safe to rerun. A reviewer will rerun it.
- Commit it when the work outlives the session.

## When work fans out to seats, the lever is often a skill or a template

When the watchtower dispatches the same shape of work to several seats, **the recipe, the verification
contract, and the do-not-touch fences belong in one artifact every seat reads** — `AGENTS.md`, the brief
templates (`TEMPLATE-SHIP-BRIEF`, `TEMPLATE-VERIFY-BRIEF`), or a skill under `.agents/skills/` — not
re-explained per brief, where each copy drifts. Keep that artifact outside the seats' write scope so they
cannot quietly edit the contract.

Evidence from an adopting repo: dozens of briefs written in one day, with the same handful of constraints
retyped into a third to half of them. That repetition *was* the missing lever.

## Check whether the lever already exists

Look before you build: `scripts/`, `docs/scripts/`, `.agents/skills/`, and the templates. **Then check
the existing lever actually runs** — in one adopting repo, a dozen dispatches were hand-assembled before
anyone tried the script that already existed, and it failed on first run because of one broken
assumption. An unrunnable tool is why nobody used it, and repairing it beats writing a second one
(`laziness-protocol`, "Repair before you rebuild").

## Shapes that fit here

- a `scripts/*.mjs` (Node, stdlib only) with a co-located `*.test.mjs`, following
  `docs/scripts/docs-check.mjs` and its test;
- a step in the local gate, `scripts/check.mjs`, when the lever should fail the build;
- a skill under `.agents/skills/` when the consumers are agents;
- a rerunnable check whose output is the evidence, per `ENGINEERING-METHOD` §3 (Verifying work);
- a throwaway harness outside git for a one-time live proof — still write it down in the report.

**Balance:** the bar is triviality, not repetition. A one-off earns a lever when the lever is what makes
the work checkable. Per `laziness-protocol`, build the smallest thing that does or proves the job — never
a framework.

**If you cited this principle and there is no script, generator, template, or skill in the diff, you did
not apply it.**

Related: `encode-lessons-in-structure` is about a *rule* that keeps recurring; this skill is about
throughput and reviewability on the work in front of you.
