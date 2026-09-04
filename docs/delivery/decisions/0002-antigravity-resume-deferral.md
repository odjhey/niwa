---
id: DECISION-0002
type: decision
status: current
authority: informative
description: 'Defer Antigravity session resume evaluation in favor of fresh-session corrective briefs until concrete forcing triggers are met.'
---

# 0002 — Antigravity session resume deferral

**Kind:** deferral
**Review:** approved
**Decided by:** operator
**Provenance:** Operator ruling and Antigravity 1.1.26 dogfood, 2026-09-04 (TASK-005)

## Context

The Antigravity CLI exposes flags for conversation and session handling, but session resumption behavior has not been dogfood-evaluated in this repository. Corrective rounds require deterministic context, reliable execution, and clean failure modes.

## Options considered

- Attempt in-session resume for Antigravity corrective rounds immediately — risks uncharacterized context accumulation, potential database lock contention, or subtle resume failure modes across CLI invocations.
- Defer resume evaluation and require fresh sessions with self-contained corrective briefs for all corrective attempts, with an explicit forcing trigger — relies on clean git worktree state and verified file-backed brief patterns without speculative complexity.

## Choice

Defer evaluation and adoption of Antigravity session resume flags. All Antigravity corrective attempts start fresh with a self-contained brief (carrying verifier findings verbatim, task card, and governing doc pointers).

**Forcing trigger:** This deferral remains active until either:
1. Two fresh corrective attempts demonstrably lose necessary context that a resumed session would have preserved, or
2. The operator explicitly requests a bounded resume trial.

## Consequences

- Corrective briefs must be fully self-contained, relying on git worktree state and recorded findings rather than prior in-session conversation history.
- No resume flags or session-id continuation wiring are added to active Antigravity ship dispatch playbooks.
- Session resume remains dormant until one of the explicit forcing triggers is satisfied.
