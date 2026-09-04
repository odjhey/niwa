---
id: ACPX-SEATS
type: playbook
status: current
authority: informative
description: 'Driving seats through acpx when the harness has no native subagent capability — session setup, no-wait dispatch and polling, follow-ups, reading the transcript.'
---

# Driving seats through acpx

When the harness cannot spawn subagents natively, seats run as external
agent processes over the agent-client-protocol via `acpx`
(`OPERATING-MODEL`). One worked example with the `pi` agent below; other
ACP agents follow the same shape. Model and effort come from the seat
defaults table in `AGENTS.md` (Project specifics).

## Start a named session with model and effort

```bash
SESSION=my-task
MODEL=openai-codex/gpt-5.6-sol
EFFORT=high

acpx --format json --model "$MODEL" \
  pi sessions ensure -s "$SESSION"

acpx --format json \
  pi set thought_level "$EFFORT" -s "$SESSION"
```

## Dispatch with `--no-wait`, then poll (the default)

Dispatch is non-blocking by default: a seat's turn can run for a long
time, and a blocking wait couples the watchtower's process to the seat's
lifetime — a dropped pipe orphans the run, and one watchtower cannot
drive many seats. With `--no-wait` the turn's state lives with the
session, pollable from anywhere:

```bash
count() {
  acpx --format json pi sessions read "$SESSION" |
    jq '[.. | .stopReason? | select(. != null)] | length'
}

before=$(count)

acpx --format json --json-strict \
  pi -s "$SESSION" --no-wait "Your prompt"

until [ "$(count)" -gt "$before" ]; do sleep 60; done
```

A turn's terminal record is identified by `stopReason` — usually
`end_turn` — so the poll watches for a new one to appear in the session
history:

```json
{"id":2,"result":{"stopReason":"end_turn"}}
```

`acpx --format json pi status -s "$SESSION"` gives a cheap liveness
snapshot of the seat process between polls
(`{"action":"status_snapshot","status":...}`).

If the repo tracks delivery through a ledger CLI, prefer its bundled
dispatch/resume commands — they wrap this dispatch-and-poll loop and
record the outcome in the same motion; the raw loop above is the
no-tooling fallback. Blocking mode (omit `--no-wait`) is for short
one-shot turns only.

## Send a follow-up

Model and effort remain configured on the session. This is how a
corrective round reaches the same seat — with the verifier's findings
verbatim in the prompt (`OPERATING-MODEL`, Pipeline step 4). Same
dispatch-and-poll loop:

```bash
acpx --format json --json-strict \
  pi -s "$SESSION" --no-wait "Your follow-up"
```

## Read the resulting conversation

```bash
acpx --format json pi sessions read "$SESSION"
```
