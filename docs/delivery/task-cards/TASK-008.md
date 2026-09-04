---
id: TASK-008
type: task-card
status: merged
authority: normative
description: 'Remove ADC authentication from active Antigravity ship invocations and use the operator-configured plain agy command.'
provenance: 'Operator billing-route correction, 2026-09-04'
---

# TASK-008 — Remove ADC auth from Antigravity routing

## Outcome

Active delivery instructions launch Antigravity through the operator's normal
configured account using plain `agy`; they never set `AGY_ADC_AUTH=true`.

## Governing docs

- `TASK-006`
- `HEADLESS-SEATS`
- `DECISION-LOG`
- `ORC-ERGO-DELIVERY`

## In scope

- Replace active Antigravity ship commands with plain
  `agy --model "Gemini 3.8 Flash (High)" ...`.
- Record the operator's billing-route correction as an approved decision and
  mark the older command choice superseded in part without erasing history.
- Keep the model, timeout, file-backed brief, output capture, diagnostics, and
  completion-corroboration requirements unchanged.

## Out of scope

- Changing or inspecting the operator's Antigravity credentials, account, ADC
  configuration, billing setup, or local installation.
- Rewriting historical task cards, orc/ergo records, or dogfood artifacts.
- Implementing the Antigravity watchdog sensor; `TASK-007` owns it.
- Antigravity resume behavior or any script/test change.

## File territory

- `AGENTS.md`
- `docs/playbooks/headless-seats.md`
- `docs/delivery/decisions/README.md`
- `docs/delivery/decisions/0001-antigravity-ship-routing.md`
- New operator-auth-routing decision under `docs/delivery/decisions/`

Do not edit scripts, tests, README, task cards, or the task-card index.

## Must not change

- Antigravity remains the default ship seat with `Gemini 3.8 Flash (High)` and
  a sized explicit 20-minute timeout ceiling.
- Ship output and stderr remain captured and corroborated; logs remain
  diagnostic rather than progress evidence.
- Authentication failures are reported and never bypassed by restoring ADC or
  mutating credentials.
- Do not delete, skip, weaken, or narrow tests or checks.

## Acceptance criteria

1. Active `AGENTS.md` and `HEADLESS-SEATS` commands invoke plain `agy` and
   contain no `AGY_ADC_AUTH` assignment or recommendation.
2. The exact model, dangerous-permissions flag, print mode, 20-minute timeout,
   brief-file pointer, stdout/stderr capture, and completion checks remain.
3. A new `Review: approved`, operator-decided record explains the billing-route
   correction; `DECISION-0001` points to it as superseding only the auth prefix.
4. Historical task cards and delivery artifacts remain unchanged.
5. No script, test, gate, README, dependency, or unrelated policy change.
6. `agy --version`, `agy --help`, a plain `agy models` lookup, the active-doc
   auth-prefix sweep, `node scripts/check.mjs`, and `git diff --check` pass.

## Verification commands

```bash
agy --version
agy --help
agy models
rg -n 'AGY_ADC_AUTH' AGENTS.md docs \
  --glob '!docs/delivery/task-cards/TASK-005.md' \
  --glob '!docs/delivery/task-cards/TASK-006.md' \
  --glob '!docs/delivery/task-cards/TASK-008.md' \
  --glob '!docs/delivery/decisions/0001-antigravity-ship-routing.md'
node scripts/check.mjs
git diff --check master...HEAD
```
