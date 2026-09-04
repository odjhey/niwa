---
id: WALKTHROUGH-CORPUS
type: index
status: current
authority: informative
description: 'User-perspective walkthrough scenarios the checker runs against the real surface after major merges — scenario format, concern tags, PASS/BUG/FRICTION reporting.'
---

# Walkthrough corpus

Scenarios exercised by the **user-perspective checker** (`OPERATING-MODEL`,
Roles): a read-only agent that walks the real surface (the CLI, app, or API
itself — never the test suite) after a major merge and reports what a user
would actually experience. If the repo delivers a tool its own delivery
uses, these are dogfood scenarios; otherwise they are demo-journey
walkthroughs — use the honest name for your project.

Scenarios accumulate as user journeys stabilize. Each step distinguishes a
**runnable surface from work that is still pending**, so the checker never
reports a roadmap step as observed behavior.

Executions are recorded one-file-per-run under `runs/`
(`WALKTHROUGH-RUNS`), indexed in its README.

## Scenarios

| Scenario | Concerns | Journey |
|---|---|---|
| *(none yet — add `001-<slug>.md` when the first user journey exists)* | | |

## Scenario format

One file per scenario, `NNN-short-slug.md`:

```markdown
---
id: WALKTHROUGH-NNN
type: reference
status: current
authority: informative
description: 'One sentence — the user goal this scenario walks.'
---

# NNN — Title

**Concerns:** <comma-separated tags the watchtower intersects with a
shipped change to select which scenarios to run>

## Preconditions

State and setup required, with exact commands.

## Steps (Today)

Numbered steps against the surface that exists now — exact commands or
clicks, each with the expected observable result.

## Pending

Steps of this journey that are not yet runnable, marked clearly so they are
never reported as observed.

## Report

One line per step: PASS | BUG | FRICTION, with evidence (command, exit
code, output excerpt). BUG = wrong behavior; FRICTION = correct but
confusing, laborious, or ugly. Every BUG/FRICTION finding routes to a task,
issue, or docs amendment — never left unfiled.
```
