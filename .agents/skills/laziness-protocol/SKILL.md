---
name: laziness-protocol
description: 'Apply when refactoring, sizing a diff, writing a brief, or tempted to add a layer, an abstraction, or a new script. Bias toward deletion, toward repairing what exists, and toward the smallest change that solves the problem.'
---

# Laziness Protocol

Writing code and prose is cheap for you, which makes over-engineering easy. Borrow a human maintainer's
fatigue. Aim for the most result with the least code and complexity.

- **Prefer deletion.** When asked to refactor or improve, look for removals first. A never-failing
  assertion is *deleted* rather than patched — deleting it removes a false coverage signal that a fix
  would have preserved.
- **Repair before you rebuild.** Before proposing new tooling, check whether it already exists and
  whether the laziest correct move is fixing the one broken assumption inside it. Writing a second suite
  next to a broken first one is the expensive path.
- **Maintain a flat call hierarchy.** If answering a question needs tracing more than three files or
  layers, flatten it.
- **Consolidate decisions.** Do not repeat the same choice in several places. One source of truth, then
  pass the result. Three files each holding the same literal means a rename in one silently breaks the
  other two.
- **Minimize the diff.** The smallest change that solves the problem. Fewer lines beat elegant
  boilerplate.
- **Question the threading.** If a task asks you to pass a new signal through types, schemas, and
  pipelines, stop and look for a more direct path — an observer injected at a composition boundary often
  beats changing a published interface to carry it.
- **Sweat the small leaks.** Tiny pass-throughs and duplicated choices compound into permanent
  coordination cost.

## Laziness applies to briefs and docs too

A brief that restates what `AGENTS.md` and `TEMPLATE-SHIP-BRIEF` already carry is duplication with drift.
Say the task-specific part; inherit the rest.

The same holds for documentation: a new doc that repeats an existing one is a maintenance liability
(`ENGINEERING-METHOD` §1, "a doc that restates the environment is a cache"). Link, do not restate.

## Where laziness does NOT apply

Verification. Running the real thing, reproducing a claim against the actual artifact, and the named
probes in `TEMPLATE-VERIFY-BRIEF` are not optional effort to be trimmed — they are the effort that makes
everything else cheap. Be lazy about building; never about proving.

**Prime directive:** if a human maintainer would find it exhausting, it is a bad solution. Be lazy. Stay
simple.

Related: `build-the-lever` (build the smallest thing that does or proves the job) and
`encode-lessons-in-structure` (promote a repeated instruction to a mechanism instead of retyping it).
