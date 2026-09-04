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
| Watchtower | gpt5.6 sol | high |
| Ship agents (default) | gpt5.6 sol | high |
| Ship agents (large/judgment-heavy) | gpt5.6 sol | high |
| Recon / assessment scouts | gpt5.6 sol | high |
| Verification scouts | gpt5.6 luna | high |

The **watchtower sizes every ship dispatch and picks its model**: the
default tier unless the sizing rules in `OPERATING-MODEL` (Task sizing
→ Dispatch size) class the dispatch as large or judgment-heavy.
Oversized cards are split before dispatch, never powered through.

**Standing verification policy.** <!-- ADAPT: name the default
verification seat, the fallback seat, and when both run. Earn each
slot on SEAT-RELIABILITY evidence (a bounded paired trial, then an
operator ruling in DECISION-LOG), never on a model roster. --> One
seat is the default; run **two seats in parallel and adjudicate the
union** of confirmed findings for security/trust-model specs and final
pre-merge convergence rounds; one named fallback seat. Seats that share
a provider backend fail together — keep at least one trial or fallback
seat on an independent provider.

**Verified headless invocations** — the shapes, stall signatures, and
thresholds that cost days to learn are cached in `HEADLESS-SEATS`
("Verified dispatch shapes and stall signatures"): codex via
`exec` with the brief on stdin and `-o <out-file>`; pi with the model
flag (REQUIRED — bare `pi -p` hangs silently); qoder via stdin; claude
on an alternate account via `CLAUDE_CONFIG_DIR`. Treat >15 minutes of
output silence at ~zero CPU as a stall; after two stalls on the same
brief, switch seats. Verify a stall claim before killing a lane.

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
