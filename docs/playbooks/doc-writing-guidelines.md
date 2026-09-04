---
id: DOC-WRITING-GUIDELINES
type: playbook
status: current
authority: informative
description: 'Portable guidelines for writing agent-first repo documentation — patterns and anti-patterns distilled from xatu-delivery-companion and orc-werk.'
---

# Doc writing guidelines (for agent-first repos)

> Imported from xatu-delivery-companion (2026-09-02, via knocknuk), which
> distilled it from a structured comparison of its docs and orc-werk's docs.
> Patterns are things one of those repos does that measurably helps coding
> agents; anti-patterns are failure modes actually observed in one of them.
> Portable: copy this file into any repo that wants agent-maintainable docs,
> then adapt the "starter kit" and "local adaptations" sections.

## Local adaptations (this repo)

- **No `created_at`/`updated_at` frontmatter** — git history is the freshness
  signal; a hand-bumped timestamp is an unenforced claim (anti-pattern 5).
  `stale_after` is the one optional freshness field, and the checker
  validates its format.
- The flat all-docs index role is played by the **registry table in
  `DOCS-ROOT`** (`docs/README.md`), kept honest by the checker's two-way
  registry-sync rule — there is no separate `INDEX.md`.
- The checker is `docs/scripts/docs-check.mjs`, run by the local gate
  (`node scripts/check.mjs`) together with its own test suite.

## Who these docs are for

The primary reader is a coding agent with a limited context window, no memory
of previous sessions, and a grep tool. The secondary reader is a human
operator skimming for review. Every guideline below follows from that: docs
must be **findable by query, trustable without archaeology, and cheap to
load**.

## Principles

1. **Docs are part of the product contract, not an appendix.** If behavior is
   ambiguous, fix the doc first; never invent semantics in code.
2. **One fact, one home.** Every normative statement lives in exactly one
   place; everything else references it. Duplication is how docs rot.
3. **Conventions that aren't machine-checked will drift.** Anything you
   require of authors (frontmatter, links, index sync) must be validated by a
   script wired into the commit/CI gate.
4. **Optimize for the reader's context window.** Many short template-shaped
   docs beat few monoliths. Target a median under ~120 lines; treat 300+ as a
   smell needing a split or a summary header.

## Patterns

### Structure and identity

- **Stable IDs, greppable and prefixed.** Give every doc an `id:` and every
  normative statement a sub-ID under a registered prefix table (`INV-`
  invariant, `CONTRACT-`, `DEC-` decision, `TASK-`, `SCN-` scenario,
  `GATE-`…). IDs are the navigation currency: `grep INV-007` must land on the
  rule's single canonical home.
- **No-duplication rule.** "Do not duplicate normative MUST/ONLY/REQUIRED
  prose. Reference its stable ID." Make this an explicit authoring rule, not
  a habit.
- **Authority precedence ladder.** A numbered list stating which doc kind
  wins when docs conflict (contracts > decisions > domain definitions >
  plans > playbooks > reports > superseded), plus the rule: *a conflict is a
  defect — surface it, don't silently pick*. Without this, agents guess.
- **`authority: normative | informative` on every doc.** Separates "defines
  required behavior" from "explains/records". Reports and research never
  override contracts.
- **Layered navigation, all redundant on purpose:** agent entry file
  (`AGENTS.md`) → docs constitution (`docs/README.md`) → per-directory
  `README.md` indexes → the docs themselves. Plus intent-based reading paths
  ("What is X?" → …) in the constitution.
- **Template-shaped doc families.** When a doc kind recurs (adapter,
  extension, task card, scenario, decision), give it a template in
  `docs/templates/` and a fixed section skeleton. Same-shaped docs are
  skimmable and diffable.

### Phrasing

- **Contracts as registries, RFC-2119 voice.** One `## INV-xxx — title`
  heading per invariant; "MUST / MUST NOT" phrasing; schema blocks (types,
  JSON) beside the prose.
- **Playbooks in second-person imperative with the why attached.** "You
  never record a decision — you submit inputs; the kernel decides." Rules
  stick better with one clause of rationale.
- **Task cards as dispatch briefs with a checkable definition of done:**
  Outcome / Exact scope / Out of scope / Must-not-change / Acceptance
  criteria / Verification commands / Hard stops ("park and report only
  if…"). Link to governing contract IDs.
- **Scenarios as executable specs.** Given/Then docs ending in a
  `Verifies: INV-004, INV-007` trailer, each mapping to a named automated
  test.

### Trust and lifecycle

- **Provenance frontmatter for agent-maintained corpora:** `generated:`
  (who/what produced it), `verified:` (which human confirmed, when),
  `sources[].credibility: primary | secondary | inferred`, `stale_after:`.
  Trust tiers derive from fields: generated-without-verified = agent
  recommendation; past `stale_after` = re-check before relying. Adopt a
  field only together with the check that enforces it.
- **Status lifecycle with supersession links:** superseded docs are retained
  and MUST link their replacement. Drafts carry a visible banner stating the
  interim working rule, so a draft is never a dead end.
- **Decision records as a supervision substitute.** Short options-considered
  records with "(chosen)" markers and a review field (`Decided by: agent
  recommendation / Review: pending`), so operators review asynchronously by
  scanning a directory.

### Enforcement and tooling

- **A docs checker in the gate.** A zero-dependency validator
  ([`docs/scripts/docs-check.mjs`](../scripts/docs-check.mjs) here) checks
  frontmatter schema and unique IDs, relative links, and registry/index
  sync, wired into the local gate and CI as its own unconditional job so a
  docs-only change can never skip it. Extend the same checker as additional
  machine-checkable conventions are adopted.
- **A frontmatter query tool**
  ([`docs/scripts/find-docs.mjs`](../scripts/find-docs.mjs) here), hiding
  stale/superseded docs by default so day-to-day queries only surface
  trustworthy content.
- **Maintenance rules addressed to agents explicitly:** new doc →
  frontmatter, then registry/directory index; supersede, don't delete.

## Anti-patterns (observed)

1. **Placeholder indirection.** Entry docs pointing to a "source of truth"
   that is an empty stub pointing back — every session pays a wasted read,
   and trust in links erodes. Never link to a doc that doesn't answer; inline
   the working rule until the real doc exists.
2. **Supersession-in-place.** A 900-line plan containing "the following older
   text is explicitly superseded" errata sections forces reading the whole
   doc to learn which paragraphs still bind. Move dead text to a
   `status: superseded` doc with a replacement link.
3. **Monolith plans.** 500+ line execution docs without per-section status
   exceed a comfortable single read and become supersession-in-place magnets.
   Decompose into milestone doc + task cards.
4. **Duplication tax.** Descriptions maintained by hand in frontmatter +
   directory README + flat index will drift; either generate the indexes from
   frontmatter or check sync mechanically.
5. **Unenforced freshness signals.** `updated_at`/`stale_after` fields that
   no tool checks go stale silently, which is worse than absent — they claim
   a freshness they don't have.
6. **Contradictory norms across entry docs.** One entry file saying "broken
   links may be intentional" while the constitution demands zero broken links
   leaves agents unable to classify a broken link as signal or defect. Entry
   docs must agree; the checker should enforce whichever rule you pick.
7. **Declared-but-empty linkage fields.** `verifies: []` on most task cards
   trains readers to ignore the field. Populate a linkage field from day one
   or leave it out of the schema.
8. **Citation-chain prose.** Playbook paragraphs chaining 5+ ID references in
   long qualified sentences tax the reader as badly as duplication; prefer
   one rule per bullet with at most 1–2 citations.
9. **Grep pollution.** Worktrees, vendored copies, or generated mirrors of
   the docs tree inside the repo break ID-grep as a retrieval strategy; keep
   them git-ignored **and** excluded in search tooling defaults.
10. **Doc-length monoculture at either extreme.** All-monoliths fail (see 3),
    but so do 11-line stub quartets that make readers open four files for one
    answer; a stub is only justified when a template requires the slot and
    the content is genuinely trivial.

## Starter kit for a new repo

Minimum viable set, in order:

1. `AGENTS.md` — one screen: numbered hard rules, the local gate command,
   worktree convention. Symlink `CLAUDE.md` (and other harness files) to it.
2. `docs/README.md` — the constitution: reading order, authority precedence
   ladder, frontmatter schema, ID rules, status/authority vocabulary,
   authoring + maintenance rules, the doc registry.
3. `docs/templates/` — task card, contract, decision, scenario.
4. `docs/scripts/docs-check.mjs` — the validator, wired into the required CI
   check as its own unconditional job (not gated by path selection — a path
   selector that classifies the validator's own directory as "docs" would
   let it skip itself).
5. `docs/contracts/` (or the spec) + `docs/decisions/` — even if near-empty;
   they anchor the precedence ladder.

Everything else (scenarios, playbooks, adapters, provenance fields) is added
when the repo first needs it — but added *with* its template and checker
rule, not ahead of them.

## Related

- This repo's docs constitution: `DOCS-ROOT` ([docs/README.md](../README.md))
- Comparison sources: xatu-delivery-companion (`docs/playbooks/doc-writing-guidelines.md` there is the canonical portable copy) and orc-werk (<https://github.com/odjhey/orc-werk>), esp. its `docs/README.md` and `scripts/docs_check.py`
