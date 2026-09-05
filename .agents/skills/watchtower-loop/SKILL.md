---
name: watchtower-loop
description: 'Watchtower protocol for running this repo''s delivery pipeline on ergo (backlog, claims) and orc (dispatch, verdicts, acceptance). Use when coordinating delivery — intake of task cards, dispatching ship or verification seats, handling verdicts, merging, or closing out work.'
---

# Watchtower delivery loop

You are the dispatcher, acceptor, and sole operator of the delivery
records: you curate the ergo backlog, run every `orc dispatch`, merge
verified work, and are the **only writer of terminal ergo states**.
You never execute or verify work you briefed (`OPERATING-MODEL`).
The binding contract, with every command exact, is
`docs/delivery/orc-ergo-delivery.md` (`ORC-ERGO-DELIVERY`) — load it
before deviating from anything here.

`orc` = the repo's canonical orc invocation, verbatim from
`ORC-ERGO-DELIVERY` §1 (aliases do not survive into spawned processes);
run ergo and orc against the primary checkout root (`--dir <root>`,
`--journal <root>/.orc`).

## Bootstrap (once per machine, before the first dispatch)

A fresh checkout has no `.orc/` and no `.ergo/`, and step 2 below
writes the run's dispatch config *into* `<root>/.orc/` — so that
write fails on a fresh root. Nothing self-initializes. Run, at the
primary root:

    mkdir -p <root>/.orc
    printf '{}' > <root>/.orc/profile.json
    ergo --dir <root> init

## The cycle

1. **Intake.** Card authored (status `draft`) → `ergo new task "TASK-NNNN — <title>"`
   (body = card path) → `ergo sequence` for dependencies. The ergo id
   becomes the orc run id.
2. **Dispatch.** `ergo list --ready` → `ergo claim <id> --agent
   <tier>@<seat>` → worktree + branch → `orc dispatch "<intent>"
   --run-id <id> --config <cfg>` with a git-candidate config bound to
   the worktree → launch the ship seat per `AGENTS.md` seat routing.
   Exit 3 is healthy; the seat works asynchronously.
3. **Bind.** Ship recorded its outcome → `orc dispatch --run-id <id>`
   binds the branch head as candidate (ASSURING) → dispatch the
   verification seat with the run id and branch.
4. **Verdict.** The verify seat records accepted/rejected with
   self-derived identity and findings. Rejected → fix round on the
   same branch, brief carrying the findings verbatim, back to step 3.
5. **Accept.** Verdict accepted → staleness check (`git patch-id`) →
   squash-merge with the trunk-mode audit message → **then**
   `orc dispatch --run-id <id>` (ACCEPTED, exit 0). Merge before the
   accepting dispatch, accepting dispatch before worktree removal.
6. **Close.** `ergo result <id> "orc=<id> candidate=<head-sha>
   trunk=<trunk-sha>"` → confirm the `Result recorded: …` line → then
   `ergo done <id>`. The summary is capped at **120 chars** and ergo
   rejects longer ones; the compact form above is 108. `ergo done`
   does *not* require a result, so a rejected result plus a done
   silently closes the task with no evidence — always confirm first.
   Then set the card's status to `merged` (the card's only other
   durable state is the `draft` it was authored in; `dispatched` is
   retired — live state is ergo's) and remove worktree and branch.

## Standing rules

- Situational awareness: bare `orc` with no subcommand (portfolio —
  run from the primary root, or set `ORC_JOURNAL_DIR=<root>/.orc`),
  `orc status|show|history|report <id>`, `ergo list`. The journal
  outranks **memory** on attempt/candidate/verdict history; it does
  not outrank `ORC-ERGO-DELIVERY` on what the method requires, and
  git — not orc or ergo — decides whether work is on trunk.
- **You alone run `orc dispatch`.** Ship and assurance seats inspect
  (`orc status|show|history`) and record their own observation; they
  never dispatch.
- Blocked (budget exhausted, exit 1) is **terminal — no continuation**.
  `orc dispatch --run-id <id> --max-attempts N` on a BLOCKED run exits
  `ERR-CONFLICT`; `max_attempts` persists only via `"max_attempts": N`
  in the run's per-run dispatch config JSON — the `--max-attempts`
  flag is not persisted and governs only the invocation it is passed
  to. Close the old side (`ergo result <id> "orc=<id> outcome=blocked
  successor=<new-id>"` → `ergo fail`), then open a **fresh card, fresh
  ergo task, fresh orc run**, cross-referencing the old ids in the new
  task body. Cancelled work closes both homes (`orc cancel`,
  `ergo cancel`). Vanished seats: recover the observation first;
  record reality, or `--abandon-work` (with `--abandon-by`) at a stuck
  ASSURING rest.
- **Crash recovery is conditional — this OVERRIDES the generic
  `orc-ledger` skill's "re-dispatching is always safe".** It is not
  safe here: ACCEPTED means "verified *and* merged" only because the
  accepting dispatch is withheld until after the merge, so a blind
  re-dispatch after an accepted verdict marks unmerged work ACCEPTED
  (exit 0, no undo). Before any recovery dispatch, inspect both:

      orc status <id> --journal <root>/.orc                              # latest verdict
      git merge-base --is-ancestor <candidate-sha> <trunk>               # merged?

  No accepted verdict → re-dispatch is safe. Accepted verdict **and**
  candidate already an ancestor of trunk → re-dispatch (only the
  accepting dispatch was lost). Accepted verdict and **not** an
  ancestor → **do not dispatch**: staleness check, squash-merge, then
  the accepting dispatch. Read `next:` for the legal command; this
  rule decides whether to run it. Full text: `ORC-ERGO-DELIVERY` §6.
- Assurance seats write the **orc journal only** (their verdict
  record). They stay read-only over source, worktrees, docs, and
  ergo (`OPERATING-MODEL`; `ORC-ERGO-DELIVERY` §2 rule 3).
- Attribution is per command: `orc record` carries `--model`/
  `--seat-ref`, `orc cancel` records `$USER`, `--abandon-work` takes
  `--abandon-by`, and plain `orc dispatch` records **no dispatcher
  identity** — your session and the merge commit are that identity's
  home.
- No seat verifies its own work; a transcribed record always names
  the seat that actually observed the fact.
- Where the generic `orc-ledger` skill and `ORC-ERGO-DELIVERY`
  disagree, `ORC-ERGO-DELIVERY` governs in this repo.

## Lane supervision (the watchdog)

Arm `lane-watchdog.sh` (this directory) as a persistent harness
monitor at session start whenever external seats will run — its
stdout lines become notifications. Sensors and thresholds are in the
script header; cross-project adoption rules and local policy separation
are in `LANE-SUPERVISION-ADOPTION` (`docs/playbooks/lane-supervision-adoption.md`).
Hard-won rules (from the originating repo's 2026-09-03 dogfood, nine revisions;
keep your own telemetry in `SEAT-RELIABILITY`):

- **Attribution before everything.** Evidence must bind to the process
  under test: per-process CPU (never a global file's mtime — any
  healthy sibling masks a stalled lane) and seat-owned files/transcripts
  (never stdout pipes — headless seats buffer). Candidate discovery
  remains machine-wide (not session-scoped); the detector checks
  per-PID evidence but does not establish project or process ownership.
- **Verify before killing.** An alert is a claim, not a verdict:
  check the process's CPU time and its tee/`-o` target before any
  kill — one wrong kill destroyed a healthy 6-minute verification.
- **Nudges are idle-gated.** The heartbeat keys on this session's
  transcript mtime, so it can only fire while the watchtower is
  genuinely idle — never mid-work.
- **Stall thresholds** (also in AGENTS.md and `HEADLESS-SEATS`): codex
  >15min at <2s CPU; alt seats >20min of transcript silence; two stalls on one brief →
  switch seats, don't retry a third time.
- **Kills orphan children.** After killing a codex lane, sweep for
  surviving `codex`/`code-mode-host` processes it spawned.
