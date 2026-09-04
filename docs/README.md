---
id: DOCS-ROOT
type: reference
status: current
authority: normative
description: 'Docs root — doc types, stable IDs, and authority precedence for this repository.'
---

# Docs root

This directory is the source of truth for what the system means and how it is
delivered. Code implements what these docs specify; when code and a normative
doc disagree, the doc wins until the doc is amended. For operator commands,
see the informative [repository script-usage guide](../README.md).

## Doc types and authority

Every doc carries frontmatter with a stable `id`, a `type`, a `status`, an
`authority`, and a `description` — all five are required and machine-checked
(`docs/scripts/docs-check.mjs`, run by the gate):

- `type`: `contract | decision | index | ledger | plan | playbook | reference | task-card | template`
- `status`: `current | draft | superseded | retired` (task cards additionally
  use `dispatched | merged | abandoned`)
- `stale_after` (optional): ISO-8601 date after which the doc must be
  re-checked before relying on it. There are no `created_at`/`updated_at`
  fields — git history is the freshness signal.

Authority is one of:

- **`normative`** — specifies behavior. Contracts, schemas, protocols,
  scenarios, conformance requirements. Implementations must conform;
  contradicting code is a defect in the code (or grounds to reopen the doc,
  out loud — see the verification role in `OPERATING-MODEL`).
- **`informative`** — constrains *how* work is delivered, never what the
  product means. Playbooks, operating models, decision logs.

Precedence: normative docs > informative docs > anything an agent might infer.
Within normative docs, prefer the more specific ID when two apply.

**Draft authority.** A `draft` normative doc **binds implementations**:
it is the interim working rule, not a suggestion, and code contradicting
it is a defect exactly as with a `current` doc. The one exception is
conflict — where a `draft` normative doc contradicts a `current`
normative doc, the `current` doc wins, and the contradiction is filed
(as a decision record or a task) rather than resolved silently in code.
Where a family of specs shares an index (a subsystem registry, say), a
Status column in that index is the visible interim-rule signal
`DOC-WRITING-GUIDELINES` asks drafts to carry — one table showing every
spec's status is more reliable than per-file banners that drift out of
sync with the frontmatter they restate.

## Stable IDs

Docs are referenced by their frontmatter `id` (e.g. `OPERATING-MODEL`), never
by path alone — paths move, IDs do not. Rules:

- IDs are `UPPER-KEBAB-CASE`, unique across the repo, and never reused after
  retirement.
- Task briefs, PR bodies / merge records, and verification verdicts cite
  governing docs by ID.
- Frontmatter `description` values avoid an unquoted colon-space (`: `) —
  strict YAML parsers read it as a nested mapping. Single-quote the value if
  a mid-sentence colon is unavoidable.

## Registry

<!-- ADAPT: register your normative docs here as they are created. -->

| ID | Path | Authority |
|---|---|---|
| `DOCS-ROOT` | `docs/README.md` | normative |
| `OPERATING-MODEL` | `docs/delivery/operating-model.md` | informative |
| `DELIVERY-MODES` | `docs/delivery/modes.md` | informative |
| `ORC-ERGO-DELIVERY` | `docs/delivery/orc-ergo-delivery.md` | normative |
| `SEAT-RELIABILITY` | `docs/delivery/seat-reliability.md` | informative |
| `DECISION-LOG` | `docs/delivery/decisions/README.md` | informative |
| `DECISION-REVIEW-LOG` | `docs/delivery/decisions/reviews/README.md` | informative |
| `DRIFT-SMELLS` | `docs/delivery/drift-smells.md` | informative |
| `WALKTHROUGH-CORPUS` | `docs/walkthroughs/README.md` | informative |
| `WALKTHROUGH-RUNS` | `docs/walkthroughs/runs/README.md` | informative |
| `ENGINEERING-METHOD` | `docs/playbooks/engineering-method.md` | informative |
| `DOC-WRITING-GUIDELINES` | `docs/playbooks/doc-writing-guidelines.md` | informative |
| `NATIVE-SEATS` | `docs/playbooks/native-seats.md` | informative |
| `ACPX-SEATS` | `docs/playbooks/acpx-seats.md` | informative |
| `HEADLESS-SEATS` | `docs/playbooks/headless-seats.md` | informative |
| `TASK-CARDS` | `docs/delivery/task-cards/README.md` | informative |
| `TEMPLATE-TASK-CARD` | `docs/templates/task-card-template.md` | informative |
| `TEMPLATE-SHIP-BRIEF` | `docs/templates/ship-brief-template.md` | informative |
| `TEMPLATE-VERIFY-BRIEF` | `docs/templates/verify-brief-template.md` | informative |

## Conventions

- One doc, one concern; link between docs by ID rather than duplicating
  content. A doc that restates what the environment already shows is a cache
  that will go stale — cache only the expensive or unfindable fact.
- **Progressive disclosure**: entry points stay short and link deeper;
  a reader loads only what the task at hand needs. Detail lives in the
  specific doc, never inlined into the entry point.
- **Grepability**: write so `grep` finds things — stable IDs and exact
  tokens (commands, paths, error strings) over paraphrase; one fact in one
  place.
- **Ledgers are directories, not growing files**: anything appended over
  time (decisions, review sessions, walkthrough runs) is one small file per
  entry plus an index table of contents in the directory's README — never a
  single forever-growing append-only file.
- **Every doc is reachable**: either registered in the table above or linked
  from its directory's README (ledger entries use the latter). The checker
  enforces this in both directions — registry rows must resolve and match
  the doc's own frontmatter.
- Amendments to normative docs merge **before** the code they govern
  whenever possible.
- Run `node scripts/check.mjs` before committing doc changes; it validates
  frontmatter, links, and registry sync (`docs/scripts/docs-check.mjs`).
- To find a doc, query the frontmatter:
  `node docs/scripts/find-docs.mjs --type playbook`, `--authority normative`,
  `--id OPERATING-MODEL`, or free-text terms. Superseded/retired/stale docs
  are hidden by default. Writing patterns and anti-patterns:
  `DOC-WRITING-GUIDELINES`.
