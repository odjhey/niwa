---
id: TASK-015
type: task-card
status: draft
authority: normative
description: 'Recover and complete the package determinism and link-syntax contract after TASK-014 exhausted its retry budget.'
provenance: 'Successor to TASK-014 / orc run-690aeb03dd90 candidate 4641142 after final paired rejection, 2026-09-05'
---

# TASK-015 — Complete package determinism and link-syntax contract

## Outcome

The useful TASK-014 contract candidate is recovered without merging its branch,
the three final contradictions are removed, and TASK-013 can implement one
closed release contract.

## Governing docs

- `LANE-WATCHDOG-CONTRACT`
- `TASK-014`
- `TASK-013`
- `DECISION-0004`
- `ENGINEERING-METHOD`

## In scope

- Recover the intended contract diff from rejected candidate
  `4641142f10cedb094975c1491be9744428c6f679` without merging that candidate.
- Correct the stale §5 precondition range from `2–9` to `2–10`.
- Make summary prose say other **link-like or tag-like** angled constructs fail,
  matching the exact non-tag prose ignore rule.
- Explicitly authorize and retain the normative release-notes
  `Source commit: <commit>` line and consumer `EXPECTED_COMMIT` binding added by
  the rejected candidate; this closes the provenance check rather than changing
  the GitHub Releases distribution channel.
- Preserve the exact Node/zlib pin, schema-1 toolchain field, reproducibility
  boundary, closed bracket/destination grammar, placeholder allowlist,
  incomplete-angle rejection, validation-only bundle pass, and complete
  consumer coordinate check.

## Out of scope

- Package implementation/tests, README/adoption updates, release/tag/push,
  watchdog runtime, dependencies, distribution channel/licensing, Linux, or
  contract restructuring/length reduction.

## File territory

- `docs/contracts/lane-watchdog.md`
- `docs/delivery/task-cards/TASK-015.md` and the `TASK-CARDS` index

Do not edit code, README/adoption/decisions, other cards, or delivery docs.

## Acceptance criteria

1. Full intended TASK-014 semantics are traceable to rejected candidate
   `4641142` without merging any TASK-014 commit.
2. The official packager toolchain, manifest fields, consumer fields, and
   within-toolchain reproducibility promise are exact and internally consistent.
3. Bracket and angle scans have one deterministic reading; all required unsafe
   forms refuse and current canonical adoption input conforms.
4. Exactly the three final findings are resolved: §5 says preconditions `2–10`;
   summary prose says other link-like/tag-like angles fail; release-notes source
   commit binding is authorized by this card and remains exact.
5. Release notes, peeled tag, manifest commit, and consumer
   `EXPECTED_COMMIT` must agree; the copyable command rejects a same-shape wrong
   lowercase SHA and every other coordinate mutation.
6. No code/runtime/distribution-channel change and no unrelated doc change.
7. Paired independent-provider verification confirms no contract ambiguity;
   docs query, full gate, and diff checks pass.

## Verification commands

```bash
node docs/scripts/find-docs.mjs --id LANE-WATCHDOG-CONTRACT
node scripts/check.mjs
git diff --check master...HEAD
```
