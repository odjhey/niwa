---
id: TEMPLATE-VERIFY-BRIEF
type: template
status: current
authority: informative
description: 'Template for a verification-scout dispatch brief — adversarial audit with named probes, run-the-claims, and a structured verdict.'
---

# Verify brief template

Handed to a verification scout for one implementation change. The verifier
is adversarial and read-only: it audits, it does not fix. Its method is
`ENGINEERING-METHOD` §3 (two axes, evidence ladder, tautological-test hunt);
its role and verdict semantics are `OPERATING-MODEL` (Verification scouts).

Authoring rules:

- **Plant named probes.** Generic "review this" finds generic things. Name
  the specific paths you fear ("walk the retry path — can X deadlock?",
  "what happens at the empty-input boundary?"). Planted probes find the
  worst bugs.
- **Instruct run-the-claims.** The verifier executes the PR/report's own
  examples and verification commands rather than admiring them.
- **Independent derivation.** Any identity a verdict rests on (commit sha,
  hash, count) the verifier computes itself from the artifact — never
  copied from the claim. A mismatch is the system working: report it, never
  reconcile it away.

Dispatch prompt skeleton:

```markdown
# Verify: TASK-XXX — <title>

You are an adversarial verification scout. Read-only: you audit and report;
you fix nothing. Your job is to find where this change is wrong, not to
confirm it is right.

## The change

- Branch/PR: <ref>. Record the exact head commit you audit (derive it
  yourself with `git rev-parse`; do not copy it from the report).
- Shipper's report/PR body: <where>.

## Required reading, in order

1. The governing docs: <paths + IDs from the task card>
2. `docs/delivery/task-cards/TASK-XXX.md`
3. The full diff against trunk.

## Audit both directions

1. Does the diff conform to the governing docs — checked against actual doc
   text, not plausibility?
2. Did implementation expose gaps or errors in the docs? A contradiction
   with an existing doc is a first-class callout: cite the doc ID and state
   why it should be reopened. Never silently route around it.

## Named probes

- <probe 1: the specific failure path to walk>
- <probe 2>

## Standing checks

- Run the claims: execute the report's verification commands and any usage
  examples; paste what you observed.
- Hunt tautological tests: find any test that cannot fail (asserts the
  implementation against itself, copies-then-mutates, or is skipped or
  trivially green).
- Confirm no gate was gamed: tests/checks deleted, skipped, weakened, or
  narrowed by this diff.
- Re-litigate the shipper's listed low-confidence calls.
- Read any decision records this change filed: confirm each really was
  local/mechanical (a contract-level choice recorded as local is itself a
  finding), and flag any it should have filed but didn't.
- Two axes, reported separately, never reranked across: **Spec** (matches
  governing docs and card) and **Standards** (repo conventions + smell
  baseline).

## Verdict format

1. **Verdict**: MERGE | MERGE-WITH-FOLLOW-UPS | FIX-BEFORE-MERGE, binding
   to the head commit you derived.
2. **Findings** — each with severity, evidence graded on the ladder
   (asserted → cited file:line → failure path walked → ran the real code →
   reproduced), and whether it blocks merge. Anything below "ran the real
   code" is marked unproven.
3. **Doc amendments needed** — with the doc ID each amends.
4. **Dismissed** — what you considered and rejected, one-line rationale
   each (the operator's override channel).
5. **Positively verified** — what you actively confirmed, with the command
   or file:line evidence. A green gate is an input to this verdict, never
   the verdict.
```

When the repo runs `ORC-ERGO-DELIVERY`, the brief also carries the run id
and the recording step — the verifier's **only** write, against the head
sha it derived itself:

    <orc invocation> record <id> --work work-1 --verdict accepted|rejected --derived-identity '{"head_sha": "<self-derived>"}' --finding "<one per finding>" --model <model> --seat-ref verify --journal <repo-root>/.orc

MERGE and MERGE-WITH-FOLLOW-UPS map to `accepted` (follow-ups ride
`--finding`); FIX-BEFORE-MERGE maps to `rejected`. A derived-identity
mismatch with the bound candidate is reported, never reconciled away.

Findings that block merge go back to the **same ship agent on the same
branch** as a corrective round carrying the findings verbatim
(`OPERATING-MODEL`, Pipeline step 4).
