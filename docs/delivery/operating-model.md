---
id: OPERATING-MODEL
type: playbook
status: current
authority: informative
description: 'Multi-agent delivery operating model (watchtower/scout/ship/verify/checker) — roles, pipeline, task sizing, and autonomy rules.'
---

# Delivery operating model

This playbook defines how work is delivered in this repository by
role-separated subagents. It is informative process documentation: it
constrains how work is delivered, never what the product means (normative
docs own that — see `DOCS-ROOT`).

It assumes only a harness that can (a) spawn subagents with isolated context
and (b) let implementation agents work in git worktrees. Nothing here is
specific to any provider, model family, or CLI. Seats are spawned in
preference order: the harness's native subagent features when it has
them (per-harness notes in `NATIVE-SEATS`); otherwise external agent
processes — through an agent-client-protocol CLI (acpx preferred —
worked example in `ACPX-SEATS`) or through another harness's headless /
non-interactive mode (e.g. `pi -p`, `claude -p`, `codex exec`,
`qoder -p` — worked examples in `HEADLESS-SEATS`). The roles and
pipeline are unchanged in every case — only the spawning mechanism
differs.

The cross-cutting *method* the roles rely on — how to write agent-facing
instructions, diagnose a bug, verify on separated axes, and keep records —
lives in `ENGINEERING-METHOD`. The mode-specific mechanics of getting a
verified change onto trunk live in `DELIVERY-MODES`.

## Roles

- **Watchtower** — the coordinating session. Decomposes milestones into
  task-sized units, sequences delivery, makes doc rulings when audits surface
  ambiguity, reviews and merges every change, and maintains the audit trail
  and decision log. The watchtower does not implement product code directly;
  it authors only small process/docs changes.
- **Scouts** (reconnaissance) — read-only subagents that map the governing
  docs before implementation: they produce the doc map, a decomposition
  proposal, and — critically — the list of ambiguities that must be resolved
  in docs before code. Also used for proposal/feasibility assessments.
- **Ship agents** — implementation subagents. One task, one worktree under
  `.worktrees/<branch>`, one branch. They receive governing doc IDs and a
  checkable definition of done; they must not invent semantics. Ambiguity
  splits by what it touches (`DECISION-LOG`): contract-level →
  stop-and-report ("Ambiguities encountered"); local/mechanical →
  decide-and-record (implement the recommendation, file a `review: pending`
  decision record, keep moving). A refusing guard or permission is
  reported, never worked around. They never merge.
- **Verification scouts** — adversarial read-only auditors that run on every
  implementation change before merge. Verification is always a dispatched
  subagent with fresh context — the watchtower briefs it
  (`TEMPLATE-VERIFY-BRIEF`) and judges its verdict, but never audits a diff
  inline itself: an inline review inherits the dispatcher's assumptions,
  and no agent verifies work it briefed into existence. They audit both directions: does the
  diff respect the governing docs (checked against actual doc text, not
  plausibility), and did implementation expose gaps in the docs that need
  amendment. When a diff — or recon — contradicts an existing doc, the
  conflict is surfaced as a **first-class callout** citing the doc's stable
  ID and stating why it should be reopened, never silently routed around: the
  bidirectional check is only real if a contradiction is licensed to
  challenge the doc *out loud*. Verdicts: MERGE / MERGE-WITH-FOLLOW-UPS /
  FIX-BEFORE-MERGE, with findings, doc-amendment obligations, and explicit
  confirmation of what was positively verified.
- **User-perspective checker** — a read-only subagent that exercises the real
  product the way a user would (the actual CLI, app, or API — not the test
  suite) after significant merges. It selects the slice of the walkthrough
  corpus (`WALKTHROUGH-CORPUS`) whose concern tags intersect the shipped
  change, runs the "Today" steps, and reports PASS / BUG / FRICTION per
  scenario with evidence (commands, exit codes, output excerpts); each
  execution lands as a run record under `WALKTHROUGH-RUNS`. It never fixes anything
  itself; routing the healing — a fix task, a docs amendment, a tracked
  issue — is the watchtower's job. Its findings are the backlog, never left
  as unfiled observations.

## Pipeline

1. **Scout** the milestone: doc map, interface signatures, proposed
   decomposition, ambiguity list.
2. **Resolve blockers in docs first**: every contract-level ambiguity an
   implementer would otherwise guess at becomes a docs change before
   dependent code is dispatched. (Local/mechanical choices don't block —
   they ride along as decide-and-record.)
3. **Ship** tasks in dependency order; independent tasks fan out in parallel
   worktrees. Anything dispatched in parallel gets disjoint file territory;
   unavoidably shared files get append-only edits.
4. **Verify** each change adversarially. Required fixes on advertised
   behavior are applied by the same ship agent on the same branch
   (fix-on-branch, not merge-then-patch); smaller items are tracked.
   - **Corrective rounds carry the findings.** When a verdict rejects a
     change, the fix round is a new dispatch whose brief carries the
     verifier's findings verbatim — never a blind re-dispatch of the original
     brief, which re-briefs the executor with no knowledge of what failed.
     Blind retry is reserved for transient execution failures only.
5. **Merge** — watchtower only, per the repo's delivery mode
   (`DELIVERY-MODES`). Doc amendments merge before the code they govern
   whenever possible.
   - **A verdict is stale the moment the head moves.** A verification verdict
     binds to the exact commit it judged; any new head — including a routine
     refresh against trunk — silently voids it. Before merging, compare the
     verified commit against the merge candidate: `git patch-id`
     distinguishes content drift (re-verify) from a mere rebase of identical
     content (the verdict carries). Record which case it was.
6. **Consolidate** doc amendments produced by a round of audits into one
   docs change rather than many.
7. After a major merge, run the **user-perspective checker** on the affected
   flows. Every finding routes somewhere — a fix task, a docs amendment, or
   a tracked issue — never nowhere.

## Task sizing

Tasks are sized by reviewability and decision count, not implementation
effort:

- **One task = one reviewable claim**, statable as "implements these stable
  doc IDs". If the ID list spans layers, split.
- **Zero unresolved ambiguities at dispatch** — shippers get
  mechanical-once-specified work; judgment stays with the watchtower and its
  scouts, or routes back as a stop-and-report.
- **Checkable definition of done** — enumerable acceptance criteria, never
  "make it work".
- **No reward-hacking in the definition of done** — the brief states
  explicitly that tests, gates, and checks must not be deleted, skipped,
  weakened, or narrowed to make them pass. This is the shipper-side
  complement to the verifier's tautological-test hunt: the shipper is told
  not to game the gate; the verifier confirms the gate was not gamed.
- **Disjoint file territory** for anything dispatched in parallel.
- **Wide mechanical refactors use expand → migrate → contract** — the
  sanctioned exception to "one task = one green claim". A change with
  cross-codebase blast radius cannot be one green standalone change.
  Sequence it: **expand** (add the new form beside the old; nothing breaks)
  → **migrate** call sites in batches (each its own task, gate green
  batch-to-batch) → **contract** (delete the old form; blocked by all
  migrates).
- **Pilot one unit before fanning out.** Before dispatching a multi-unit
  batch from one brief template, push exactly one unit through the entire
  pipeline — brief, ship, verify, merge — with the stated purpose of
  *breaking* the template while that costs one agent instead of many. Fix
  the template from pilot evidence, then scale.

## Dispatch size

The watchtower sizes every ship dispatch and assigns its capability
tier accordingly (the concrete model mapping lives in `AGENTS.md` seat
defaults): the economical tier is the default; the strong tier is for
dispatches classed **large or judgment-heavy** — many interlocking
contract decisions, cross-cutting amendments, or design work a brief
cannot fully pre-decide.

**Oversize smells — a card too big for one dispatch.** Any of these
means split before dispatching, not power through:

- The definition of done contains more than ~15 enumerable acceptance
  items, or the brief carries more than one independently reviewable
  claim.
- More than ~4-5 files of *new* normative content (amendment sweeps
  touching many files mechanically don't count; new contract surface
  does).
- The findings/edit list interlocks such that the agent must hold the
  whole set in mind at once AND the set is long — long + interlocked is
  the marathon signature.
- Observed execution as the trailing indicator: a healthy dispatch
  runs minutes-to-a-quarter-hour with a bounded tool-call count; a
  dispatch that runs several times that, or whose report reads like a
  campaign log, was oversized — record it and split its successors.

**How to split.** Prefer, in order: (1) **parallel agents** on disjoint
file territory (the cluster pattern), when the work partitions; (2)
**multiple passes** by the same-sized agents when it doesn't — a
mechanical pass then a judgment pass, or per-section rounds, each
ending gate-green and each independently verifiable; (3) only when
neither applies, one strong-tier agent — and then the brief must carry
every ruling pre-made, because a long-running solo agent inventing
contract semantics mid-marathon is the failure mode this section
exists to prevent. One agent grinding alone for a long time is never
the preferred shape; many short accountable rounds beat one heroic one.

## Dormant-feature lifecycle

Every "if ever" feature follows **recon → rulings → recorded shape → dormant
until pulled**: a scout produces the evidence-grounded picture; the
judgment-heavy questions are ruled on while context is freshest; the
implementation shape is written down where the eventual implementer will
find it; and nothing is built until real usage demands it. Every dormant
item MUST name its pull trigger (recorded in `DECISION-LOG`). The decision
cost is paid exactly once, at maximum context — nothing is built
speculatively, and nothing is re-litigated. A "later" without a trigger is
a wish, not a plan.

## Autonomy and operator interaction

How the watchtower proceeds while the operator is away:

- **The reversible/irreversible boundary.** Proceed on anything reversible
  and present the result; pause only for irreversible or outward-facing acts
  (force pushes to shared branches, deletions, deploys, external messages)
  unless a standing authorization covers them. Direction comes from the
  operator; execution never blocks on them. "Should I keep going?" is never
  a question to ask.
- **An empirical fork is settled by a probe, not a question.** If the answer
  is observable by running something, build the throwaway probe and hand the
  operator a *result to react to* instead of a decision to make. Questions
  are reserved for genuine preference calls no experiment settles.
- **A parked question carries a default.** Every question queued for the
  operator states the options *and the default that applies if no answer
  arrives*, so the program routes around the gate instead of truly blocking.
  The default fires as an ordinary recorded ruling.
- **The decision queue is the review channel.** Local choices made while
  the operator is away accumulate as `review: pending` records
  (`DECISION-LOG`); the operator's check-in is a scan of that directory in
  one sitting, logged in the review log. A repo may additionally declare a
  small set of genuinely blocking named gates (e.g. contract approval,
  outward-facing release); everything else operates as a non-blocking
  review queue.
- **A duration is not a finish condition.** Unattended runs get a checkable
  predicate, never an hour count — and a pre-authorized escape hatch: if
  genuinely stuck, stop and write up why.

## Capability allocation

Every seat in the loop runs on a smart model at high reasoning effort —
authorship is not the place to economize. The repo's concrete per-seat
model/effort defaults live in `AGENTS.md` (Project specifics → Seat
defaults); this section is the provider-neutral rationale behind them:

- **Ship agents** run on a smart model even though their briefs carry the
  judgment: a weaker author produces plausible-but-wrong code that a
  strong verifier then has to catch and a fix round has to redo — capability
  cut at authorship is spent again downstream, with interest.
- **Watchtower, reconnaissance, and assessment scouts** run on the same
  strong tier. Decomposition, rulings, and ambiguity-hunting are the
  judgment-dense stages; their outputs are adopted largely as-is.
- **Verification scouts** run equally strong, but preferably on a
  *different* model than the one that authored the change: a distinct
  model's blind spots don't overlap the author's, so the audit is a second
  perspective, not the same one re-run.
- Reasoning effort defaults high across seats; lowering it is a deliberate,
  recorded choice for a genuinely mechanical round, never the baseline.

## Continuity

A watchtower session's death (compaction, crash, disconnect) is a crash;
treat it like one.

- **The repo's durable surfaces are ground truth.** Task cards, the decision
  queue, PR threads / merge records — a fresh session reconstructs from
  these. Any session memory is interpretive context; when they disagree,
  the record wins.
- **Check the ledgers' recency each session**: a `review: pending` queue
  nobody has scanned and a stale `WALKTHROUGH-RUNS` log relative to merge
  activity are both prompts to the operator, surfaced by the watchtower.
- **Anchor a resume brief at every major boundary** and before context
  pressure: in-flight dispatches (branch, worktree, brief location), the
  queue, and open operator items. Hand off state, not instructions
  (`ENGINEERING-METHOD` §5).
- **Make the session disposable.** The moment a coordination convention
  stabilizes, move it out of the session and into a repo artifact (playbook,
  template, check). At every durable-state design, ask "what dies with this
  session?" — session scratchpad paths leaking into durable state is the
  classic leak.

## Environment gotchas

Recurring traps, harness-independent enough to record:

- **A fresh worktree contains tracked files only.** Untracked local config
  (`.env` and kin) must be copied in by the setup steps — copy, never
  symlink. Briefs carry this (`TEMPLATE-SHIP-BRIEF`).
- **Subagent permission prompts may surface in the operator's UI**, not the
  watchtower's. A long-silent agent may be waiting on one; every risky step
  in a brief carries a fallback so denial degrades to a documented skip.
- **Do not infer completion from silence, output diffs, or fixed waits** —
  corroborate against real status (branch commits, gate output, the report
  itself).
- **Strict CI base-branch checks (`pr` mode)** mean every merge needs a
  branch refresh when trunk moved — build it into the merge routine, and
  re-check verdict staleness after (Pipeline step 5).
- Shell working directories go stale after worktree removal — prefer
  absolute paths.

## Audit trail

Every decision must be reconstructable after the fact. Where the trail
lives depends on the delivery mode — see `DELIVERY-MODES` — but the
invariants are mode-independent:

- Every merged change carries: scope, governing doc IDs, design decisions,
  the verification verdict (and the commit it judged), and ambiguities
  encountered.
- Audit verdicts, watchtower rulings, and fix rounds are recorded where the
  mode says they live (PR thread or merge record).
- Consciously deferred decisions are tracked in `DECISION-LOG` with the
  trigger that will force each; deferrals are recorded, never implicit.
- Operator review is asynchronous and non-blocking: rulings are reviewable
  as small isolated diffs in `docs/` history, and overriding any ruling is
  itself one docs change. The normative docs therefore run deliberately
  **ahead of review** — work proceeds on the current docs now, and an
  amended or rejected ruling triggers a pivot/redesign task, never
  retroactive fault (`DECISION-LOG`, "The projection principle").

## Conventions

- Worktrees: `.worktrees/<branch-name>` (gitignored), removed after merge.
- Local gate: `node scripts/check.mjs`. Green gate = mergeable. In `pr` mode,
  CI mirrors it exactly.
- Squash merges; commits carry attribution trailers where the harness
  provides them.
- Task cards live in `docs/delivery/task-cards/` per `TEMPLATE-TASK-CARD`;
  dispatch briefs follow `TEMPLATE-SHIP-BRIEF` and `TEMPLATE-VERIFY-BRIEF`.
- At milestone boundaries, run the `DRIFT-SMELLS` health check.
- Where the harness supports per-agent tool permissions, give each role the
  narrowest set that does its job: verification and scout seats run
  read-only (inspection plus the gate command — no write, commit, push, or
  publish); only ship seats get write access. The sole carve-out: an
  assurance seat may write its verdict record into the orc delivery journal,
  and nothing else — never source, worktrees, docs, or the backlog
  (`ORC-ERGO-DELIVERY`). Prefer a default-deny
  allowlist over a blocklist for anything passed through to a spawned seat
  — blocklists leak by construction.
