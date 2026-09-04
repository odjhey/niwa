---
id: TEMPLATE-SHIP-BRIEF
type: template
status: current
authority: informative
description: 'Template for a ship-agent dispatch brief — command-exact, zero-ambiguity, with per-step fallbacks and stop-and-report mechanics.'
---

# Ship brief template

The brief is the **just-in-time** artifact handed to a ship subagent at
dispatch: command-exact, with ordered required-reading and per-step
fallbacks. It is built from a task card (`TEMPLATE-TASK-CARD`) and dies with
the dispatch; the card is what endures. Do not dilute the brief toward
durability (`ENGINEERING-METHOD` §5).

Authoring rules (from `OPERATING-MODEL` and hard-won practice):

- **Zero ambiguity at dispatch.** Judgment stays with the watchtower;
  the shipper gets mechanical-once-specified work. If writing the brief
  requires a judgment call you haven't made, stop and make it (or route it
  to a docs change) before dispatching.
- **Every risky step carries an in-brief fallback** ("if X is unavailable,
  do Y and say so") — so a permission denial or missing tool degrades to a
  documented skip, not a stalled or improvising agent. Note: a subagent's
  permission prompts may surface in the *operator's* UI, not the
  watchtower's; a long-silent agent may be waiting on one.
- **Batch scope at dispatch time.** Mid-flight addenda to deep-in-work
  builders are unreliable — a shipper may (defensibly) reject an
  out-of-band instruction as suspected injection. If you must send one,
  reference the brief's own specifics so it is verifiably yours; otherwise
  hold it for a fix round.
- **Ordered required-reading is files, not vibes.** List exact paths in the
  order they should be read.

Dispatch prompt skeleton — fill every section; a section you cannot fill
means the task is not ready:

```markdown
# Task: TASK-XXX — <title>

You are a ship agent. You implement exactly what this brief specifies; you
never merge. Ambiguity splits by what it touches: contract-level →
stop-and-report (see Reporting), never guess; local/mechanical → implement
your recommendation and record it as a `review: pending` decision record
per `docs/delivery/decisions/README.md` — do not wait.

## Setup (run these exactly)

    git -C <repo-root> worktree add .worktrees/<branch> -b <branch> <trunk>
    cd <repo-root>/.worktrees/<branch>

A fresh worktree contains tracked files only. If the task needs untracked
local config (e.g. a `.env`), copy it in — never symlink:
    cp <repo-root>/.env .   # if applicable; if absent, report and continue

## Required reading, in order

1. `AGENTS.md`
2. `docs/...`            # the governing docs, by path, with their IDs
3. `docs/delivery/task-cards/TASK-XXX.md`

## Scope

<in-scope list, from the card>

## Hard rules

- Do NOT touch: <files owned by siblings or out of scope>.
- Do not delete, skip, weaken, or narrow any test, gate, or check to make
  it pass. A green gate reached by weakening the check is a rejected
  candidate.
- A guard, allowlist, or permission that refuses an action is reported,
  never worked around.

## Definition of done

<enumerable acceptance criteria, from the card>

## Verification (run before reporting done)

    <exact commands>
    node scripts/check.mjs

Paste the output in your report. If a command fails and the fix is out of
scope, stop and report rather than expanding scope.

## Delivery ledger (when the repo runs ORC-ERGO-DELIVERY)

Run id: `<id>`. Before anything tears down your worktree, record your
outcome — an observation, never an aspiration:

    <orc invocation> record <id> --work work-1 --outcome completed --evidence-ref "branch:<branch>" --model <model> --seat-ref <seat> --journal <repo-root>/.orc

Unsuccessful finish: `--outcome failed` with the reason as an evidence
ref. Never run `orc dispatch` (watchtower-only), never record a verdict,
never touch ergo or the card's status. If the command is refused, report
the refusal — the watchtower transcribes on your behalf.

## Fallbacks

- If <risky step> is unavailable/denied: <do Y> and say so in the report.

## Reporting

Finish with a report containing, in order:
1. **Scope delivered** — the reviewable claim, citing governing doc IDs.
2. **Design decisions** — choices the brief left to you (should be near
   zero; each one listed is a brief defect worth noting).
3. **Gate output** — verification command output, verbatim.
4. **Ambiguities encountered** — every contract-level ambiguity and the
   least-commitment stopgap you took. "None" is an acceptable answer;
   silence is not.
5. **Decision records filed** — list the `review: pending` records you
   created for local choices ("none" if none).
6. **Low-confidence calls** — anything you did that you are not sure about,
   for the verifier to re-litigate.
7. **Run id** — the orc run id you recorded against (when applicable).

<!-- pr mode: push the branch, open a PR whose body is the report above.
     trunk mode: leave the branch in the worktree; your report returns to
     the watchtower, which verifies and merges per DELIVERY-MODES. -->
```
