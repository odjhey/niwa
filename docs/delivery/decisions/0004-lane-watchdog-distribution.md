---
id: DECISION-0004
type: decision
status: current
authority: informative
description: 'Record operator decision for public GitHub vendor bundle distribution and MIT licensing, deferring npm and binary distribution.'
---

# 0004 — Lane-watchdog vendor bundle distribution and MIT licensing

**Kind:** ruling
**Review:** approved
**Decided by:** operator
**Provenance:** Operator ruling, 2026-09-04 (TASK-010)

## Context

Adopting projects require a versioned, inspectable, and secure distribution mechanism for the lane watchdog without importing Niwa's local seat or delivery policies. Downstream adopters need clear open-source licensing, cryptographic checksums, and release immutability to safely vendor the supervision tools into their repositories.

## Options considered

- Distribute via npm registry (`npm install niwa-lane-watchdog`) — familiar in JavaScript ecosystems, but the watchdog runtime is a dependency-free macOS zsh script. Publishing to npm introduces registry management overhead, supply-chain surface, and risks implying that Node.js is a runtime daemon dependency.
- Distribute as a compiled native binary (e.g., Go or Rust) — simplifies packaging into a single executable, but adds cross-compilation infrastructure, binary opacity, and maintenance burden when the macOS/zsh implementation is concise, inspectable, and auditable.
- Distribute as a public GitHub Release vendor bundle (`niwa-lane-watchdog-<version>.tar.gz` with `.sha256` sidecar) under standard MIT license — provides an auditable, self-contained archive with paired test suite, adoption guide, manifest, and checksums, allowing adopting repositories to vendor pinned releases cleanly.

## Choice

The operator ruled:

1. **GitHub Releases distribution**: Distribute `niwa-lane-watchdog` as versioned vendor archives via public GitHub Releases (`https://github.com/odjhey/niwa/releases`) under tags formatted as `lane-watchdog-v<version>` (with `lane-watchdog-v0.1.0` as the planned initial release tag; contracted runtime conformance is complete, and release `0.1.0` remains planned and not yet published). The canonical release asset is `niwa-lane-watchdog-<version>.tar.gz` accompanied by a sidecar checksum `niwa-lane-watchdog-<version>.tar.gz.sha256`. GitHub-generated whole-repository source archives are explicitly non-canonical.
2. **MIT licensing**: Release the software under the standard MIT license with copyright holder `Niwa contributors` and year 2026.
3. **Vendor bundle contract**: The distribution archive bundles `lane-watchdog.sh`, `lane-watchdog.test.mjs`, `ADOPTION.md` (generated from `LANE-SUPERVISION-ADOPTION` with bundle-safe commit-pinned links), `manifest.json`, `SHA256SUMS`, and `LICENSE` as specified in [LANE-WATCHDOG-CONTRACT](../../contracts/lane-watchdog.md). Adopting projects vendor the paired script and test suite at a pinned version and verify checksums before extraction.
4. **Deferral of npm package**: Defer publishing an npm registry package until at least two adopting projects explicitly request registry installation.
5. **Deferral of native binary**: Defer compiling to a native binary until a recorded requirement needs Linux/no-zsh portability or reduced external process-tool dependencies.

These pull triggers are conditions for re-evaluation, not promises of future implementation.

## Consequences

- Initial distribution relies on GitHub Releases; no npm publishing credentials or multi-platform compilation pipelines are required.
- Consumers verify and vendor the paired script and tests directly into their repositories without runtime package managers.
- Adopting projects retain authority over their local seat, supervision, and remediation policies per [LANE-SUPERVISION-ADOPTION](../../playbooks/lane-supervision-adoption.md).
- Any future npm or binary distribution remains dormant until its recorded pull trigger is satisfied.
