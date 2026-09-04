---
id: NATIVE-SEATS
type: playbook
status: current
authority: informative
description: 'Driving seats through the harness''s native subagent features — spawn mechanism, seat definitions, model/effort per seat, background dispatch, and worktree isolation per watchtower harness (pi + pi-subagents, claude, codex).'
---

# Driving seats through native subagent features

When the watchtower's own harness can spawn subagents with isolated
context, that is the preferred spawning mechanism — before the acpx
(`ACPX-SEATS`) and headless (`HEADLESS-SEATS`) fallbacks. Roles and
pipeline are unchanged (`OPERATING-MODEL`); this doc caches how each
harness fulfils the native path.

Each row below was smoke-verified on 2026-09-02: the harness spawned a
real child agent (via its native mechanism, driven headlessly) that
returned a codeword, relayed verbatim to the parent. Flag and tool names
go stale — re-verify against `--help`/package docs after upgrades.

| Capability | `pi` (+ `pi-subagents`) | `claude` | `codex` |
|---|---|---|---|
| Spawn mechanism | `subagent` tool from `pi install npm:pi-subagents` | Task/Agent tool (built in) | collab tools from the `multi_agent` feature (stable; check `codex features list`) |
| Seat definitions | agent `.md` files: builtin roles (`scout`, `researcher`, `worker`, `reviewer`, `oracle`, `delegate`), project agents in `.pi/agents/**/*.md` | `.claude/agents/*.md`, or inline `--agents <json>`, `--agent <name>` | none observed — prompt-level role assignment |
| Model / effort per seat | agent frontmatter or `subagents.agentOverrides.<name>.model` (see package `docs/models.md`) | `model` field in agent frontmatter / `--agents` JSON | inherited from session |
| Background / parallel | background runs, FleetView, `/subagents-fleet` inspector, spawn budget (`maxSubagentSpawnsPerRun`, default 64) | parallel Task calls; `--bg` sessions reaped via `claude agents` | `codex agents` browses agent sessions on the shared daemon |
| Worktree isolation | per its `docs/workflows.md` | native worktree isolation | — |

## Notes per harness

- **pi** — the extension is the watchtower kit for pi: role-shaped
  builtin agents map well onto this repo's seats (recon → `scout`,
  ship → `worker`, verification → `reviewer`/`oracle`). Builtins use a
  strict tool allowlist and inherit the parent model unless overridden.
  It also ships external CLI runner agents (`claude-code`, `codex-exec`,
  `cursor-agent`) — a pi watchtower can drive other harnesses as seats
  through them, bridging to `HEADLESS-SEATS`. Verified here: only the
  12 package agents are discovered in this repo — `.agents/skills/`
  files are not misread as agents, despite pi's legacy `.agents/**/*.md`
  discovery.
- **claude** — `--agents <json>` composes with `-p`, so a headless
  watchtower turn can define and spawn custom seats in one invocation
  (verified). Persistent seat definitions belong in `.claude/agents/`.
- **codex** — `multi_agent` gives in-session spawn/wait collab tools and
  works under `codex exec` (verified). It offers the least seat-shaping:
  no per-seat definition files observed; roles are assigned in the
  prompt.

Whatever spawns the seat, the brief is the same: governing doc IDs, a
checkable definition of done, and the seat defaults table in `AGENTS.md`
(Project specifics) for model and effort.
