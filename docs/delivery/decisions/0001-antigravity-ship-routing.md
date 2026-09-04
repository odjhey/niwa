---
id: DECISION-0001
type: decision
status: current
authority: informative
description: 'Adopt Antigravity Gemini 3.8 Flash for ship tiers, Luna for default verification, and retire active secondary seat support.'
---

# 0001 — Antigravity ship routing and assurance simplification

**Kind:** ruling
**Review:** approved
**Decided by:** operator
**Provenance:** Operator ruling and Antigravity 1.1.26 dogfood, 2026-09-04 (TASK-005)

## Context

Prior seat routing relied on GPT-5.6 Sol across watchtower, ship, and recon roles, required paired verification for final pre-merge convergence rounds, and retained legacy secondary harness references in active documentation. To leverage Google Antigravity for implementation while maintaining independent provider assurance, lower execution overhead, and clean up inactive seat references, an operator ruling on concrete seat allocations was established.

## Options considered

- Retain GPT-5.6 Sol across both watchtower and ship seats — preserves single-provider dependency between authorship and assurance, incurs higher execution costs, and fails to exploit dogfood-verified Antigravity CLI capabilities.
- Adopt Antigravity Gemini 3.8 Flash (High) for both ship tiers, set Watchtower to GPT-5.6 Sol xhigh, simplify ordinary and final-convergence assurance to a single independent GPT-5.6 Luna verifier (retaining paired independent-provider verification only for security/trust-model changes), and retire active secondary seat support — diversifies providers across authorship and verification, speeds convergence, and eliminates obsolete playbook references.

## Choice

The operator ruled:
1. **Watchtower**: GPT-5.6 Sol at `xhigh` reasoning effort.
2. **Both ship tiers** (default and large/judgment-heavy): Antigravity `Gemini 3.8 Flash (High)` using the core command `AGY_ADC_AUTH=true agy --model "Gemini 3.8 Flash (High)" --dangerously-skip-permissions -p "<prompt>"`. Full briefs live in files; the prompt directs the lane to read the absolute brief file. Both stdout and stderr must be captured. The standing ship invocation must include an explicit, sized, bounded `--print-timeout` (20 minutes as the default ceiling for this repo's already-bounded cards, while oversized work is still split; the built-in 5-minute default timed out on bounded work). `--log-file` is diagnostic only and never counts as progress. Exit 0 is insufficient without a nonempty report answering the brief and clean stderr.
3. **Ordinary and final-convergence assurance**: One independent GPT-5.6 Luna verifier at high reasoning effort. Security/trust-model specs retain two independent-provider verifiers; the second security seat is not a standing named seat until earned through `SEAT-RELIABILITY` trials, and must trial/qualify an independent fallback rather than silently reusing Gemini or an OpenAI-backed seat.
4. **Antigravity corrective attempts**: Start fresh with a self-contained brief; session resume is deferred per `DECISION-0002`.
5. **Legacy seat retirement**: Remove secondary harness references from active policy and playbooks. Preserve historical merged task cards and the operator's local installation.

## Consequences

- Implementation (Antigravity/Gemini) and assurance (Luna/OpenAI) run on independent provider backends, mitigating correlated upstream outages and eliminating shared blind spots.
- Orc remains scripted and records outcomes; orc does not spawn seats.
- Dispatches require file-backed briefs, timeout bounding, and corroborated nonempty output.
- Active playbooks and tables no longer advertise retired secondary seats.
