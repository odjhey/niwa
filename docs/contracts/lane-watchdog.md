---
id: LANE-WATCHDOG-CONTRACT
type: contract
status: current
authority: normative
description: 'Normative package contract, distribution interface, manifest schema, and runtime specification for niwa-lane-watchdog.'
---

# LANE-WATCHDOG-CONTRACT — Lane watchdog package contract

This document is the single normative authority governing the public package
interface, distribution artifacts, manifest schema, checksum rules, runtime
surface, and compatibility policy for `niwa-lane-watchdog`.

Detailed rationale and sensor mechanics are referenced by ID rather than
duplicated:
- Cross-project adoption patterns and local-policy requirements:
  [`LANE-SUPERVISION-ADOPTION`](../playbooks/lane-supervision-adoption.md).
- Harness dispatch signatures and stall diagnostics:
  [`HEADLESS-SEATS`](../playbooks/headless-seats.md).
- Distribution and licensing rulings:
  [`DECISION-0004`](../delivery/decisions/0004-lane-watchdog-distribution.md).
- Repository documentation root: [`DOCS-ROOT`](../README.md).

---

## 1. Package identity and release naming

- **Package name**: `niwa-lane-watchdog`
- **Initial contract version**: `0.1.0` (contracted release target; planned and not yet published)
- **Canonical source repository**: `https://github.com/odjhey/niwa`
- **Git release tag format**: `lane-watchdog-v<version>` (for version `0.1.0`: `lane-watchdog-v0.1.0`)
- **Distribution channel**: GitHub Releases (`https://github.com/odjhey/niwa/releases`)

### Canonical distribution assets

Every release `<version>` publishes exactly two canonical assets on GitHub Releases:
1. **Vendor bundle archive**: `niwa-lane-watchdog-<version>.tar.gz` (for `0.1.0`: `niwa-lane-watchdog-0.1.0.tar.gz`).
2. **Cryptographic sidecar**: `niwa-lane-watchdog-<version>.tar.gz.sha256` (for `0.1.0`: `niwa-lane-watchdog-0.1.0.tar.gz.sha256`).

GitHub-generated whole-repository source archives (`archive/refs/tags/...`, source `.zip`, or source `.tar.gz`) are explicitly **non-canonical** and must not be used for vendoring.

---

## 2. Archive layout and canonical USTAR representation

The compressed archive `niwa-lane-watchdog-<version>.tar.gz` contains exactly one root directory entry followed by exactly six regular files in ASCII path order, with no subdirectories, no symlinks, and exact POSIX permissions.

### Archive entry order and permissions

The archive stream contains entries in this exact order:

| Entry index | Archive path | Tar type | POSIX mode | Description |
|---|---|---|---|---|
| 1 | `niwa-lane-watchdog-<version>/` | `5` (directory) | `0755` (`rwxr-xr-x`) | Archive root directory |
| 2 | `niwa-lane-watchdog-<version>/ADOPTION.md` | `0` (regular) | `0644` (`rw-r--r--`) | Generated adoption guide with bundle-safe commit-pinned links |
| 3 | `niwa-lane-watchdog-<version>/LICENSE` | `0` (regular) | `0644` (`rw-r--r--`) | Standard MIT license text |
| 4 | `niwa-lane-watchdog-<version>/SHA256SUMS` | `0` (regular) | `0644` (`rw-r--r--`) | Lowercase SHA-256 digests of internal files |
| 5 | `niwa-lane-watchdog-<version>/lane-watchdog.sh` | `0` (regular) | `0755` (`rwxr-xr-x`) | Advisory monitor executable shell script |
| 6 | `niwa-lane-watchdog-<version>/lane-watchdog.test.mjs` | `0` (regular) | `0644` (`rw-r--r--`) | Paired fake-command regression test suite |
| 7 | `niwa-lane-watchdog-<version>/manifest.json` | `0` (regular) | `0644` (`rw-r--r--`) | Machine-readable package and provenance manifest |

Any unexpected entry, missing entry, incorrect entry order, non-regular file entry, or mode divergence renders the archive non-conforming.

### Tar format and entry metadata

To guarantee byte-for-byte deterministic archives across independent rebuilds, the uncompressed tar stream must adhere to one canonical USTAR representation (POSIX 1003.1-1988):
- **Header format**: Pure USTAR headers only; no PAX extended headers (`x` or `g`), no GNU tar extensions, and no vendor extended attributes.
- **Path order**: Exactly root directory entry first, then the six regular files in ASCII path order as shown above.
- **Entry modes**: Root directory mode `0755`; `lane-watchdog.sh` mode `0755`; all other five regular files mode `0644`.
- **Ownership**: `uid` = `0`, `gid` = `0`, `uname` = `""` (empty string), `gname` = `""` (empty string) for every entry.
- **Timestamps**: `mtime` = `0` (Unix epoch 0: 1970-01-01 00:00:00 UTC) for every entry.
- **Stream padding**: Standard 512-byte zero padding within records, ending with exactly two terminal 512-byte zero blocks.

### Gzip stream representation

The gzip stream encapsulating the USTAR archive must be produced by the official stdlib packager (Node.js standard library `zlib`) with deterministic settings:
- **Header flags**: No filename (`FNAME`), comment (`FCOMMENT`), or extra fields (`FEXTRA`).
- **Header timestamp**: `mtime` = `0`.
- **OS byte**: Normalized to `3` (Unix).
- **Compression**: Fixed compression settings (deflate level 9, default deflate strategy).
- **Determinism proof**: Reproducibility is proven by two independent invocations in the release gate producing byte-for-byte identical archive streams and identical SHA-256 digests.

---

## 3. Manifest schema, provenance binding, and link safety

The manifest `manifest.json` records package identity, exact git provenance, platform constraints, and checksums of the non-generated payload files.

### Schema definition (`schema_version: 1`)

Consumers and packaging validators must fail closed on any unrecognized or unsupported `schema_version`. The schema fields are:

- `schema_version` (`integer`, required): Must equal `1`.
- `package` (`string`, required): Must equal `"niwa-lane-watchdog"`.
- `version` (`string`, required): SemVer 2.0.0 string (e.g. `"0.1.0"`).
- `tag` (`string`, required): Must equal `"lane-watchdog-v" + version`.
- `source` (`string`, required): Must equal `"https://github.com/odjhey/niwa"`.
- `commit` (`string`, required): Exact 40-character lowercase hexadecimal git commit SHA (`^[0-9a-f]{40}$`). Release construction requires the tag to exist and `git rev-parse "refs/tags/lane-watchdog-v<version>^{commit}"` (annotated or lightweight peeled to commit) to equal clean `git rev-parse HEAD`; manifest `commit` must equal that exact 40-hex commit. Tag, version, archive root/name, manifest, and sidecar must all strictly agree.
- `contract` (`string`, required): Must equal `"LANE-WATCHDOG-CONTRACT"`.
- `platform` (`object`, required):
  - `os` (`array` of `string`, required): `["darwin"]`.
  - `shell` (`string`, required): `"/bin/zsh"`.
  - `shell_modules` (`array` of `string`, required): `["zsh/system"]`.
  - `stat_flavor` (`string`, required): `"bsd"`.
  - `host_commands` (`array` of `string`, required): Lexicographically sorted array: `["date", "head", "ls", "lsof", "pgrep", "ps", "pwd", "rm", "sleep", "stat", "tr", "wc"]`.
  - `test_runtime` (`object`, required):
    - `engine` (`string`, required): `"node"`.
    - `min_version` (`string`, required): `"18.0.0"`.
- `files` (`object`, required): Object mapping each of the four non-generated payload filenames to an object with `path` (`string`), `mode` (`string`), and `sha256` (`string`):
  - `"ADOPTION.md"`: `{"path": "ADOPTION.md", "mode": "0644", "sha256": "<64-hex lowercase>"}`
  - `"LICENSE"`: `{"path": "LICENSE", "mode": "0644", "sha256": "<64-hex lowercase>"}`
  - `"lane-watchdog.sh"`: `{"path": "lane-watchdog.sh", "mode": "0755", "sha256": "<64-hex lowercase>"}`
  - `"lane-watchdog.test.mjs"`: `{"path": "lane-watchdog.test.mjs", "mode": "0644", "sha256": "<64-hex lowercase>"}`

### Extracted ADOPTION safety

To preserve link integrity and external provenance when `ADOPTION.md` is extracted into downstream projects:
1. **Generation from canonical doc**: `ADOPTION.md` is generated during packaging from canonical `LANE-SUPERVISION-ADOPTION` (`docs/playbooks/lane-supervision-adoption.md`) at that exact commit.
2. **Provenance identification**: The packaged document must carry a visible header identifying the source repository (`https://github.com/odjhey/niwa`), release tag (`lane-watchdog-v<version>`), and source commit (`<commit>`).
3. **Local script and test links**: References targeting `.agents/skills/watchtower-loop/lane-watchdog.sh` and `.agents/skills/watchtower-loop/lane-watchdog.test.mjs` are rewritten to `./lane-watchdog.sh` and `./lane-watchdog.test.mjs`.
4. **External Niwa links**: Every other relative Niwa link (e.g. `../contracts/lane-watchdog.md`, `../playbooks/headless-seats.md`, `../delivery/...`) is rewritten to a canonical absolute GitHub URL pinned to the release commit: `https://github.com/odjhey/niwa/blob/<commit>/<repo-relative-path>`.
5. **Absolute links**: Existing absolute URLs (e.g. `https://...`) are retained unchanged.
6. **Bundle-safety validation**: Packaging rejects any remaining relative markdown link whose target is absent from the six-file bundle.

### Non-circular hash boundary

To prevent circular dependencies:
1. `manifest.json` covers **only** the four non-generated payload files (`ADOPTION.md`, `LICENSE`, `lane-watchdog.sh`, `lane-watchdog.test.mjs`).
2. `manifest.json` does **not** contain hashes of itself or `SHA256SUMS`.
3. In-archive `SHA256SUMS` covers the four payload files plus `manifest.json`.
4. The sidecar `*.tar.gz.sha256` covers the exact compressed archive.

### Canonical JSON representation

To ensure deterministic verification without judgment:
- UTF-8 text encoding without byte order mark (BOM).
- Two-space indentation with UNIX newlines (`\n`).
- Single trailing newline at end of file.
- Object keys sorted lexicographically (ASCII order) at all nesting levels.
- No trailing commas.

---

## 4. Checksum contracts

### In-archive `SHA256SUMS`

The in-archive file `SHA256SUMS` contains exactly five lines corresponding to the four payload files and `manifest.json`, formatted using standard `shasum` notation (`<hash><two spaces><filename>\n`) sorted lexicographically by filename (ASCII order):

```text
<hash>  ADOPTION.md
<hash>  LICENSE
<hash>  lane-watchdog.sh
<hash>  lane-watchdog.test.mjs
<hash>  manifest.json
```

All hashes must be 64-character lowercase hexadecimal SHA-256 digests. Filenames are relative to the archive root directory without leading `./`.

### Release sidecar `*.sha256`

The release sidecar `niwa-lane-watchdog-<version>.tar.gz.sha256` covers the exact compressed archive. It contains exactly one line:

```text
<sha256>  niwa-lane-watchdog-<version>.tar.gz
```

`<sha256>` is the 64-character lowercase hexadecimal SHA-256 hash of `niwa-lane-watchdog-<version>.tar.gz`, followed by two space characters, the archive filename, and a single trailing newline.

---

## 5. Deterministic release creation and acceptance

Rebuilding the same clean source commit and version must produce byte-for-byte identical archive and sidecar output.

### Release preconditions and exact tag binding

Release creation requires all of the following conditions to be met:
1. **Clean git tree**: `git status --porcelain` must be completely empty.
2. **Tag existence and peeled commit equality**: The git tag `refs/tags/lane-watchdog-v<version>` must exist. Peeling the tag via `git rev-parse "refs/tags/lane-watchdog-v<version>^{commit}"` (supporting annotated or lightweight tags) must resolve successfully and equal the clean repository `git rev-parse HEAD`.
3. **Manifest commit equality**: The `commit` field in `manifest.json` must equal that exact 40-hex commit.
4. **Coordinate agreement**: Git tag, SemVer version, archive root directory name, archive filename, manifest fields (`version`, `tag`, `commit`), and sidecar filename/content must all strictly agree.
5. **Pre-release gate**: Full repository gate (`node scripts/check.mjs`) must exit 0 before release construction.
6. **Canonical USTAR and gzip conformance**: Archive structure must strictly match the canonical USTAR layout, metadata (uid/gid 0, empty uname/gname, mtime 0, no PAX/GNU headers, zero padding, two terminal zero blocks), and stdlib gzip normalization.
7. **Bundle-safe ADOPTION.md**: Generated `ADOPTION.md` must have all relative links rewritten and validated against the bundle.
8. **Reproducibility gate**: Two independent invocations of the packager must produce byte-for-byte identical archives and digests.
9. **Runtime conformance prerequisite**: Current source does not yet meet the contracted fallback behavior for unset `WD_TRANSCRIPT` (it triggers a zsh `no matches found` glob failure when no default transcripts exist). **Release 0.1.0 is strictly forbidden** until a separately verified implementation and test change conforms to this contract.

### Refusal criteria

Release generation must fail closed and refuse to produce an artifact if:
- The working tree is dirty or untracked files are present.
- The version string is not valid SemVer 2.0.0.
- The git tag `refs/tags/lane-watchdog-v<version>` does not exist or its peeled commit does not equal clean `HEAD`.
- Manifest `commit` does not match the peeled tag commit SHA.
- Any required file is missing or any extraneous file is present in the archive.
- Archive entries diverge from the canonical USTAR order, metadata, or stdlib gzip settings.
- Checksums or layout verification fail.
- Two independent builds produce differing bytes or digests.
- `ADOPTION.md` retains relative links targeting files not present in the bundle.
- The gate or test suite fails.
- Release is attempted while known runtime non-conformance remains unresolved.

---

## 6. Runtime surface specification

This section specifies the public runtime interface to ensure compatibility and versioning can be mechanically enforced.

### Host and platform requirements

- **Operating system**: macOS (Darwin).
- **Shell**: `/bin/zsh` with the `zsh/system` built-in module and `zsystem flock` support.
- **Host tools**: `date`, `head`, `ls`, `lsof`, `pgrep`, `ps`, `pwd`, `rm`, `sleep`, `stat`, `tr`, `wc`.
- **Filesystem stat**: BSD `stat` with `-f %m` epoch second formatting.
- **Packaging/test runtime**: Node.js 18+ is required for tests and packaging; Node is **not** a runtime dependency for running `lane-watchdog.sh`.

### Invocation

The detector is invoked directly with zsh:

```bash
/bin/zsh path/to/lane-watchdog.sh
```

The script accepts no positional command-line flags. All public configuration is passed through environment variables.

### Public environment variables and defaults

| Variable | Default | Meaning |
|---|---|---|
| `WD_TRANSCRIPT` | Target: newest matching `*.jsonl` in `~/.claude/projects/<cwd-slug>/`, or empty if none | Session transcript path for heartbeat monitoring (see conformance note below) |
| `WD_ALT_HOME` | `$HOME/.claude-alt` | Configuration root for alternate Claude accounts |
| `WD_CODEX_SECS` | `900` | Codex elapsed time and rollout silence threshold in seconds (strict `>`) |
| `WD_ALT_SECS` | `1200` | Alternate Claude transcript silence threshold in seconds (strict `>`) |
| `WD_IDLE_SECS` | `1800` | Transcript idle age threshold for heartbeat alerts in seconds (`>=`) |
| `WD_AGY_STARTUP_SECS` | `60` | Antigravity startup threshold for missing database in seconds (strict `>`) |
| `WD_AGY_SECS` | `900` | Antigravity database silence threshold in seconds (strict `>`) |
| `WD_MAX_ITERATIONS` | `0` | Iteration ceiling (`0` = unbounded loop; positive integer bounds iterations) |
| `WD_STATE_DIR` | `${TMPDIR:-/tmp}` | State directory for sensor lock and alert suppression markers |
| `WD_SAMPLE_SECS` | `60` | Interval in seconds between sampling iterations |

#### Transcript default target behavior and release blocker

The target public behavior for `WD_TRANSCRIPT` is:
- When `WD_TRANSCRIPT` is unset:
  - If matching default transcripts exist in `~/.claude/projects/<cwd-slug>/*.jsonl`, the newest transcript by modification time is chosen.
  - If no matching default transcripts exist, `WD_TRANSCRIPT` resolves to empty string (`""`), disabling `HEARTBEAT:` monitoring only, while all external process sensors (Codex, alternate Claude, Antigravity) continue operating normally without zsh glob failure.
- When `WD_TRANSCRIPT` is explicitly set, its value is used verbatim.

**Conformance status**: Current source in the repository does not yet implement this no-match behavior; running without matching transcripts triggers a zsh `no matches found` glob failure before watchdog startup. Current behavior is non-compliant, and **release 0.1.0 is forbidden** until a separately verified implementation and test change conforms to this target specification.

### Output labels on stdout

The watchdog emits advisory lines to stdout prefixed by one of four labels:

- `STALL:` — Codex execution stall claim.
- `ALT-SEAT STALL:` — Alternate-account Claude transcript stall claim.
- `AGY STALL:` — Antigravity print-mode stall claim.
- `HEARTBEAT:` — Watchtower transcript idleness notification.

### Stderr and defined diagnostics

The watchdog defines the following diagnostic termination behaviors:
- **Clean termination**: A bounded run (`WD_MAX_ITERATIONS > 0`) exits with status code `0` upon completing the requested iterations.
- **Fatal diagnostic exit**: Fatal configuration or locking failures exit with status code `1` and emit a diagnostic line to stderr matching one of:
  - `lane-watchdog: zsh/system is required for sensor locking`
  - `lane-watchdog: zsystem flock is not supported`
  - `lane-watchdog: cannot create sensor lock <path>`
  - `lane-watchdog: cannot acquire sensor lock <path>`
  - `lane-watchdog: cannot release sensor lock <path>`

*Note on exit codes*: This contract defines the explicit watchdog diagnostic exits above. It avoids an exhaustive exit-code claim for unhandled external shell conditions (such as shell syntax errors or aborted startup before the script logic executes).

### State files in `WD_STATE_DIR`

- Advisory lock file: `.wd-sensors.lock`
- Per-process alert suppression markers:
  - `.wd-codex-<pid>-<identity>`
  - `.wd-alt-<pid>-<identity>`
  - `.wd-agy-<pid>-<identity>`
  where `<identity>` is the process start timestamp (`ps -o lstart=`) with non-alphanumeric characters replaced by `_`.

### Boundaries and non-goals

- **Alert-only & advisory**: Watchdog output consists solely of claims, never execution verdicts.
- **No process management**: The watchdog never kills, signals, stops, owns, or reaps processes, and never mutates delivery records.
- **No project/session ownership**: Process discovery is machine-wide. Process evidence is per-PID, not per-project.
- **No automation in package**: Packaging introduces no background daemon, CLI wrappers, auto-remediation, or downstream seat policy.

---

## 7. Compatibility and versioning policy

Package versioning conforms to Semantic Versioning 2.0.0:

- **Patch bump (`0.1.x`)**: Backward-compatible bug fixes in sensor algorithms, error handling, documentation, or internal test helpers.
- **Minor bump (`0.x.0` / `1.x.0`)**: Backward-compatible additive changes, such as new sensors, new public `WD_*` environment variables, additive stdout labels, or backward-compatible manifest extensions.
- **Major bump (`x.0.0`)**: Breaking changes, including removing or renaming `WD_*` variables, changing variable defaults, altering stdout label prefixes or formats, changing defined exit behavior, breaking manifest schema changes, or modifying platform requirements.
- **Release immutability**: Published releases, tags, archives, and sidecars are immutable once published.

---

## 8. Consumer instructions

Downstream projects adopting `niwa-lane-watchdog` must follow these rules:

1. **Download pinned release**: Fetch canonical archive and sidecar for a specific pinned tag from GitHub Releases.
2. **Verify checksum before extraction**:
   ```bash
   shasum -a 256 -c niwa-lane-watchdog-<version>.tar.gz.sha256
   ```
3. **Extract archive and verify internal sums**:
   ```bash
   tar -xzf niwa-lane-watchdog-<version>.tar.gz
   (cd niwa-lane-watchdog-<version> && shasum -a 256 -c SHA256SUMS)
   ```
4. **Commit provenance**: Commit the vendored files into version control alongside provenance documentation recording source repository, commit SHA, and tag.
5. **Run 4-stage verification**:
   - Stage 1: Syntax check (`/bin/zsh -n lane-watchdog.sh`).
   - Stage 2: Paired tests (`node --test lane-watchdog.test.mjs`).
   - Stage 3: Adopting repository's local gate.
   - Stage 4: Bounded isolated probe (`WD_MAX_ITERATIONS=1` with temporary `WD_STATE_DIR`).
6. **Declare local policy**: Fill and commit the local lane-supervision policy declaration per [`LANE-SUPERVISION-ADOPTION`](../playbooks/lane-supervision-adoption.md).

### Prohibitions

- **NEVER** vendor directly from git branch HEAD.
- **NEVER** pipe release downloads directly into a shell interpreter (`curl | sh`).
- **NEVER** import Niwa's local seat, model, timeout, or orc/ergo delivery policies as package defaults.
