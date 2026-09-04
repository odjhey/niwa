---
id: ORC-ERGO-DELIVERY
type: contract
status: current
authority: normative
description: 'How this repo runs its delivery pipeline on orc (dispatch/attempt/verdict ledger) and ergo (dependency-aware backlog) — authority map, seat roles, the day-to-day loop with exact commands, and failure paths.'
---

# Orc+ergo delivery method

This repo delivers work through two local CLIs: **ergo** carries the
backlog (what should be done next, with dependencies and claims), and
**orc** carries the delivery ledger (what was dispatched, attempted,
produced, and independently judged). This document is self-contained:
an agent with this repo plus the two CLIs can run the whole loop from
here. The pipeline itself — roles, sizing, verification discipline,
trunk-mode merging — is unchanged (`OPERATING-MODEL`,
`DELIVERY-MODES`); orc and ergo are the record-keeping and scheduling
substrate underneath it. Adopting repos record the adoption as a
`DECISION-LOG` ruling; the seed rulings this document bakes in are
marked *(ruling)* where they bind.

It is `type: contract` deliberately: it assigns exclusive write
authority over each record home (who may mark what, where) — binding
rules, not guidance — and `guide` is not a legal type in `DOCS-ROOT`'s
machine-checked taxonomy.

## 1. The tools and how to invoke them

**orc** is a durable, journal-backed delivery ledger and seat
protocol. Its core rule — the same seam as this repo's hard rule 6 —
is that an executor's claim of "done" is never acceptance: execution
settlement and the independent verdict are recorded by different
seats, and a verdict binds only to the exact candidate (commit) it
judged (orc-werk `INV-003`, `P-003`, `P-004`, cited as provenance
only). orc never watches processes; every seat **pushes** its
observation in via `orc record`, and state advances only on
`orc dispatch` (orc-werk `ADR-0005`).

The repo's canonical `orc` invocation — use it **verbatim** in briefs
and scripts, because shell aliases are invisible to spawned processes —
is:

    PYTHONPATH=/Users/odz/proj/orc-werk/src python3 -m orc_werk.cli <subcommand> ...

Everywhere below, `orc` abbreviates exactly that line. Interactive
shells may alias it; a brief must always carry the full form.

**ergo** is a local, dependency-aware backlog: tasks with states and
dependency edges, `ready` when unblocked, claimable by agents. It is
invoked as `ergo` (on PATH).

Key orc exit codes: `0` all work ACCEPTED · `1` BLOCKED (terminal,
not accepted) · `2` usage/config error · `3` pending — **healthy**,
the run is resting between observations. `orc dispatch` is the only
verb that advances state, it is **watchtower-only** in this repo, and
it is not an unconditional recovery move — see §6, "Crash recovery",
before re-dispatching anything.

### Where state lives on disk

Both stores live at the **primary checkout root** (this repo's root,
not a worktree) and are **gitignored** *(ruling)*:

- `.orc/` — the orc journal directory (one subdirectory per run).
- `.ergo/` — the ergo backlog.

Seats working in `.worktrees/<branch>` must address them absolutely:

    orc <subcommand> ... --journal <repo-root>/.orc
    ergo --dir <repo-root> <subcommand> ...

**One-time bootstrap** — watchtower, at the primary root, **before
the first dispatch config is written**. A fresh checkout has neither
directory. `orc` creates a run's journal subdirectory on dispatch, but
that dispatch needs its config file, and §5 step 2 writes that config
*into* `<root>/.orc/` — so on a fresh root the config write fails
(`no such file or directory`) before orc is ever invoked. There is no
self-initialization to rely on; create both stores explicitly:

    mkdir -p <root>/.orc
    printf '{}' > <root>/.orc/profile.json
    ergo --dir <root> init          # prints: Initialized Ergo at <root>/.ergo

`.orc/profile.json` stays `{}` — no profile-level adapters; each run's
config names its own. Both paths are gitignored *(ruling)*.
Bootstrap is safe to re-run: `mkdir -p` is a no-op and a second
`ergo init` prints `Ergo already initialized at …` and exits 0 — but
do not re-run the `printf` over an operator-modified profile.

## 2. Authority map — no fact has two homes

Read the table as an exclusive assignment: each row names what that
home is authoritative **for** and who may write it there. Nothing
outside a row's "authoritative for" column is that home's to settle.

| Record home | Authoritative for | Sole writer of that fact |
|---|---|---|
| **orc journal** (`.orc/`) | **History only**: what was attempted, which candidate (head sha) each attempt bound, what execution outcome was observed, what verdict was recorded against which candidate, and the seat attribution of each such record | The seat that observed the fact — ship seats write `--outcome`, assurance seats write `--verdict`; the watchtower writes dispatch, cancel, and abandon |
| **ergo backlog** (`.ergo/`) | Backlog and readiness: what work exists, what is blocked or ready (dependency edges), what is claimed and by whom, and the live execution state of a task between authoring and its terminal record | Watchtower (curation, dependency edges, claims at dispatch, terminal states at close) |
| **git** | Artifacts and merge truth: the content itself, and whether a candidate is on trunk. The squash-commit message stays the trunk-mode audit record (`DELIVERY-MODES`) | Ship agents (branch commits), watchtower (merges) |
| **method docs — authority per each document's own frontmatter** (`ORC-ERGO-DELIVERY`, `OPERATING-MODEL`, `DELIVERY-MODES`, `ENGINEERING-METHOD`) | Method semantics: what the states mean, who may do what, what a verdict obliges | The deciding agent/operator, via a docs change (rationale to `DECISION-LOG`) |
| **task cards** (`docs/delivery/task-cards/`) | Brief content (scope, territory, acceptance criteria) **and** the durable terminal record of the task | Watchtower |
| **decisions ledger** (`DECISION-LOG`) | Rationale: rulings, trade-offs, deferrals, the async review queue | The deciding agent/operator |

Consequences, stated as rules:

1. **Terminal-state copies in orc and ergo are projections of git
   truth, not authorities.** orc `ACCEPTED` and `ergo done` both mean
   "a verified candidate reached trunk"; the fact itself lives in git
   (the merge commit, and `git merge-base --is-ancestor` on the
   candidate). Where a projection and git disagree, git is right and
   the projection is a bookkeeping defect to be reported, never
   reconciled away by re-recording.
2. Only the watchtower writes `ergo done|fail|cancel`, only after the
   corresponding orc run is terminal, and always carrying the orc run
   id and candidate head sha as evidence. No ship agent, assurance
   seat, or human hand-marks an ergo task terminal. (Deviation from
   orc-werk's observer-script wiring *(ruling)*: our single
   acceptor already exists — the watchtower — so it is the sole
   writer, without observer hooks.)
3. **Assurance seats write to the orc journal only** — the verdict
   record and its findings, nothing else. They remain read-only over
   source, worktrees, branches, docs, and ergo, per `OPERATING-MODEL`
   (Conventions, seat permissions). Recording a verdict is publishing
   an observation into the ledger, not editing the work.
4. The ergo task **body is a pointer to its task card**, plus at most
   a one-line summary. Acceptance criteria, territory, and governing
   IDs live in the card only.
5. Verification findings ride the orc verdict record (`--finding`);
   the squash-commit message still cites verdict + judged commit as
   before. The journal is the searchable detail; the commit message
   remains the self-sufficient trunk record.
6. The journal outranks **memory and session recollection** about
   attempt/verdict history — that is its column in the table. It does
   not outrank this document or any other normative doc on what the
   method requires: history and semantics are different homes.
7. Anything durable that is none of the above (a ruling, a deferral)
   goes to `DECISION-LOG`, exactly as before.

### Task-card status after adoption

Cards and ergo split the lifecycle rather than mirroring it
*(ruling)*. A card carries **durable-record states only**:

- `draft` — authored, the brief exists.
- `merged` | `abandoned` — terminal, written by the **watchtower at
  merge (or abandonment) time**.

The `dispatched` status is **retired for new cards**: between
authoring and the terminal record, live execution state — claimed,
in flight, awaiting assurance, blocked — belongs **exclusively to
ergo**; orc holds attempt/candidate/outcome/verdict history, not live
state. A card that also carries live state gives that fact two homes.
Cards created before adoption keep their historical statuses
unchanged; the checker still accepts `dispatched` for them
(`TEMPLATE-TASK-CARD`, `TASK-CARDS`).

## 3. Concept mapping

| This repo's concept | orc / ergo concept |
|---|---|
| Task card (`TEMPLATE-TASK-CARD`) | ergo task (title = `TASK-NNNN — <card title>`, body = card path); a milestone/wave groups cards as an ergo **epic**; card dependencies become `ergo sequence` edges |
| Dispatch brief (`TEMPLATE-SHIP-BRIEF`) | The orc run's **intent** text (short form) — the brief itself stays the full instruction, carried to the seat as today; the run's dispatch **config** binds the candidate adapter to the task's worktree |
| Ship attempt on a worktree branch | orc **attempt** within the run's single work (`work-1`); the branch head sha is the attempt's **candidate**, derived automatically by the `git` candidate adapter |
| Adversarial verification (hard rule 6) | orc **assurance verdict**, recorded by an independent seat with self-derived candidate identity — orc-werk `INV-003`'s executor-claim vs independent-verdict seam is exactly our rule 6 |
| Verdict vocabulary MERGE / MERGE-WITH-FOLLOW-UPS / FIX-BEFORE-MERGE | `--verdict accepted` / `accepted` plus `--finding` entries (and follow-ups filed as usual) / `--verdict rejected` with findings — a rejection opens the next attempt automatically |
| Fix round on the same branch | The next orc attempt (same run, same work, new candidate = new head sha), briefed with the findings verbatim |
| Watchtower squash-merge (acceptance) | orc run reaching **ACCEPTED** — the watchtower withholds the final accepting `orc dispatch` until after the squash-merge, so ACCEPTED always means "verified **and** on trunk" |
| Retry budget | `max_attempts` in the run's per-run dispatch config JSON (`"max_attempts": N` alongside the `candidate` block, policy default otherwise); the `--max-attempts` flag is **not persisted** to that config and governs only the dispatch invocation it is passed to. Counts **total** attempts on the run; exhaustion is terminal BLOCKED with no continuation — see §6 |
| Decisions ledger, git history | Unchanged — see the authority map; orc/ergo replace neither |

Run-id and identity conventions *(ruling)*: the orc
`run_id` **is** the ergo task id (e.g. `OI7SMZ`), so ledger and
backlog cross-reference with no lookup table. One orc run = one ergo
task = one work (`work-1`); a card big enough to be a DAG is split
into cards first (`OPERATING-MODEL`, dispatch sizing), never modeled
as a multi-work plan. Branch names stay `task-<nnn>-<slug>`.

## 4. Seat roles

The seat table in `AGENTS.md` maps onto orc/ergo as follows. orc has
two seat kinds per candidate: the **execution seat** (records the
outcome) and the **assurance seat** (records the verdict); they must
never be the same agent for the same candidate.

| Seat (AGENTS.md) | orc/ergo role | Identity, as recorded |
|---|---|---|
| Watchtower | Operator of both CLIs — curates the ergo backlog, claims tasks at dispatch, runs **every** `orc dispatch`, records `orc cancel`/`--abandon-work`, performs the merge, writes terminal ergo states. Never an execution or assurance seat for work it briefed. | Not recorded by orc as a dispatching party — see "Attribution, as orc actually records it" below. The `ergo claim --agent` strings it writes name the executing seat, not itself |
| Ship (default tier) | Execution seat: does the work in the worktree, records `orc record --outcome` | `--model <ship-model> --seat-ref ship-primary` |
| Ship (strong tier, large/judgment-heavy) | Execution seat, same protocol | `--model <ship-model> --seat-ref ship-primary` |
| Ship via an alternate account (if `AGENTS.md` routes one) | Execution seat, same protocol — the alternate account is still a seat; only the executing account differs. Its headless brief carries the full `orc` invocation and the absolute `--journal` path | `--model <ship-model> --seat-ref ship-<account>`; ergo claim `<tier>@<account>` |
| Recon / assessment scouts | Neither orc seat — read-only, records nothing in orc; outputs land as docs/cards as today | n/a (may read `orc status`/`show`) |
| Verification scouts | Assurance seat: audits the branch diff read-only, **derives the candidate identity itself** (`git rev-parse` on the branch head — never copied from the ship's report), records `orc record --verdict`. Its **only** write is that journal record; it never edits source, worktrees, branches, docs, or ergo (§2 rule 3) | `--model <verify-model> --seat-ref verify --derived-identity '{"head_sha": "<self-derived>"}'` |

A seat that cannot run the CLI (harness restriction, denied
permission — report the refusal per hard rule 8) degrades to
**watchtower-transcribed** recording: the watchtower runs the same
`orc record` command on the seat's behalf, keeping the attribution
flags naming the seat that actually observed the fact. Transcription
never crosses the seam: the watchtower transcribes a verdict only
from a verification scout's actual report, never from its own
judgment.

### Attribution, as orc actually records it

orc's attribution is **per command**, and it is not uniform. Know
which acts carry an identity in the journal and which do not:

- `orc record` — carries the seat identity you pass:
  `--model`, `--seat-ref`, `--session-ref`. This is the only place
  seat identity is recorded richly, and it is emitted as
  `executor-identity/v1` on the attempt entry.
- `orc cancel` — records the invoking OS user (`$USER`) as the
  cancelling party. Nothing else identifies who decided.
- `orc dispatch --abandon-work` — takes `--abandon-by` for the
  abandoning party; supply it explicitly.
- `orc dispatch` (ordinary advance) — records **no dispatcher
  identity at all**. The `DEC-DISPATCH` journal entry carries the
  dispatch policy, not the party that ran the command. Do not read a
  dispatch entry as evidence of who dispatched.

Consequence: where dispatcher identity matters — who briefed this
run, who accepted it, who decided to abandon — the identity home is
the **watchtower's session and merge record** (the squash-commit
audit message, `DELIVERY-MODES`), not the orc journal. Since every
dispatch is watchtower-only, the journal's silence is not ambiguity
about the role, only about the individual session.

## 5. The day-to-day loop

Every command is exact. `<root>` is the primary checkout root; `orc`
is the module-form invocation from §1. Steps 1–2 and 4 are
watchtower; 3 is the ship seat; 5 is the verification seat; 6–8 are
watchtower.

**1. Intake — card → backlog.** Author the task card as usual — it
stays at `status: draft` until the watchtower writes its terminal
state at merge time (§2, "Task-card status after adoption") — then
mirror it into ergo and wire dependencies:

    ergo --dir <root> new task "TASK-NNNN — <card title>" <<< "docs/delivery/task-cards/TASK-NNNN.md"
    ergo --dir <root> sequence <blocker-id> <blocked-id>     # per the card's dependencies

The printed task id (e.g. `OI7SMZ`) is this delivery's id everywhere
below.

**2. Dispatch — claim, worktree, run.** Pick ready work, claim it
with the executing seat's identity, open the run, and launch the ship
seat per `AGENTS.md` seat routing:

    ergo --dir <root> list --ready
    ergo --dir <root> claim <id> --agent <tier>@<seat>        # e.g. sonnet@primary
    git worktree add .worktrees/task-<nnn>-<slug> -b task-<nnn>-<slug> <trunk>

    cat > <root>/.orc/<id>-cfg.json <<'EOF'
    { "candidate": {"adapter": "git", "repo_path": "<absolute path to the worktree>"}, "max_attempts": N }
    EOF
    orc dispatch "TASK-NNNN — <card title>" --run-id <id> --config <root>/.orc/<id>-cfg.json --journal <root>/.orc

Put `max_attempts` **in this config file**, alongside the `candidate`
block, if the run needs a non-default retry budget. A `--max-attempts N`
flag on this (or any) `orc dispatch` call is **not persisted** to
`config.json` — it governs only the single invocation it is passed
to, so a later flagless dispatch on the same run falls back to the
config value, or the policy default if the config never carried one
(see also §3 and §6).

Exit 3 (pending, awaiting execution-outcome) is the healthy result.
The ship brief itself is unchanged (`TEMPLATE-SHIP-BRIEF`) and
additionally carries: the run id, the full `orc` invocation, and the
recording step below.

**3. Ship — work, then record the outcome.** The ship seat completes
the task on its branch (gate green: `node scripts/check.mjs`), then
pushes its observation in — *before* anything tears down its
worktree ("settle before reaping"):

    orc record <id> --work work-1 --outcome completed --evidence-ref "branch:task-<nnn>-<slug>" --model <model> --seat-ref <seat> --journal <root>/.orc

A ship that finished unsuccessfully records `--outcome failed` with
the reason as an evidence ref. `--outcome` never sets candidate
identity — the next dispatch derives it.

**4. Bind the candidate.** The watchtower re-dispatches; the git
adapter reads the worktree's head sha and binds it as the attempt's
candidate, moving the work to ASSURING:

    orc dispatch --run-id <id> --journal <root>/.orc

Output names the bound candidate head. Now dispatch the verification
scout (`TEMPLATE-VERIFY-BRIEF`, seat per `AGENTS.md`), giving it the
run id and branch.

**5. Verify — independent verdict.** The verification seat audits
the diff against the governing docs read-only, derives the candidate
identity itself from the branch (never from the ship's report), and
records — its journal record being its only write (§2 rule 3):

    git -C <worktree> rev-parse HEAD                          # self-derived
    orc record <id> --work work-1 --verdict accepted --derived-identity '{"head_sha": "<that sha>"}' --finding "<follow-up or note>" --model <verify-model> --seat-ref verify --journal <root>/.orc

`--verdict accepted` maps MERGE and MERGE-WITH-FOLLOW-UPS (findings
and follow-ups ride `--finding`, repeatable); `--verdict rejected`
maps FIX-BEFORE-MERGE (see §6). Its written verdict report still
goes to the watchtower as today; the orc record is the durable
extract. A derived-identity mismatch with the bound candidate is the
system working — report it, never reconcile it away.

**6. Accept — merge, then close the run.** On an accepted verdict
the watchtower checks verdict staleness (`git patch-id`, per
`OPERATING-MODEL` pipeline step 5), squash-merges with the standard
trunk-mode audit-record commit message (`DELIVERY-MODES` — verdict
and judged commit cited as before), and only then runs the accepting
dispatch:

    orc dispatch --run-id <id> --journal <root>/.orc          # exit 0: ACCEPTED

Ordering is load-bearing: ACCEPTED in this repo means "verified and
merged", so the accepting dispatch always follows the merge and
always precedes worktree removal.

**7. Close the backlog entry.** The watchtower — sole writer of
terminal ergo states — projects the outcome back with evidence:

    ergo --dir <root> result <id> "orc=<id> candidate=<head-sha> trunk=<trunk-sha>"
    ergo --dir <root> done <id> -m "squash-merged"

**The result summary is capped at 120 characters** and `ergo result`
rejects anything longer outright (`error: result summary too long
(max 120 chars)`). Use the compact `key=value` form above verbatim:
with a 6-character ergo id and two full 40-character shas it is 108
characters, leaving headroom. Prose forms overflow — the earlier
`"accepted via orc run <id>, candidate <sha>, merged as <sha>"`
wording measures 131 and is rejected.

**A successful `ergo result` MUST precede `ergo done`.** ergo does
not enforce this: `ergo done` succeeds on a task with no result at
all, so a rejected (over-length) result followed by a done leaves the
task closed with no candidate or trunk sha recorded — a silently
evidence-free terminal state. Read the `Result recorded: …`
confirmation line before closing; if the result was rejected, shorten
it and re-run, then close.

Dependent ergo tasks become ready automatically.

**8. Clean up — and write the card's durable terminal state.** Set
the card's frontmatter to `status: merged` and update its `TASK-CARDS`
index row; this is the watchtower's write and the card's only status
change after authoring. Then remove the worktree and branch as usual.
The run's journal (`.orc/<id>/`) stays — it is the delivery history.

## 6. Failure paths

- **FIX-BEFORE-MERGE.** The verify seat records
  `--verdict rejected --finding "<finding>" ...` (findings verbatim,
  one `--finding` each). The next `orc dispatch --run-id <id>` binds
  the rejection and opens the next attempt back at the execution
  seat. The watchtower dispatches the fix round **on the same
  branch**, brief carrying the findings verbatim
  (`OPERATING-MODEL`, corrective rounds); the loop resumes at step 3
  and the new head sha becomes the new candidate. Never a blind
  re-dispatch of the original brief.
- **Attempt budget exhausted.** After `max_attempts` (**total**
  attempts, not just rejections beyond the first) the run goes
  BLOCKED (exit 1) and is **terminal**. There is no continuation
  path: a BLOCKED run cannot be re-opened with a raised budget —
  `orc dispatch --run-id <id> --max-attempts N` against a terminal
  BLOCKED run exits `ERR-CONFLICT`. `max_attempts` is persisted only
  via `"max_attempts": N` in the run's per-run dispatch config JSON
  (alongside the `candidate` block, §5 step 2); the `--max-attempts`
  flag is **not** persisted to that config and governs only the
  single dispatch invocation it is passed to — a later flagless
  dispatch on the same run falls back to the config value, or the
  policy default if the config never carried one. The rule is
  therefore: **terminal exhaustion → a fresh ergo task and a fresh
  orc run.** The watchtower closes the old side —

      ergo --dir <root> result <id> "orc=<id> outcome=blocked successor=<new-id>"
      ergo --dir <root> fail <id> -m "attempt budget exhausted"

  — re-scopes or splits the remainder into a new card, and opens a
  new ergo task whose **body cross-references the old one** (old ergo
  id, old orc run id, and why it blocked), so the delivery history
  stays followable across the break. Record the new task's id back
  into the old task's result line before failing it, as above. If the
  remaining budget was misjudged, raise it in the *new* run's dispatch
  config (`"max_attempts": N`), never on the old one.
- **Abandoned work.** A seat that vanished (dead session, reaped
  workspace) without recording is not a failure yet: first try to
  recover its observation; if none exists, the watchtower records
  reality (`--outcome failed`, evidence ref naming the loss) or,
  when the run rests at ASSURING for an assurance that will never
  settle, uses the operator-only
  `orc dispatch --run-id <id> --abandon-work work-1 --abandon-reason "<why>" --abandon-by "<who>"`
  — `--abandon-by` is the one dispatch-side identity flag orc offers;
  supply it, or the abandonment has no recorded party (§4).
- **Operator cancel.** A withdrawn task closes both homes:
  `orc cancel <id> --work work-1 --reason "<why>" --journal <root>/.orc`,
  then `ergo --dir <root> cancel <id> -m "<why>"`
  (result line: `orc=<id> outcome=cancelled reason=<short>`), and the
  card's status becomes `abandoned`. Note ACCEPTED is terminal —
  cancel is for runs still in flight. `orc cancel` records the
  invoking `$USER` as the cancelling party and nothing else (§4).
- **Mid-flight adoption / no history replay.** When a task is already
  in flight at adoption time, open its run at the CURRENT state only:
  claim, record the latest outcome, bind the live head. Never replay
  historical attempts — orc fingerprints the live worktree head at
  bind time, so a replayed historical rejection binds to the *current*
  candidate's fingerprint, and a fingerprint with a recorded rejection
  is permanently barred from assurance in that run (each later
  dispatch opens a fresh attempt instead of assuring). A run poisoned
  this way is closed by operator cancel with a transcription-artifact
  reason and a successor run opened cross-referencing it (observed
  2026-09-03 in the originating repo's first adoption).
- **Crash recovery.** **All dispatches are watchtower-only.** A ship
  or assurance seat unsure of state runs read-only inspection
  (`orc status <id>`, `orc show <id>`, `orc history <id>`) and
  reports; it never runs `orc dispatch` to "find out where things
  are".

  **Re-dispatch is not unconditional, and this OVERRIDES the generic
  `orc-ledger` skill's guidance that re-running a dispatch is always
  safe.** It is not safe here, because this repo redefines ACCEPTED
  as "verified **and** merged" by withholding the accepting dispatch
  until after the squash-merge (§3, §5 step 6). If a crash loses the
  watchtower between the accepted verdict and the merge, a blind
  re-dispatch exits 0 and marks the run ACCEPTED with the work still
  unmerged — demonstrated empirically: accepted verdict recorded, the
  candidate commit not an ancestor of trunk, re-dispatch exits 0,
  run ACCEPTED. That is a false trunk record, and orc offers no undo.

  Before any recovery dispatch the watchtower MUST inspect both:

      orc status <id> --journal <root>/.orc     # (a) latest recorded verdict
      git merge-base --is-ancestor <candidate-sha> <trunk> && echo MERGED || echo NOT-MERGED

  Then:

  - **No accepted verdict recorded** (pending outcome, pending
    assurance, or a rejected verdict) — re-dispatch is safe; it
    advances to the next legal state named in the `next:` block.
  - **Accepted verdict recorded and the candidate IS an ancestor of
    trunk** — the merge happened and only the accepting dispatch
    was lost. Re-dispatch; ACCEPTED is then true.
  - **Accepted verdict recorded and the candidate is NOT an ancestor
    of trunk** — **do not dispatch.** The merge is the missing
    step. Re-run the staleness check, squash-merge, and only then run
    the accepting dispatch (§5 step 6 ordering, unchanged).

  Read the `next:` block for the mechanically legal command, but the
  ordering rule above decides whether to run it. The journal outranks
  memory about what was recorded; git decides whether the work is
  actually on trunk (§2 rule 1).

## 7. Coexistence with the existing pipeline

- **Trunk mode is unchanged** (`DELIVERY-MODES`): squash-commit messages remain the audit record; orc adds a
  replayable in-flight ledger, it does not replace the trunk record.
- **The gate is unchanged**: `node scripts/check.mjs` green is still
  a merge precondition; orc records outcomes, it never gates.
- **Async multi-agent reality maps to orc's pending/incremental
  mode**: a run resting at exit 3 *is* our "ship agent working in a
  worktree" or "verification in flight". Nothing polls; each seat
  pushes its record when it finishes, and the watchtower's
  re-dispatch advances state. `orc dispatch --run-id <id> --wait --timeout <s>`
  is available when the watchtower wants to block on a settlement;
  prove a wait fires once before relying on it.
- **Watchtower situational awareness**: bare `orc` (no subcommand),
  run from the primary root — or anywhere with
  `ORC_JOURNAL_DIR=<root>/.orc` — prints the run portfolio;
  `orc status <id>`, `orc show <id>`,
  `orc history <id>`, `orc report <id>` go progressively deeper;
  `ergo --dir <root> list` is the board.
- **Existing cards and decisions are not migrated at adoption**:
  the method applies from adoption forward; in-flight work finishes
  on the old bookkeeping.
- **Skills**: seats load `.agents/skills/delivery-loop` (ship) and
  the watchtower loads `.agents/skills/watchtower-loop`; the
  generated `.agents/skills/orc-ledger` skill is the generic orc seat
  protocol both defer to. **Where the generic `orc-ledger` skill and
  this document disagree, this document governs in this repo** — it
  is upstream-generated and repo-agnostic, and is not edited here.
  Two disagreements are live today: unconditional re-dispatch as
  crash recovery (§6 overrides it) and its framing of the ledger as
  ground truth for "what work exists" (§2: that is ergo's column;
  the journal owns attempt/candidate/outcome/verdict history).
  Planning/backlog curation needs no skill beyond this document.
- **Task-card statuses** follow §2, "Task-card status after
  adoption": `draft`, then `merged`/`abandoned` written by the
  watchtower at merge time; `dispatched` is retired for new cards and
  live state lives in ergo.

## 8. Provenance

Shaped from orc-werk's adoption and onboarding guidance
(`PRODUCT-ADOPTION`, `PLAYBOOK-AGENT-ONBOARDING`,
`PLAYBOOK-ERGO-COEXISTENCE`, `PLAYBOOK-AGENT-CLI`; invariants
`INV-003`, `INV-020`, principles `P-003`, `P-004`, `P-008`, `P-011`,
`ADR-0005`) — external evidence, not contract for this repo; this
document is operable without them.

**Command verification.** The loop was executed end-to-end in the
originating repo against orc-werk and ergo 6.0.1 on 2026-09-03 (full
accept loop, rejected/fix-round path, cancel, uppercase run ids, ergo
sequence/claim/done). An adversarial verification round re-executed it
and a fix round re-confirmed, on the same date: the bootstrap gap (a
dispatch-config write into a non-existent `<root>/.orc/` fails before
orc runs) and the bootstrap steps in §1; `ergo result`'s 120-character
cap (the prose form measures 131 and is rejected, the compact form 108
and is accepted); `ergo done` succeeding with no prior result; and
`ergo init` idempotency. The BLOCKED-run `ERR-CONFLICT` and the
accepted-verdict-without-merge redispatch (§6) were demonstrated by
that verification round. Re-verify against your installed versions
when adopting.

**AGENTS.md onboard block.** `orc onboard` can generate a block
delimited by `<!-- BEGIN/END ORC-LEDGER AGENTS BLOCK -->` in
`AGENTS.md`. The starter ships a hand-written equivalent ("Delivery
ledger (orc)" in `AGENTS.md`) instead. If you do run `orc onboard`,
**two** of its generated sentences must be re-adapted every time,
because regeneration overwrites them:

1. The generated dispatch-config sentence ("Dispatch configs default
   via profile `.orc/profile.json`; no adapter blocks need to be
   specified.") is replaced by this repo's per-run git-candidate
   binding, pointing at §5 and noting the profile stays `{}`.
2. The generated skill-pointer sentence gains "generic" and a
   trailing clause naming `ORC-ERGO-DELIVERY` as this repo's binding
   loop, so the precedence rule in §7 is visible from `AGENTS.md`.

**Seed rulings baked into this document** (an adopting repo may
re-open any of them as its own `DECISION-LOG` entry): the authority
map and card lifecycle (§2); root-local, gitignored state with an
explicit bootstrap (§1); run-id = ergo task id, one run/one task/one
work, compact `key=value` result strings (§3, §5 step 7); assurance
seats write the journal only (§2 rule 3); all dispatches
watchtower-only with conditional crash recovery (§6).
