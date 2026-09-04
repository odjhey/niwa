---
id: HEADLESS-SEATS
type: playbook
status: current
authority: informative
description: 'Driving seats through other harnesses'' headless / non-interactive modes (agy -p, pi -p, claude -p, codex exec) — one-shot dispatch, session resume for follow-ups, machine-readable output.'
---

# Driving seats through headless harness modes

When the harness cannot spawn subagents natively (`NATIVE-SEATS`), the
preferred fallback is an agent-client-protocol CLI (`ACPX-SEATS`). The
alternative documented here is to invoke another harness's **headless /
non-interactive mode**
directly: a one-shot process that takes a prompt, runs a full agentic
turn, prints the result, and exits. Roles and pipeline are unchanged
(`OPERATING-MODEL`) — only the spawning mechanism differs.

Compared to acpx, headless invocations are blocking: the dispatching
process waits for the turn to finish, and a dropped pipe orphans the run.
When the dispatching harness manages detached background processes
itself, the SOP below removes that risk and makes headless suitable for
parallel lanes and longer turns; otherwise run long ship-agent turns
under `nohup`/a terminal multiplexer or prefer the acpx
dispatch-and-poll loop.

A seat needs three capabilities; each harness below was smoke-verified
(this table caches flag names, which are expensive to rediscover —
re-verify with `--help` if a CLI has been updated):

| Capability | `agy` (Antigravity 1.1.26) | `pi` | `claude` | `codex` |
|---|---|---|---|---|
| One-shot dispatch | `agy -p "<prompt>"` | `pi -p "<prompt>"` | `claude -p "<prompt>"` | `codex exec "<prompt>"` |
| Follow-up on same session | Fresh corrective brief (`DECISION-0002`; resume deferred) | `--session-id <uuid>` (creates if missing; reuse to resume) | `--output-format json` returns `session_id`; resume with `--resume <id>` | `codex exec resume --last` (or `resume <id>`) |
| Machine-readable output | `--output-format json` (conversation id, result/status, duration, usage) | `--mode json` (JSONL events; `turn_end` carries `stopReason`, usage, cost) | `--output-format json` (single result object) or `stream-json` | `--json` (JSONL events; `turn.completed` carries usage) |

Model and effort come from the seat defaults table in `AGENTS.md`
(Project specifics): `agy --model <model>`,
`pi --model <provider/id> --thinking <level>`, `claude --model <id>`,
`codex exec -m <model>`.

## Worked example: dispatch + corrective follow-up

The same general pattern applies across harnesses, adapted to their
session capabilities; `claude` and `agy` shown, differences noted in the
table above.

```bash
# Claude: capture the session id from the JSON result
out=$(claude -p --output-format json "Your ship/scout brief here")
sid=$(echo "$out" | jq -r .session_id)
echo "$out" | jq -r .result

# Corrective round to the same seat, verifier findings verbatim
claude -p --resume "$sid" "Verifier findings: ..."
```

For Antigravity (`agy`), the default ship seat, corrective attempts start
fresh with a self-contained brief rather than resuming, per `DECISION-0002`:

```bash
# First turn (default ship seat; points to file brief)
agy --model "Gemini 3.8 Flash (High)" \
  --dangerously-skip-permissions --print-timeout 20m \
  -p "Read the file /path/to/brief.md and execute it exactly as your ship brief in your current worktree." \
  > out.md 2> err.log

# Corrective turn starts fresh with self-contained corrective brief
agy --model "Gemini 3.8 Flash (High)" \
  --dangerously-skip-permissions --print-timeout 20m \
  -p "Read the file /path/to/corrective-brief.md and execute it exactly as a fresh corrective ship brief in your current worktree." \
  > out-corrective.md 2> err-corrective.log
```

For `pi`, generate the session id up front instead of parsing it out
(`SID=$(uuidgen | tr 'A-Z' 'a-z')`), pass `--session-id "$SID"` on the
first turn, and resume with the same id (`pi --session-id "$SID"`). For
`codex`, `codex exec resume --last` continues the most recent session —
safe only when one codex seat runs at a time; with several, capture and
resume by explicit session id.

## Background dispatch SOP (harness-managed)

When a repo adopts this as its standing seat mechanism (record the
ruling in `DECISION-LOG`): when the watchtower's own harness can run a
detached background process and notify on its exit (e.g. a background
shell tool), each seat is **one background job — dispatch-and-wait, not
dispatch-and-poll**:

1. Write the brief to a file; inline prompts of that size are
   shell-quoting-hostile.
2. Dispatch as a background job — independent lanes fire in parallel
   (default ship seat Antigravity shown; capture stdout/stderr):

   ```bash
   agy --model "Gemini 3.8 Flash (High)" \
     --dangerously-skip-permissions \
     --print-timeout 20m \
     -p "Read the file $(pwd)/brief-<lane>.md and execute it exactly as your ship brief in your current worktree." \
     > out-<lane>.md 2> err-<lane>.log
   ```

   (For harnesses using pre-generated session IDs such as `pi`:
   `SID=$(uuidgen | tr 'A-Z' 'a-z') && echo "$SID" > sid-<lane> && pi -p --model <model> --thinking high --session-id "$SID" "$(cat brief-<lane>.md)" > out-<lane>.md 2> err-<lane>.log`.)

3. **Startup liveness gate** (~60s after dispatch): the seat's
   attributable storage must exist. For Antigravity, an attributable
   conversation database appeared within 2 seconds in dogfood
   (`~/.gemini/antigravity-cli/conversations/<id>.db`); the watchdog
   contract threshold is 60 seconds. For `pi`, the session file must
   exist and grow. The session-created stderr warning is NOT sufficient —
   a hung seat has been observed printing it and then wedging before
   creating the session file. A process that is merely *alive* proves
   nothing — see the zero-CPU hang caveat below. A seat that fails the
   gate is killed and re-dispatched after a smoke test.
3a. **Bound every dispatch with an explicit timeout**: the standing
   Antigravity ship invocation includes `--print-timeout 20m` (the built-in
   5m default proved too short on bounded work and exited 1 with empty
   stdout and `Error: timeout waiting for response`; oversized cards are
   still split before dispatch). For harnesses without built-in timeouts,
   wrap with `timeout` (e.g. `timeout 3600 pi -p …`) sized generously above
   the expected turn length, so a hung seat self-terminates with a
   distinguishable exit code (124) instead of lingering indefinitely.
4. Wait for the harness's exit notification — no sleep/poll loop.
5. **Exit is not completion evidence** (`OPERATING-MODEL`, environment
   gotchas): before acting on a lane, corroborate exit code 0, a
   non-empty report that actually answers the brief, and clean stderr.
   Stdout may remain empty until final output, so pipe growth is not
   liveness. `--log-file` is diagnostic only; log file telemetry and
   retry chatter is not meaningful progress evidence.
6. Corrective rounds: Antigravity corrective attempts start fresh with
   a self-contained brief (findings + card + doc pointers); resume
   evaluation is deferred per `DECISION-0002`. For harnesses supporting
   resumption, resume the same seat with the saved session id
   (`pi --session-id "$SID"`; per-harness resume flags in the table
   above), carrying findings verbatim.

The acpx dispatch-and-poll loop (`ACPX-SEATS`) remains the fallback for
dispatchers that cannot hold background processes safely — there, a
dropped pipe orphans the run. Preference order remains native
(`NATIVE-SEATS`) > acpx (`ACPX-SEATS`) > headless.

## Verified dispatch shapes and stall signatures (2026-09-03/04)

Cached from a repo that ran ~20 verification dispatches through these
seats in two days (its telemetry method is `SEAT-RELIABILITY`).
Re-verify flags with `--help` when a CLI updates; the failure
signatures are the durable part.

- **Antigravity (`agy`) — dogfood-verified facts (version 1.1.26).**
  - **Invocations & flags**: print mode `agy ... -p`, JSON mode
    `--output-format json`. The built-in `--print-timeout` defaults to
    5 minutes; dogfood demonstrated this was too short for bounded docs
    sweeps, exiting 1 with empty stdout and `Error: timeout waiting for response`.
    The standing ship invocation must therefore include an explicit, sized,
    bounded `--print-timeout` (use 20 minutes as the default ceiling for
    this repo's already-bounded ship cards; oversized work is still split).
    Optional `--log-file <path>` provides diagnostics, but log growth is
    not meaningful progress because dogfood observed telemetry and retry
    chatter while waiting.
  - **Process signature**: exact process name is `comm=agy`.
  - **Machine-readable completion**: `--output-format json` completion
    carries conversation id, result/status where emitted, and duration/usage
    fields as supported by current output; avoid overstating fields not
    observed in practice.
  - **Attributable storage**: each live lane opens its own
    `~/.gemini/antigravity-cli/conversations/<id>.db` plus SQLite sidecars
    (`-wal`, `-shm`). In dogfood, an attributable conversation database
    appeared within 2 seconds of dispatch; the successor watchdog contract
    will use 60 seconds as the startup threshold. Per-conversation
    `.db`/`.db-wal` mtime is the proposed attributable progress evidence
    for the successor watchdog task.
  - **Buffering & liveness**: stdout may remain completely empty until
    final output is flushed at turn completion, so pipe growth is not
    liveness. Exit 0 is insufficient without a nonempty report that
    actually answers the brief and clean stderr.
  - **Corrective rounds**: corrective attempts start fresh with a
    self-contained brief (carrying verifier findings verbatim, task
    card, and governing doc pointers). Conversation resume flags exist
    in the CLI but remain unevaluated and deferred per `DECISION-0002`.
- **codex — brief via stdin, verdict via `-o`.** `exec` is required
  for headless use:

      codex exec --yolo --model <model> --config model_reasoning_effort=high -o <out-file> - < <brief-file>

  Large inline-argv briefs correlated with codex's intermittent
  **startup hang** (process alive, <0.1s CPU, no rollout file written;
  15–87 minutes lost per incident, ~40% of launches before the switch);
  the stdin shape passed a full-size brief in 6s and ran clean for
  every launch after. Treat **>15 minutes of rollout silence at ~zero
  CPU** as a stall: kill, relaunch, and after two stalls on the same
  brief switch seats. Sweep for surviving `codex`/`code-mode-host`
  children after any kill — timeouts orphan them. Detection must be
  per-process and per-lane (a lane's *own* open rollout file via
  `lsof`); a global rollout mtime is masked by any healthy sibling, and
  CPU alone false-positives on healthy network-bound lanes.
- **pi — the model flag is REQUIRED.** `pi --model <provider/id>
  --thinking high -p "<brief>"`. Bare `pi -p` falls to an unconfigured
  default provider and hangs silently at ~zero CPU (one 95-minute
  loss). Stall threshold >20 minutes of session-transcript silence.
- **claude on an alternate account.** `CLAUDE_CONFIG_DIR=<alt-config-dir>
  claude -p --dangerously-skip-permissions --model <id> "<brief>"`
  routes a headless seat through a second account's quota; tee output
  to a file. Such seats **buffer stdout**, so liveness is the seat's
  own session-transcript mtime under `<alt-config-dir>/projects/`,
  never the pipe. When the account is exhausted (rate-limit/quota
  errors), fall back to the primary in-harness seat and note the
  switchover in the ship record.
- **Two seats, one backend, one outage.** Seats that reach the same
  provider go down together — a single ~25-minute upstream outage
  suspended both default verification seats at once. Keep one seat on
  an independent provider, trialed per `SEAT-RELIABILITY` before it
  earns a policy slot.
- **Verify before killing.** A watchdog alert is a claim, not a
  verdict: check the process's CPU time and its tee/`-o` target
  before any kill — one wrong kill destroyed a healthy 6-minute
  verification. A reference watchdog with these sensors ships as
  `.agents/skills/watchtower-loop/lane-watchdog.sh`.

## Caveats observed during smoke verification

- Headless turns still load project context (AGENTS.md, hooks) and run
  with each harness's own permission regime — a seat refusing an action
  is a signal, reported, never worked around (`AGENTS.md`, hard rule 8).
- `claude --allowedTools` is **variadic** and will swallow a following
  positional prompt as extra rules, yielding a silent no-op turn
  (exit 0, empty output). Pass the prompt as the first positional
  argument and put `--allowedTools` after it — and corroborate every
  turn's report is non-empty (SOP step 5), which is what catches this.
- **`pi` seats can hang at startup with zero CPU, intermittently**
  (observed 2026-09-02, both on `--session-id` resumes and fresh
  sessions): the process stays alive indefinitely but never emits the
  session-created warning, never creates the session file, and burns
  ~0 CPU — the turn simply never started. Process existence is
  therefore **not** a liveness signal; use session-file mtime +
  cumulative CPU time. Detection: no stderr/session file within ~60s
  of dispatch (SOP step 3), or a mid-turn session `.jsonl` whose mtime
  stalls for many minutes at near-zero CPU. Remedy: kill the process
  tree, **smoke-test the seat** (trivial one-shot prompt with the
  exact flag set under `timeout`, expect the reply), then re-dispatch.
  For a corrective round whose original session is suspect, prefer a
  fresh session with a self-contained brief (findings + card + doc
  pointers) over a resume — the branch already holds the work, so no
  context is lost. The same smoke-test-then-verify discipline applies
  after any seat kill, before trusting the next dispatch.
  Hangs have correlated with **long inline prompts passed as argv**;
  after repeated wedges on one dispatch, switch to the short-prompt
  shape — write the full brief to a file and dispatch
  `pi -p … "Read the file <path> and execute it as your dispatch
  brief, exactly as written."` — which has started cleanly where the
  inline form hung.
- **Ship seats may try to spawn their own verification subagents**
  (over-reading the adversarial-verification hard rule) — observed
  producing hallucinated or off-repo reviews. Briefs must state:
  "Do not dispatch any verification yourself — the watchtower does
  that." Discard any self-verification claim in ship reports.
- `codex exec` refuses outside a git repo without
  `--skip-git-repo-check`; inside the repo no flag is needed.
- `pi --session-id` warns (`No project session found ... creating`) on
  first use of a fresh id — expected, not an error.
- Sessions are stored per project directory on the machine that ran the
  turn; resume from the same working directory.
