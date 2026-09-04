# Agent instructions

This repository uses `AGENTS.md` as the cross-harness entry point for agent
behavior. `CLAUDE.md`, `CONTEXT.md`, and `GEMINI.md` are symlinks to this
file — edit here only.

This repository is **docs-driven and docs-first**. Docs specify behavior;
code implements it; verification checks code against docs, never against
plausibility.

**Delivery mode: `trunk`** <!-- ADAPT: set to `pr` or `trunk`; see docs/delivery/modes.md -->

## Hard rules

1. **Docs are part of the product contract.** Normative docs own product
   semantics. Do not invent contract semantics in code; when behavior is
   ambiguous at that level, the docs are amended first.
2. **Ambiguity splits by what it touches** (`DECISION-LOG`): contract-level
   ambiguity (a normative doc, interface, or published behavior) is
   **stop-and-report** — park that scope and record it under "Ambiguities
   encountered". Local/mechanical choices are **decide-and-record** —
   implement your recommendation and write a `review: pending` decision
   record (`docs/delivery/decisions/README.md`); do not wait.
3. **Hard stops** (always park + report, never decide-and-record): changing
   approved normative behavior or a published interface without its docs
   change; weakening the security posture; adding a forbidden dependency;
   deleting, skipping, weakening, or narrowing a test, gate, or check to
   make it pass; bypassing an architecture rule.
4. **One task, one worktree, one branch.** Worktrees live only in
   `.worktrees/<branch-name>` (gitignored). Ship agents never merge — the
   watchtower merges, per the delivery mode (`docs/delivery/modes.md`).
5. **The local gate is `node scripts/check.mjs`.** Run it before reporting
   done; docs-only changes still must pass it. In `pr` mode CI mirrors it
   exactly, so green locally means green remotely.
6. **Every implementation change receives adversarial verification before
   merge**; findings on advertised behavior are fixed on the same branch.
   No agent verifies its own work.
7. **Every ship report / PR body carries an "Ambiguities encountered"
   section** (state "none" when none), plus scope, governing doc IDs, and
   verification output.
8. **A refusal is a signal, not an obstacle.** A guard, allowlist, or
   permission that refuses an action is reported, never worked around.
9. **A broken link in a docs file is a defect** — fix it or file it, never
   assume it is intentional. When you add or materially edit a doc, keep
   the registry in `docs/README.md` current.

## Default discovery sequence

1. Read this file and any harness-specific instructions.
2. Inspect the task card, issue/PR, and relevant git history before
   inventing new work.
3. For repository knowledge, start from `docs/README.md` (the registry) and
   follow links progressively to more specific docs.
4. When working inside a package/service directory, check its local
   `README.md`.
5. Prefer repository scripts over manually recreating documented
   procedures.

## Source of truth

- Operating model (roles, pipeline, sizing, autonomy):
  `docs/delivery/operating-model.md` (`OPERATING-MODEL`)
- Delivery modes and audit trail: `docs/delivery/modes.md`
  (`DELIVERY-MODES`)
- Delivery method (orc + ergo — backlog, dispatch/verdict ledger,
  seat roles, the loop): `docs/delivery/orc-ergo-delivery.md`
  (`ORC-ERGO-DELIVERY`)
- Decision queue and deferrals: `docs/delivery/decisions/README.md`
  (`DECISION-LOG`)
- Method (instructions, diagnosis, verification, records):
  `docs/playbooks/engineering-method.md` (`ENGINEERING-METHOD`)
- Health check: `docs/delivery/drift-smells.md` (`DRIFT-SMELLS`)
- User-perspective scenarios: `docs/walkthroughs/README.md`
  (`WALKTHROUGH-CORPUS`)

## Harness adapters

Harness-specific instruction files stay thin and defer to this file.
Shared skill definitions live in `.agents/skills/<name>/SKILL.md`;
harness-specific locations are symlinks into it (`.claude/skills` →
`../.agents/skills`) so every harness picks them up from a single source —
add skills there only, and add further harnesses' locations as symlinks
the same way (see `.agents/skills/README.md` for authoring guards).

## Project specifics

### Seat defaults

Concrete instantiation of the capability allocation in `OPERATING-MODEL`
for this repo — dispatchers use these unless a brief overrides them:

<!-- ADAPT: models and reasoning efforts per seat. Keep the two ship
rows: the watchtower sizes every dispatch and picks the tier
(OPERATING-MODEL, Dispatch size). -->

| Seat | Model | Reasoning effort |
|---|---|---|
| Watchtower | gpt5.6 sol | xhigh |
| Ship agents (default) | Antigravity Gemini 3.8 Flash (High) | high |
| Ship agents (large/judgment-heavy) | Antigravity Gemini 3.8 Flash (High) | high |
| Recon / assessment scouts | gpt5.6 sol | high |
| Verification scouts | gpt5.6 luna | high |

The **watchtower sizes every ship dispatch and picks its model**: the
default tier unless the sizing rules in `OPERATING-MODEL` (Task sizing
→ Dispatch size) class the dispatch as large or judgment-heavy.
Oversized cards are split before dispatch, never powered through.

The default ship command preserves `AGY_ADC_AUTH=true agy --model "Gemini 3.8 Flash (High)" --dangerously-skip-permissions -p "<prompt>"`.
The standing ship invocation must include an explicit, sized, bounded `--print-timeout`
(use 20 minutes as the default ceiling for this repo's already-bounded ship cards,
while oversized work is still split) because dogfood revealed the built-in 5-minute
timeout was too short for a bounded sweep and exited 1 with empty stdout and
`Error: timeout waiting for response`. Full briefs live in files; the prompt tells
the lane to read the absolute brief. Capture stdout and stderr; `--log-file` is
diagnostic only and must never count as progress. Exit 0 is insufficient without a
nonempty report that answers the brief and clean stderr. Corrective attempts start
fresh with a self-contained brief; resume evaluation is deferred per `DECISION-0002`.

**Standing verification policy.** Ordinary and final-convergence
assurance uses one independent GPT-5.6 Luna verifier at high reasoning.
Security/trust-model specs retain two independent-provider verifiers and
cannot use the Gemini ship family as assurance. The second security seat
is not a standing named seat until it earns one through `SEAT-RELIABILITY`;
such work must trial/qualify the independent fallback rather than
silently use Gemini or another OpenAI-backed seat. Seats that share a
provider backend fail together — keep at least one trial or fallback seat
on an independent provider.

**Verified headless invocations** — the shapes, stall signatures, and
thresholds that cost days to learn are cached in `HEADLESS-SEATS`
("Verified dispatch shapes and stall signatures"): Antigravity via `agy`
in print mode (`-p`) with prompt pointing to absolute brief file; codex
via `exec` with the brief on stdin and `-o <out-file>`; pi with the
model flag (REQUIRED — bare `pi -p` hangs silently); claude on an
alternate account via `CLAUDE_CONFIG_DIR`. Stall claims require
attributable per-harness evidence per `HEADLESS-SEATS` rather than generic
output silence: Antigravity uses its own open conversation `.db`/`.db-wal`,
never stdout or diagnostic log growth; codex own-rollout, pi
session-transcript, and alternate-Claude own-transcript semantics govern
by reference. After two stalls on the same brief, switch seats. Verify a
stall claim before killing a lane.

<!-- ADAPT (optional): ship-seat account routing. If a second harness
account exists, NEW ship dispatches can run headless on it until it
is exhausted, e.g. `CLAUDE_CONFIG_DIR=<alt-config-dir> claude -p
--dangerously-skip-permissions --model <id> "<brief>"` from the repo
root, output teed to a file; on rate-limit/quota errors fall back to
the primary in-harness seat and note the switchover in the ship record.
Record the routing as a DECISION-LOG ruling with its end trigger. -->

### Delivery method: orc + ergo

The pipeline runs on **ergo** (backlog: readiness, claims) and
**orc** (delivery ledger: dispatch, attempts, candidates, verdicts,
acceptance) per `ORC-ERGO-DELIVERY`
(`docs/delivery/orc-ergo-delivery.md`) — the binding method contract,
including the exact loop commands, the authority map (no fact has two
homes), and every seat's orc/ergo role. The seat table above is
unchanged by it: ship seats are orc execution seats, verification
scouts are the assurance seat, the watchtower operates both CLIs and
alone writes terminal ergo states. Watchtowers load the
`watchtower-loop` skill; ship seats load `delivery-loop`; both defer
to the `orc-ledger` skill for generic orc seat discipline.

<!-- ADAPT: if the repo does not run orc+ergo (`copyto --no-ledger`),
delete this subsection and the "Delivery ledger (orc)" section below,
and keep task-card status `dispatched` as the live-state signal. -->

<!-- ADAPT: replace the rest of this section. State: how to build/test/run,
the language and layout conventions, and any normative contract docs with
their stable IDs. Keep it to facts an agent cannot cheaply discover from the
environment — the environment is the source of truth; this file caches only
the expensive or unfindable. -->

## Delivery ledger (orc)

### MODE DECLARATION

**SCRIPTED MODE (scripted default).** orc records and advances state;
it does not spawn or drive agents; you the agent do the work and record
the settlement/verdict by hand.

Each run's dispatch config names the `git` candidate adapter bound to
the task's worktree, per `ORC-ERGO-DELIVERY` §5 (the profile
`.orc/profile.json` stays `{}`).

The ledger is operator-machine-local (`.orc/`, `.ergo/` at the primary
checkout root, gitignored); resume from the primary checkout root.

Before touching the ledger, load the installed `orc-ledger` skill
(`.agents/skills/orc-ledger`) — it is the canonical generic protocol;
this repo's binding loop is `ORC-ERGO-DELIVERY`, which governs where
the two disagree.
