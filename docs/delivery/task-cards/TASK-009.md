---
id: TASK-009
type: task-card
status: merged
authority: normative
description: 'Publish one cross-project adoption entry point for lane supervision without importing Niwa seat policy.'
provenance: 'Operator request for a portable handoff to projects with independent seat policies, 2026-09-04'
---

# TASK-009 — Publish cross-project lane-supervision adoption guide

## Outcome

A project or agent can start from one stable document, adopt or adapt the
lane-supervision lever safely, and distinguish the detector's evidence and
safety invariants from Niwa-specific seat, provider, account, timeout,
verification, and delivery policy.

## Governing docs

- `DOCS-ROOT`
- `DOC-WRITING-GUIDELINES`
- `HEADLESS-SEATS`
- `TASK-007`
- `OPERATING-MODEL`

## In scope

- Add a registered `LANE-SUPERVISION-ADOPTION` playbook as the single
  cross-project handoff entry point.
- Give adopting agents a bounded adoption workflow, local-policy declaration,
  artifact/source map, verification steps, and a copyable handoff prompt.
- State the watchdog's platform and topology limits, including machine-wide
  candidate discovery and the absence of project/process ownership.
- Link the entry point from the root usage guide and relevant headless/watchtower
  guidance.
- Correct stale pre-implementation wording in `HEADLESS-SEATS` and inaccurate
  session-scoping wording in the watchtower skill without changing behavior.

## Out of scope

- Changing the watchdog, tests, thresholds, output, or gate behavior.
- Selecting another project's seats, models, providers, accounts, verifier
  count, delivery ledger, timeout, correction strategy, or remediation policy.
- Adding project attribution, automatic process action, Linux support, an
  installer, package, generator, or dependency.
- Rewriting Niwa's current seat policy or historical decisions/task cards.

Project-specific alert ownership is not resolved by this task. The guide must
surface the current limitation and require an adopter to stop or define its own
verified integration when project-specific ownership is required.

## File territory

- New `docs/playbooks/lane-supervision-adoption.md`
- `docs/README.md`
- `README.md`
- `docs/playbooks/headless-seats.md`
- `.agents/skills/watchtower-loop/SKILL.md`
- `docs/delivery/task-cards/TASK-009.md` and the `TASK-CARDS` index

Do not edit watchdog source/tests, `AGENTS.md`, decisions, templates, delivery
contracts, or scripts.

## Must not change

- The existing detector remains alert-only, macOS/zsh-only, process-owned in
  its progress evidence, and fail-closed on incomplete discovery.
- Niwa continues to use its current plain-`agy` routing and independent
  verification policy; those values are examples, not downstream defaults.
- A downstream project keeps authority over its own seat and remediation
  policy.
- Do not delete, skip, weaken, or narrow tests or checks.

## Acceptance criteria

1. `LANE-SUPERVISION-ADOPTION` is registered and explicitly identifies itself
   as the one document to give a new project or agent first.
2. The guide separates three things: reusable detector invariants, Niwa's local
   examples, and decisions every adopting project owns.
3. A local-policy declaration covers at least seat/provider/model routing,
   authentication/account routing, verifier independence/count, timeout and
   correction behavior, monitor ownership/topology, remediation authority,
   platform support, and gate integration. It never silently supplies Niwa's
   values as requirements.
4. Adoption modes distinguish vendoring the script+test pair from using the
   evidence model to implement a local detector. Partial copying cannot be
   represented as verified compatibility.
5. The guide states that candidate discovery is machine-wide, the tool does not
   establish project or process ownership, shared state yields one claimant
   rather than deterministic project routing, and separate state can duplicate
   alerts. Project-specific ownership is a stop/adapt condition.
6. Installation and upgrade steps pin source identity, preserve the script/test
   pair, run syntax/focused/full-gate checks, use a bounded isolated probe, and
   keep alerts advisory until manually corroborated.
7. The guide includes a concise copyable handoff prompt telling an agent to
   read this ID first, inspect local policy before editing, declare adaptations,
   and avoid importing Niwa policy by default.
8. Root README, `HEADLESS-SEATS`, and the watchtower skill link to the guide;
   stale “successor/proposed watchdog” language and false session-scoping claims
   are corrected without expanding script behavior.
9. No watchdog source/test, gate, dependency, decision, template, `AGENTS.md`,
   or unrelated behavior change.
10. Documentation query, link/frontmatter checks, full gate, and diff checks
    pass.

## Verification commands

```bash
node docs/scripts/find-docs.mjs --id LANE-SUPERVISION-ADOPTION
rg -n 'LANE-SUPERVISION-ADOPTION' README.md docs/README.md \
  docs/playbooks/headless-seats.md .agents/skills/watchtower-loop/SKILL.md
/bin/zsh -n .agents/skills/watchtower-loop/lane-watchdog.sh
node --test .agents/skills/watchtower-loop/lane-watchdog.test.mjs
node scripts/check.mjs
git diff --check master...HEAD
```
