---
id: TASK-012
type: task-card
status: merged
authority: normative
description: 'Recover transcript release conformance after run 22W4Z7 exhausted and repair signed-mtime handling and stale release-blocker prose.'
provenance: 'Successor to TASK-011 / orc 22W4Z7 candidate 5d30df7 after final Luna rejection and assurance-index defect, 2026-09-05'
---

# TASK-012 — Recover transcript release conformance

## Outcome

The complete useful TASK-011 candidate is recovered onto a fresh branch, default
transcript discovery handles every signed epoch mtime correctly, active package
and adoption docs agree that transcript conformance is complete, and release
packaging can proceed.

## Governing docs

- `LANE-WATCHDOG-CONTRACT`
- `TASK-011`
- `TASK-010`
- `TASK-007`
- `ENGINEERING-METHOD`

## In scope

- Recover the full intended diff from rejected candidate
  `5d30df770641821bd616b1160342e981d6cb89e2` without its defect.
- Accept signed decimal BSD-stat epoch mtimes, including pre-1970 values, and
  choose the greatest valid value without a numeric sentinel assumption.
- Preserve the byte-lexicographic equal-mtime tie rule and all TASK-011 cases.
- Remove now-stale “release blocked on transcript conformance” prose from
  `LANE-SUPERVISION-ADOPTION` and `DECISION-0004`.
- Re-run mutation and clean-cwd evidence on the fresh candidate.

## Out of scope

- Package/archive implementation, release tag, GitHub Release, binary/npm,
  contract restructuring, Linux, process ownership, automatic remediation, or
  seat-policy changes.
- Repairing orc-werk's assurance-indexing defect; report it separately.

## File territory

- `.agents/skills/watchtower-loop/lane-watchdog.sh`
- `.agents/skills/watchtower-loop/lane-watchdog.test.mjs`
- `docs/contracts/lane-watchdog.md`
- `docs/playbooks/lane-supervision-adoption.md`
- `docs/delivery/decisions/0004-lane-watchdog-distribution.md`
- `README.md`
- `docs/delivery/task-cards/TASK-012.md` and the `TASK-CARDS` index

Do not edit package tooling, other decisions/cards, skills, `AGENTS.md`,
templates, or delivery contracts.

## Must not change

- Every existing sensor, lock, suppression, cleanup, output, threshold, and
  alert-only behavior outside transcript startup discovery.
- Explicit empty/nonempty transcript values and no-match behavior from the
  recovered candidate.
- Do not delete, skip, weaken, or narrow tests or checks.

## Acceptance criteria

1. Fresh branch contains the intended TASK-011 behavior and docs changes,
   traceable to rejected candidate `5d30df7`, without merging that candidate.
2. Stat mtimes accept exactly signed or unsigned base-10 integers; malformed,
   fractional, or whitespace-bearing values remain non-conclusive and skipped.
3. Selection uses an explicit “have candidate” state rather than `-1` or any
   numeric sentinel, so all-negative candidate sets select the greatest value.
4. Tests cover negative-only sets, mixed negative/zero/positive sets, signed
   malformed values, equal negative ties, no-match, explicit values, paths,
   locales, and external sensor continuation. All prior 35 candidate tests and
   original 28 behaviors remain.
5. A mutation restoring unsigned-only filtering or a `-1` sentinel goes red
   against the new negative-epoch tests outside the repository; prior unmatched
   glob and tie-break mutations remain red.
6. Contract/README runtime dependencies and transcript semantics match source.
   `LANE-SUPERVISION-ADOPTION` and `DECISION-0004` no longer claim release is
   blocked on transcript conformance; release remains planned, not published.
7. Exact clean-cwd and explicit-empty bounded probes exit 0 with clean stderr;
   syntax, focused suite, full gate, and diff checks pass.
8. No package implementation or unrelated behavior/policy change.

## Verification commands

```bash
/bin/zsh -n .agents/skills/watchtower-loop/lane-watchdog.sh
node --test .agents/skills/watchtower-loop/lane-watchdog.test.mjs
rg -n 'blocked until.*conform|release.*blocked.*conform|non-conform' \
  README.md docs/contracts/lane-watchdog.md \
  docs/playbooks/lane-supervision-adoption.md \
  docs/delivery/decisions/0004-lane-watchdog-distribution.md
node scripts/check.mjs
git diff --check master...HEAD
```
