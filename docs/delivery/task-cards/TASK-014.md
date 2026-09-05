---
id: TASK-014
type: task-card
status: draft
authority: normative
description: 'Resolve the build-toolchain determinism and accepted Markdown-link syntax ambiguities exposed by TASK-013 assurance.'
provenance: 'Created from paired TASK-013 attempt-1 verification findings on candidate a050bc5, 2026-09-05'
---

# TASK-014 — Resolve package determinism and link-syntax gaps

## Outcome

`LANE-WATCHDOG-CONTRACT` defines one reproducible build-toolchain domain and a
bounded, fail-closed Markdown-link grammar before TASK-013 package code is
corrected.

## Governing docs

- `LANE-WATCHDOG-CONTRACT`
- `TASK-013`
- `DECISION-0004`
- `ENGINEERING-METHOD`

## In scope

- Resolve whether deterministic gzip bytes are promised across different
  Node/zlib implementations.
- Declare the exact official build-time Node and zlib versions and represent
  them in manifest schema 1 so a consumer can identify the canonical toolchain.
- Define which relative-link forms the zero-dependency packager rewrites and
  which unsupported/link-like forms it must reject before emitting artifacts.
- Define root-absolute, backslash, percent-encoded, query-bearing, titled,
  angle-bracket, reference-style, autolink, image, and raw-HTML handling.

## Out of scope

- Package implementation/tests, release/tag/push, watchdog runtime, distribution
  channel/licensing, Linux, dependencies, contract restructuring, or deciding
  the separately accepted contract-length follow-up.

## File territory

- `docs/contracts/lane-watchdog.md`
- `docs/delivery/task-cards/TASK-014.md` and the `TASK-CARDS` index

Do not edit code, README/adoption/decisions, other cards, or delivery docs.

## Acceptance criteria

1. The contract pins official bundle construction to Node `24.14.0` and zlib
   `1.3.1-e00f703`; the packager must refuse another toolchain before running
   the gate or writing output.
2. Manifest schema 1 gains a required `build_toolchain` object with exact
   canonical string fields `node: "24.14.0"` and
   `zlib: "1.3.1-e00f703"`; consumer verification checks both.
3. Byte reproducibility is guaranteed for independent invocations on that
   exact toolchain. Cross-Node/zlib byte identity is explicitly not promised;
   the published sidecar remains authority for canonical release bytes.
4. The supported source grammar is ordinary inline Markdown links and images
   whose unescaped destination is one no-whitespace token, optionally followed
   by a `#fragment`; absolute URI/protocol-relative/pure-anchor targets remain
   unchanged, the two package-local targets stay local, and other relative
   paths are commit-pinned.
5. Relative root-absolute, backslash-bearing, percent-encoded, query-bearing,
   titled, angle-bracket-destination, reference-style/definition, relative
   autolink, and relative raw-HTML `href`/`src` forms are unsupported and make
   packaging fail closed. Absolute standard autolinks may remain unchanged.
6. Package-local lookup is specified as own-key matching, never prototype-chain
   lookup. Path normalization rejects repository-root escapes.
7. The rules remain Node-standard-library implementable, exact enough for
   fixture tests, and do not alter current canonical adoption prose or runtime.
8. Documentation checks, full gate, and diff checks pass; ambiguities are none.

## Verification commands

```bash
node docs/scripts/find-docs.mjs --id LANE-WATCHDOG-CONTRACT
node scripts/check.mjs
git diff --check master...HEAD
```
