---
id: TASK-004
type: task-card
status: draft
authority: normative
description: 'Add a concise repository README explaining how to run and interpret the maintained scripts.'
provenance: 'Operator request, 2026-09-04'
---

# TASK-004 — Document script usage

## Outcome

A new root `README.md` gives operators accurate copy-paste commands for the
repository gate, docs query tool, and advisory lane watchdog without replacing
the normative docs that govern their behavior.

## Governing docs

- `DOCS-ROOT`
- `HEADLESS-SEATS`
- `TASK-003`
- `ENGINEERING-METHOD`

## In scope

- Add a short root README with prerequisites and a script-oriented quick start.
- Document the supported entry points under `scripts/`, `docs/scripts/`, and
  `.agents/skills/watchtower-loop/`.
- Document persistent and bounded watchdog invocations, environment overrides,
  output meanings, and the alert-only safety boundary.
- Link the operator README from `DOCS-ROOT` while keeping normative authority
  in the registered docs.

## Out of scope

- Script, test, threshold, selector, gate, watchdog, or delivery-process
  behavior changes.
- Installation automation, package manifests, Linux instructions, or a
  cross-harness owning supervisor.
- Duplicating detailed delivery or watchdog contracts into the README.

## File territory

- `README.md`
- `docs/README.md`

Do not edit scripts, tests, task-card statuses, or the task-card index in this
task.

## Must not change

- Commands, defaults, and output labels must be derived from the current
  scripts and governing docs rather than invented.
- The README must say that watchdog output is advisory and must not imply that
  it terminates, signals, owns, or reaps processes.
- The README must direct contract questions to `DOCS-ROOT` and the relevant
  governing docs.
- Do not delete, skip, weaken, or narrow any test, gate, or check.

## Acceptance criteria

1. `README.md` identifies the macOS/zsh and Node 18+ prerequisites used by the
   maintained entry points.
2. It gives exact commands for `node scripts/check.mjs`, focused watchdog
   tests, and representative `docs/scripts/find-docs.mjs` queries.
3. It gives safe persistent and one-iteration watchdog examples, including
   `WD_TRANSCRIPT` and the role of `WD_MAX_ITERATIONS`.
4. Every watchdog environment variable and default from the script header is
   listed accurately, including threshold units and state-directory behavior.
5. `STALL:`, `ALT-SEAT STALL:`, and `HEARTBEAT:` are explained as advisory
   stdout records; the README explicitly requires manual verification before
   any process action.
6. Internal docs-check files are distinguished from supported operator entry
   points, and links to deeper docs resolve.
7. `DOCS-ROOT` links to the repository README without changing authority or
   registry semantics.
8. `node scripts/check.mjs` and `git diff --check` pass.

## Verification commands

```bash
node scripts/check.mjs
git diff --check master...HEAD
```
