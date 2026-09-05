---
id: TASK-013
type: task-card
status: draft
authority: normative
description: 'Implement, verify, publish, and independently consume the deterministic niwa-lane-watchdog 0.1.0 GitHub Release bundle.'
provenance: 'Created from the accepted LANE-WATCHDOG-CONTRACT and DECISION-0004 after TASK-012 cleared runtime conformance, 2026-09-05'
---

# TASK-013 — Build and publish the lane-watchdog vendor bundle

## Outcome

A deterministic Node-standard-library packager implements
`LANE-WATCHDOG-CONTRACT`, the implementation is adversarially verified, and the
watchtower publishes and independently consumes the canonical
`lane-watchdog-v0.1.0` GitHub Release assets.

## Governing docs

- `LANE-WATCHDOG-CONTRACT`
- `DECISION-0004`
- `LANE-SUPERVISION-ADOPTION`
- `ENGINEERING-METHOD`
- `ORC-ERGO-DELIVERY`

## In scope

- Add a zero-dependency Node.js CLI that builds the contracted archive and
  sidecar from an exact clean tagged commit.
- Generate the exact six-file package, canonical manifest/checksum graph,
  bundle-safe `ADOPTION.md`, deterministic USTAR archive, and deterministic gzip
  wrapper.
- Add adversarial fixture tests and integrate them into the local gate.
- Document the reproducible build and consumer verification commands without a
  temporal claim that becomes stale when the release is published.
- After the verified source candidate is merged, have the watchtower alone
  create/push the annotated tag, build twice, publish the two canonical assets,
  download them as a foreign consumer, and verify them end to end.

## Out of scope

- Changing watchdog runtime behavior; Linux/GNU support; npm; native binaries;
  installers; `curl | sh`; branch-head vendoring; automatic updates or
  remediation; provider/seat/account policy; contract restructuring.
- GitHub-generated repository archives as canonical assets.

## File territory

- `scripts/package-lane-watchdog.mjs` and its adjacent test
- `scripts/check.mjs`
- `README.md`
- `docs/contracts/lane-watchdog.md`
- `docs/playbooks/lane-supervision-adoption.md`
- `docs/delivery/task-cards/TASK-013.md` and the `TASK-CARDS` index

Do not edit the watchdog runtime/test, `LICENSE`, decisions, other cards,
delivery contracts, dependencies, or CI configuration.

## Must not change

- The package identity, version/tag/asset names, exact layout and modes,
  checksum graph, source binding, SemVer, refusal conditions, or consumer flow
  owned by `LANE-WATCHDOG-CONTRACT` unless a contract defect is parked and
  reported.
- No dependency may be added. No existing test/gate may be deleted, skipped,
  weakened, narrowed, or bypassed.
- Ship and verification seats do not create tags, push, publish, or merge.

## Acceptance criteria

1. `node scripts/package-lane-watchdog.mjs --version 0.1.0 --out <dir>` is the
   documented release build command; the production CLI derives the repository
   root from its own location and has no gate-bypass or source-root override.
2. The CLI refuses dirty tracked/untracked source, absent/mismatched/non-peeled
   tag binding, failed full gate, missing inputs, existing output assets, and
   any representation or hash mismatch before publishing output.
3. The archive has exactly one `niwa-lane-watchdog-0.1.0/` directory and the six
   contracted regular files, exact modes, USTAR fields, zero mtimes/ownership,
   sorted entry order, terminal zero blocks, and normalized deterministic gzip
   header/stream.
4. `manifest.json`, `SHA256SUMS`, and the external sidecar have canonical exact
   bytes, LF endings, sorted entries, and the required non-circular hash graph.
5. Generated `ADOPTION.md` identifies version/tag/source commit, keeps package-
   local links local, rewrites other relative repository links to commit-pinned
   public GitHub URLs, leaves absolute/anchor links intact, and rejects root
   escapes or surviving non-package relative links.
6. Two independent builds from the same fixture/tag and the official tagged
   commit are byte-for-byte identical; a one-byte payload mutation changes the
   affected internal and external hashes.
7. Tests independently parse the gzip/tar bytes rather than trusting the
   producer and cover malicious paths, invalid versions, dirty trees, tag
   mismatches, gate failure, link rewriting, header fields, modes, order,
   checksums, and refusal cleanup.
8. Package tests use temporary fixture repositories and never require or create
   the real release tag; `scripts/check.mjs` runs them with all existing docs and
   44 watchdog tests intact.
9. Source docs give copy-pasteable producer and consumer commands, point to
   pinned GitHub Releases, and do not promise that a future/unpublished release
   exists. No branch-head or pipe-to-shell path appears.
10. Candidate syntax/tests/full gate/diff pass with a clean worktree and no
    generated archive committed.
11. Independent verification returns MERGE or MERGE-WITH-FOLLOW-UPS for the
    exact candidate before the watchtower squash-merges it.
12. Post-merge, the watchtower creates annotated tag `lane-watchdog-v0.1.0` at
    the exact clean release commit, proves two official builds identical,
    pushes commit/tag, and publishes only the two canonical assets on the public
    GitHub Release.
13. A fresh foreign-consumer directory downloads the published assets, verifies
    sidecar/internal hashes/layout/modes/source provenance, runs the bundled
    test, and completes the bounded clean-cwd probe; only then may ergo/card
    closure be recorded.

## Verification commands

```bash
node --test scripts/package-lane-watchdog.test.mjs
node scripts/check.mjs
git diff --check master...HEAD

# Watchtower-only after verified merge and annotated tag creation:
node scripts/package-lane-watchdog.mjs --version 0.1.0 --out /tmp/build-a
node scripts/package-lane-watchdog.mjs --version 0.1.0 --out /tmp/build-b
cmp /tmp/build-a/niwa-lane-watchdog-0.1.0.tar.gz \
  /tmp/build-b/niwa-lane-watchdog-0.1.0.tar.gz
cmp /tmp/build-a/niwa-lane-watchdog-0.1.0.tar.gz.sha256 \
  /tmp/build-b/niwa-lane-watchdog-0.1.0.tar.gz.sha256
```
