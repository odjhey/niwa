---
id: TASK-011
type: task-card
status: draft
authority: normative
description: 'Make transcript discovery conform to the public lane-watchdog contract before release packaging.'
provenance: 'TASK-010 accepted follow-up and Luna verification finding, run BXZTZI, 2026-09-04'
---

# TASK-011 — Conform transcript discovery for release

## Outcome

The watchdog starts cleanly when no default watchtower transcript exists,
preserves explicit empty/nonempty `WD_TRANSCRIPT` values, and remains able to
monitor external lanes; release `0.1.0` is no longer blocked by transcript
discovery non-conformance.

## Governing docs

- `LANE-WATCHDOG-CONTRACT`
- `TASK-010`
- `TASK-007`
- `ENGINEERING-METHOD`

## In scope

- Replace shell-glob-prone default transcript discovery with native zsh
  null-safe newest-file selection.
- Distinguish unset `WD_TRANSCRIPT` from an explicitly set empty value.
- Add deterministic real-entry tests and mutation-red evidence.
- Remove `ls`/`head` from documented runtime host requirements if the
  implementation no longer invokes them.
- Remove the explicit transcript release blocker after conformance is proven,
  without claiming the release has been published.

## Out of scope

- Package/archive implementation, tags, GitHub Releases, or release automation.
- Sensor thresholds/evidence, alert labels, locking, process actions, project
  ownership, Linux support, or seat policy.
- Contract restructuring/length reduction; that accepted follow-up is tracked
  separately.

## File territory

- `.agents/skills/watchtower-loop/lane-watchdog.sh`
- `.agents/skills/watchtower-loop/lane-watchdog.test.mjs`
- `docs/contracts/lane-watchdog.md`
- `README.md`
- `docs/delivery/task-cards/TASK-011.md` and the `TASK-CARDS` index

Do not edit package tooling, adoption/headless docs, decisions, skills,
`AGENTS.md`, templates, or delivery contracts.

## Must not change

- Every existing Codex, Claude, Antigravity, lock, suppression, cleanup,
  heartbeat-threshold, and alert-only test remains.
- Explicit nonempty transcript paths remain verbatim inputs.
- Absence of a heartbeat transcript disables only heartbeat evaluation; it must
  not disable external-lane sensors or manufacture idleness.
- Do not delete, skip, weaken, or narrow tests or checks.

## Acceptance criteria

1. When `WD_TRANSCRIPT` is unset, native zsh selection chooses the newest
   matching `~/.claude/projects/<cwd-slug>/*.jsonl` by mtime without parsing
   `ls` output.
2. With no matching files, transcript resolves to empty, no zsh `nomatch` or
   stderr occurs, external sensors still execute, and bounded mode exits 0.
3. Explicit nonempty `WD_TRANSCRIPT` is used verbatim; explicitly empty
   `WD_TRANSCRIPT` remains empty and disables heartbeat lookup without falling
   back to discovery.
4. Paths containing spaces and equal mtimes are handled deterministically; the
   tie-break is specified and tested.
5. Real-entry fake-command tests cover unset/no-match, unset/newest, explicit
   empty, explicit nonempty, and an external Antigravity claim with no
   transcript. Existing 28 tests remain.
6. A mutation restoring the unmatched glob/default expansion goes red against
   the new regression outside the repository.
7. If `ls` and `head` are removed from runtime, source, root prerequisites, and
   package manifest requirements agree; no unrelated dependency changes.
8. The package contract's known transcript non-conformance blocker is removed
   only after tests pass; release remains described as planned, not published.
9. Syntax, focused tests, bounded clean-cwd probe, full gate, and diff checks
   pass with no debug residue.

## Verification commands

```bash
/bin/zsh -n .agents/skills/watchtower-loop/lane-watchdog.sh
node --test .agents/skills/watchtower-loop/lane-watchdog.test.mjs
(
  probe_dir=$(mktemp -d "${TMPDIR:-/tmp}/watchdog-no-transcript.XXXXXX") || exit 1
  trap 'rm -rf -- "$probe_dir"' EXIT
  mkdir -p "$probe_dir/home" "$probe_dir/state" || exit 1
  HOME="$probe_dir/home" WD_STATE_DIR="$probe_dir/state" \
    WD_MAX_ITERATIONS=1 /bin/zsh .agents/skills/watchtower-loop/lane-watchdog.sh
)
node scripts/check.mjs
git diff --check master...HEAD
```
