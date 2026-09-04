---
name: find-docs
description: 'Find and filter this repo''s docs by querying their YAML frontmatter (id, type, status, authority) or the DOCS-ROOT registry. Use when looking for a spec, playbook, decision, or template under docs/, or when asked "where is the doc about X".'
---

# Finding docs

All docs under `docs/` carry YAML frontmatter with `id` (UPPER-KEBAB-CASE),
`type`, `status`, `authority`, and `description`; optional `stale_after`.
Schema and vocabularies: `docs/README.md` (`DOCS-ROOT`).

## Without scripts (progressive disclosure)

1. The registry table in `docs/README.md` — every registered doc, one row
   each (ID, path, authority).
2. Ledger directories (decisions, reviews, walkthrough runs) index their
   entries in their own `README.md`.

## With the query script (preferred)

`docs/scripts/find-docs.mjs` — zero-dependency Node script over the
frontmatter:

```sh
node docs/scripts/find-docs.mjs                        # list live docs (stale hidden by default)
node docs/scripts/find-docs.mjs --type playbook        # by type
node docs/scripts/find-docs.mjs --authority normative  # by authority
node docs/scripts/find-docs.mjs --id OPERATING-MODEL   # exact id lookup
node docs/scripts/find-docs.mjs gate review            # free-text terms (id+description)
node docs/scripts/find-docs.mjs --all                  # include superseded/retired/stale docs
node docs/scripts/find-docs.mjs --stale                # ONLY superseded/retired/past stale_after
node docs/scripts/find-docs.mjs --json                 # machine-readable output
```

Stale docs are excluded by default so routine queries only surface live
content; reach for `--all`/`--stale` (or an explicit `--status`) when
history matters. Exit code 1 when nothing matches, so it composes in shell
conditionals.

## With grep (fallback)

```sh
grep -rl --include='*.md' '^type: decision' docs/      # docs by type
grep -rl --include='*.md' '^id: OPERATING-MODEL$' docs/  # doc by id
grep -rn 'DECISION-0029' docs/                         # who references an id
```

## Trust checks before relying on a doc

- `status: superseded` or `retired` → historical only; find the replacement
  it links.
- `stale_after` in the past → verify content before using.
- `authority: informative` never overrides a `normative` doc.
