---
id: TASK-010
type: task-card
status: draft
authority: normative
description: 'Define the public lane-watchdog vendor bundle, release interface, versioning, and MIT licensing contract.'
provenance: 'Operator-approved GitHub vendor-bundle distribution and MIT license, 2026-09-04'
---

# TASK-010 — Define lane-watchdog package contract

## Outcome

Niwa has an approved normative contract for distributing the watchdog as a
versioned, inspectable vendor bundle through public GitHub Releases, under the
MIT license, without turning Niwa's local seat policy into package policy.

## Governing docs

- `DOCS-ROOT`
- `DOC-WRITING-GUIDELINES`
- `LANE-SUPERVISION-ADOPTION`
- `TASK-007`
- `HEADLESS-SEATS`
- `DECISION-LOG`

## In scope

- Add `LANE-WATCHDOG-CONTRACT` as the normative public package contract.
- Add the standard MIT license with `Copyright (c) 2026 Niwa contributors`.
- Record the operator-approved source-vendor/GitHub Release decision.
- Define release identity, exact archive layout, manifest/checksum contract,
  supported platform, runtime interface, compatibility/versioning, and release
  acceptance rules for initial version `0.1.0`.
- Update adoption and root navigation to point to the contract without claiming
  that release `0.1.0` exists before publication.

## Out of scope

- Implementing the packager, tests, release automation, tag, or GitHub Release.
- Changing watchdog source/tests, runtime semantics, output, thresholds, or
  environment variables.
- Publishing npm/Homebrew packages or a compiled binary.
- Adding Linux support, project/process ownership, automatic remediation, or
  downstream seat policy.

## File territory

- New `LICENSE`
- New `docs/contracts/lane-watchdog.md`
- New `docs/delivery/decisions/0004-lane-watchdog-distribution.md`
- `docs/delivery/decisions/README.md`
- `docs/README.md`
- `docs/playbooks/lane-supervision-adoption.md`
- `README.md`
- `docs/delivery/task-cards/TASK-010.md` and the `TASK-CARDS` index

Do not edit scripts, tests, skills, `AGENTS.md`, other decisions/cards,
templates, or delivery contracts.

## Must not change

- The detector remains alert-only, macOS/zsh-only, and advisory.
- Downstream repositories retain authority over their seat and supervision
  policy.
- Runtime stays dependency-free beyond the documented host commands; Node is a
  packaging/test requirement, not a runtime daemon dependency.
- Do not delete, skip, weaken, or narrow tests or checks.

## Acceptance criteria

1. `LANE-WATCHDOG-CONTRACT` is registered, current, normative, and is the single
   public package-interface authority; detector rationale/adoption stays linked
   rather than duplicated wholesale.
2. Package identity is `niwa-lane-watchdog`; initial version is `0.1.0`; its tag
   is `lane-watchdog-v0.1.0`; canonical source is
   `https://github.com/odjhey/niwa`.
3. GitHub Releases is the canonical distribution channel. The canonical asset
   is `niwa-lane-watchdog-0.1.0.tar.gz` plus sidecar
   `niwa-lane-watchdog-0.1.0.tar.gz.sha256`; GitHub-generated whole-repository
   archives are explicitly non-canonical.
4. The archive has one root `niwa-lane-watchdog-0.1.0/` containing exactly
   `lane-watchdog.sh`, `lane-watchdog.test.mjs`, `ADOPTION.md`, `manifest.json`,
   `SHA256SUMS`, and `LICENSE`; regular files only, shell mode `0755`, all
   others `0644`.
5. A versioned JSON manifest schema fixes package name/version, source
   repository/40-hex commit/tag, contract ID, platform/runtime requirements,
   and SHA-256 records for the four non-generated payload files (script, test,
   adoption guide, license). Unknown schema versions fail closed.
6. In-archive `SHA256SUMS` covers the four payload files plus `manifest.json`
   using lowercase SHA-256 and relative filenames. The sidecar covers the exact
   compressed archive using conventional `<hash><two spaces><filename>` form.
7. Rebuilding the same clean source commit and version must produce byte-for-byte
   identical archive and sidecar output. Release creation refuses a dirty tree,
   malformed SemVer, tag/version mismatch, missing files, failed gate, or
   checksum/layout mismatch.
8. The contract identifies public runtime configuration/output/state/exit
   surfaces by reference to their governing detector docs and current table,
   while stating that no CLI flags, daemon, automatic action, seat policy, or
   project ownership is introduced by packaging.
9. Compatibility policy uses package SemVer: patch for compatible fixes, minor
   for additive public configuration/sensors/output, major for removals or
   incompatible evidence/output/platform changes. Every release is immutable.
10. Consumer instructions require a pinned release, sidecar verification,
    committed vendored files/source identity, paired tests, local gate, bounded
    probe, and local-policy declaration; never branch-head vendoring or
    `curl | sh`.
11. An approved decision records vendor bundle first, GitHub Release delivery,
    MIT licensing, and defers npm/binary until recorded demand triggers.
12. `LICENSE` is the unmodified standard MIT text with the approved holder line.
13. No release-existence claim, implementation, dependency, or unrelated policy
    change is introduced; docs query, links, full gate, and diff checks pass.

## Verification commands

```bash
node docs/scripts/find-docs.mjs --id LANE-WATCHDOG-CONTRACT
node docs/scripts/find-docs.mjs --id LANE-SUPERVISION-ADOPTION
rg -n 'niwa-lane-watchdog|lane-watchdog-v0\.1\.0|github.com/odjhey/niwa' \
  docs/contracts/lane-watchdog.md docs/delivery/decisions/0004-lane-watchdog-distribution.md
node scripts/check.mjs
git diff --check master...HEAD
```
