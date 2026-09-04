---
id: DECISION-0003
type: decision
status: current
authority: informative
description: 'Require plain operator-configured agy for Antigravity ship seats and report authentication failures without ADC bypass.'
---

# 0003 — Antigravity operator authentication routing

**Kind:** ruling
**Review:** approved
**Decided by:** operator
**Provenance:** Operator billing-route correction, 2026-09-04 (TASK-008)

## Context

Prior ship dispatch instructions configured Antigravity to authenticate via Application Default Credentials (ADC). In practice, ADC routing caused billing issues across operator accounts. Reliable delivery requires ship lanes to execute under the operator's primary configured CLI account environment rather than routing through ADC.

## Options considered

- Retain ADC routing and introduce account-override or billing-project workarounds — adds environmental coupling, preserves account-routing complexity, and risks further billing disruptions.
- Require plain operator-configured `agy` without ADC authentication overrides — aligns headless execution with the operator's standard working configuration and enforces hard rule 8 by treating authentication failures as signals rather than bypassing them.

## Choice

The operator ruled:
1. **Plain `agy` command**: All active Antigravity ship invocations must invoke plain `agy` without ADC authentication overrides.
2. **Preserve execution boundaries**: Retain all operational requirements established in `DECISION-0001` and `HEADLESS-SEATS`: explicit model selection (`Gemini 3.8 Flash (High)`), `--dangerously-skip-permissions`, `--print-timeout 20m`, file-backed prompt briefs, stdout/stderr capture, diagnostic log handling, and non-empty output corroboration.
3. **Report auth failures**: If an invocation fails due to authentication or credentials, report the refusal immediately. Never attempt to bypass authentication failures by re-enabling ADC or altering credentials locally.
4. **Supersession scope**: Supersedes only the ADC auth prefix in Choice item 2 of `DECISION-0001`. All other choices in `DECISION-0001` remain current and binding.

## Consequences

- Dispatchers and playbooks use plain `agy` commands with no ADC configuration.
- Billing routes cleanly through the operator's established Antigravity account configuration.
- Authentication failures fail closed and are reported as refusals per hard rule 8.
