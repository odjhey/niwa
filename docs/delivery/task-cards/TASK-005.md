---
id: TASK-005
type: task-card
status: draft
authority: normative
description: 'Adopt Antigravity as the default ship seat, simplify assurance routing, and retire active Qoder support.'
provenance: 'Operator ruling and Antigravity 1.1.26 dogfood, 2026-09-04'
---

# TASK-005 — Adopt Antigravity ship lanes

## Outcome

The delivery method launches ordinary and large ship work through Antigravity
using `Gemini 3.8 Flash (High)`, keeps GPT-5.6 Luna as the independent default
verifier, and no longer advertises Qoder as an active seat. Watchtower defaults
to GPT-5.6 Sol at `xhigh` reasoning.

## Governing docs

- `DOCS-ROOT`
- `OPERATING-MODEL`
- `NATIVE-SEATS`
- `HEADLESS-SEATS`
- `SEAT-RELIABILITY`
- `DECISION-LOG`
- `ORC-ERGO-DELIVERY`

## In scope

- Update the concrete seat defaults and routing in `AGENTS.md`.
- Document the verified Antigravity 1.1.26 print-mode invocation, output and
  process evidence, timeout behavior, and fresh-session corrective policy.
- Replace final-round paired verification with one GPT-5.6 Luna verifier.
  Security/trust-model changes retain a second independent-provider verifier;
  an untrialed fallback does not become a standing seat without
  `SEAT-RELIABILITY` evidence.
- Remove Qoder from active delivery and seat playbooks.
- Record the operator's routing ruling and the explicit Antigravity-resume
  deferral, including its forcing trigger, in `DECISION-LOG`.

## Out of scope

- Implementing an Antigravity watchdog sensor; a successor card will own the
  deterministic implementation and live alert-only dogfood.
- Uninstalling the operator's local `~/.qoder` executable or configuration.
- Rewriting historical merged task cards or historical delivery records that
  mention Qoder.
- Automatic termination, process ownership, or a cross-harness supervisor.
- Evaluating or adopting Antigravity conversation resume flags.

## File territory

- `AGENTS.md`
- `docs/delivery/operating-model.md`
- `docs/playbooks/native-seats.md`
- `docs/playbooks/headless-seats.md`
- `docs/delivery/decisions/README.md`
- New decision records under `docs/delivery/decisions/`

Do not edit scripts, tests, README, task cards, or the task-card index.

## Must not change

- Orc remains scripted and does not spawn seats.
- Watchtower, ship, and verifier permissions and ledger ownership remain
  unchanged.
- A ship model family must not verify its own candidate.
- Security/trust-model work retains independent-provider paired assurance;
  ordinary and final-convergence work uses only the default verifier.
- Historical records remain durable and are not rewritten to erase Qoder.
- Refusals, permission failures, empty output, nonzero exit, and timeouts are
  reported rather than bypassed.
- Do not delete, skip, weaken, or narrow tests or checks.

## Acceptance criteria

1. `AGENTS.md` sets Watchtower to GPT-5.6 Sol `xhigh`, both ship tiers to
   Antigravity `Gemini 3.8 Flash (High)`, recon to GPT-5.6 Sol `high`, and the
   default verifier to GPT-5.6 Luna `high`.
2. The default ship command preserves
   `AGY_ADC_AUTH=true agy --model "Gemini 3.8 Flash (High)"
   --dangerously-skip-permissions -p "<prompt>"` and requires a brief-file
   pointer, captured stdout/stderr, bounded print execution, and corroborated
   nonempty completion.
3. Corrective Antigravity rounds start fresh with a self-contained brief;
   resume evaluation is explicitly deferred with a forcing trigger.
4. Ordinary and final-convergence candidates receive one independent Luna
   verifier. Security/trust-model candidates retain two independent-provider
   verifiers and cannot use the Gemini ship family as assurance.
5. `HEADLESS-SEATS` records observed Antigravity process `comm=agy`, JSON
   completion fields, per-conversation database location, and the fact that
   `--log-file` telemetry growth is not meaningful-progress evidence.
6. Active docs contain no Qoder routing, invocation, model, native-seat, or
   fallback recommendation. Historical merged task cards may retain their
   original wording; no local Qoder installation is changed.
7. The decision ledger contains an operator-approved routing ruling and an
   approved resume deferral with a concrete trigger, and its index is current.
8. No script, test, gate, README, task-card status, or dependency changes.
9. `node scripts/check.mjs` and `git diff --check` pass.

## Verification commands

```bash
node scripts/check.mjs
git diff --check master...HEAD
rg -n -i '\bqoder\b' AGENTS.md docs \
  --glob '!docs/delivery/task-cards/TASK-001.md' \
  --glob '!docs/delivery/task-cards/TASK-005.md'
```
