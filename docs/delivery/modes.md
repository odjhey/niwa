---
id: DELIVERY-MODES
type: playbook
status: current
authority: informative
description: 'The two delivery modes — pr (forge-hosted pull requests) and trunk (local merges) — and where the audit trail lives in each.'
---

# Delivery modes

The repository declares exactly one delivery mode in `AGENTS.md`. Both modes
share the same pipeline (`OPERATING-MODEL`): scout → docs-first → ship in a
worktree branch → adversarial verify → watchtower merges. They differ only in
**how a verified branch reaches trunk** and **where the audit trail lives**.

Pick `pr` when the repo lives on a forge (GitHub or similar) and you want
CI, review threads, and a hosted record. Pick `trunk` when there is no forge
in the loop — local-only repos, air-gapped work, or solo projects where PR
ceremony adds latency without adding scrutiny. The adversarial verification
step is identical in both; `trunk` removes the hosting, not the rigor.

## Shared mechanics (both modes)

- Ship agents work in `.worktrees/<branch>`, one branch per task, branched
  from current trunk.
- The branch is mergeable only with a green `node scripts/check.mjs` **and** a
  MERGE-class verdict from a verification scout.
- The watchtower merges; ship agents never do.
- Verdict staleness applies identically: a verdict binds to the commit it
  judged; check `git patch-id` before merging a refreshed branch
  (`OPERATING-MODEL`, Pipeline step 5).

## `pr` mode

1. Ship agent pushes the branch and opens a pull request. The PR body
   carries: scope, governing doc IDs, design decisions, gate output, and
   "Ambiguities encountered".
2. Verification scout posts its verdict on the PR thread, citing the head
   commit it judged.
3. Fix rounds happen on the same PR; each round's findings and resolution
   land on the thread.
4. Watchtower squash-merges after refreshing against trunk (re-verify on
   content drift, per the staleness rule) and deletes the branch/worktree.
5. CI runs the same `scripts/check.mjs` as a required status check, so green
   locally means green remotely.

**Audit trail:** the PR body and thread are the record — verdicts, rulings,
and fix rounds live there. `DECISION-LOG` still records durable rulings and
deferrals (a PR thread is searchable but not an index).

## `trunk` mode

No forge is assumed; git is the whole record.

1. Ship agent completes the task on its worktree branch and reports back:
   scope, governing doc IDs, design decisions, gate output, ambiguities.
2. Verification scout audits the branch diff against trunk and returns its
   verdict, citing the commit it judged.
3. Fix rounds happen on the same branch, dispatched with the findings
   verbatim.
4. Watchtower squash-merges locally. The **squash-commit message is the
   audit record** and carries, in this order:
   - summary line (conventional-commit style),
   - governing doc IDs,
   - verification verdict + the commit id it judged,
   - ambiguities encountered (or "none"),
   - follow-ups spun off, if any.
5. The branch and worktree are removed after merge.

**Audit trail:** structured squash-commit messages (reconstructable via
`git log`), plus `DECISION-LOG` for rulings, trade-offs, and deferrals that
would otherwise be buried in commit history.

Example trunk-mode squash-commit body:

```
feat: enforce retry bound on delivery attempts

Governing-Docs: CONTRACT-DELIVERY, SCENARIO-RETRY-EXHAUSTION
Verdict: MERGE-WITH-FOLLOW-UPS (judged a1b2c3d)
Ambiguities: none
Follow-ups: doc amendment to CONTRACT-DELIVERY §3 (tracked in DECISION-LOG 2026-08-31)
```

## Switching modes

Switching is one edit to `AGENTS.md` plus, when moving to `pr`, wiring CI to
run `scripts/check.mjs` as the single required check. Records already written
stay where they were made; nothing is migrated.
