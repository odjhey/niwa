---
id: LANE-SUPERVISION-ADOPTION
type: playbook
status: current
authority: informative
description: 'Cross-project adoption guide for lane supervision — detector invariants, local-policy declaration, vendor pair, and agent handoff.'
---

# Cross-project lane-supervision adoption guide

This playbook is the single handoff entry point to give a new project or agent
first when adopting or adapting headless lane supervision. An adopting project's
seat policy is authoritative locally: do **not** import Niwa's model, provider,
account, verifier count, timeout, resume, orc/ergo delivery ledger, or
remediation choices by default. The public package interface, distribution
archive layout, and runtime contract are governed by
[`LANE-WATCHDOG-CONTRACT`](../contracts/lane-watchdog.md).

Adopters must separate three concerns:
1. **Reusable detector invariants** (§1): the fixed mechanics of process-owned evidence and safety.
2. **Niwa local examples** (§2): how this repository configures its seats (for reference only).
3. **Downstream local-policy declaration** (§3): the mandatory decisions every adopting repository owns and declares before deploying or editing.

---

## 1. Detector invariants and topology limits

The reference detector ([`.agents/skills/watchtower-loop/lane-watchdog.sh`](../../.agents/skills/watchtower-loop/lane-watchdog.sh)) enforces strict invariants:

- **Alert-only & manual corroboration**: Every alert is an advisory claim, never a verdict, and this reference adoption authorizes no automatic process action (no killing, signaling, or reaping processes, and no mutating delivery records). An adopter wanting automated remediation must first approve a separate downstream normative ownership/supervision contract covering process identity/ownership, permitted signals/tree semantics, fail-closed behavior, and audit. Until then, remediation is strictly manually corroborated and manually authorized. Before taking any action, operators must corroborate alerts using sensor-specific evidence:
  - `STALL:`: exact Codex PID/args, elapsed+CPU, own rollout path/mtime, and captured completion/output evidence.
  - `ALT-SEAT STALL:`: exact Claude PID and its own open configured transcript path/mtime under `WD_ALT_HOME`.
  - `AGY STALL:`: exact `comm=agy`, print-mode args, and that PID's own open conversation `.db`/`.db-wal` path/mtime under `~/.gemini/antigravity-cli/conversations/`; stdout, stderr, or log chatter do not substitute.
  - `HEARTBEAT:`: configured `WD_TRANSCRIPT` path/mtime and delivery-board state; it is not a process-stall verdict.
- **Process-owned progress evidence**: Liveness is determined solely by files owned by the specific process via `lsof -Fn -p <pid>` (Codex own rollout JSONL; Claude own open transcript under `WD_ALT_HOME`; Antigravity own open conversation `.db` or `.db-wal` under `~/.gemini/antigravity-cli/conversations/`). Pipe growth on stdout/stderr, `--log-file` chatter, shared summary database updates, or CPU time alone never count as progress.
- **Discovery and evidence-failure semantics**: Process enumeration and identity discovery failures (`pgrep`, `ps`) preserve existing markers without alerting. Evidence-lookup failures behave per sensor:
  - *Codex*: Missing or failed rollout evidence (`lsof`/`stat`) participates in a stall claim when its elapsed (>15m) and CPU (<2s) predicates hold (`own rollout missing`).
  - *Alternate Claude*: A process with no attributable transcript under `WD_ALT_HOME` is non-conclusive (emits no alert and infers no recovery).
  - *Antigravity*: Failed `lsof` or matched-file `stat` is non-conclusive (emits no alert) and disables Antigravity marker cleanup for that iteration.
- **Platform support**: macOS and `/bin/zsh` with `zsh/system` (`zsystem flock`) and BSD `stat -f %m`. Linux/GNU environments are not supported without adaptation.

### Topology truth and attribution limits

State topology truth directly from the code:
- **Candidate discovery is machine-wide**: Discovery commands (`pgrep -f 'codex exec'`, `pgrep -x claude`, `pgrep -x agy`) inspect processes across the entire machine. There is no session, repository, or workspace scoping during discovery.
- **Evidence is per-PID, not per-project**: Evidence proves whether a specific process is active, but the detector does not establish project or process ownership.
- **State directory semantics (`WD_STATE_DIR`)**:
  - **Shared state directory**: Cooperating monitors sharing `WD_STATE_DIR` serialize claims via `.wd-sensors.lock` and suppress duplicate alerts per process incarnation. However, shared state yields a single claimant rather than deterministically routing the alert to the originating project.
  - **Separate state directories**: Independent state directories avoid lock contention across projects, but can emit duplicate alerts across monitors for the same machine-wide process.
- **Stop / adapt requirement**: When project-specific process ownership or routing is required, stop and adapt the detector (for example by tracking dispatched PIDs directly or running seats in isolated containers) rather than assuming machine-wide watchdog alerts belong to your session.

---

## 2. Niwa reference configuration (examples only)

Niwa instantiates these tools for its own operating model. These values are informative examples, **not** downstream requirements:

- **Primary ship seat**: Headless Antigravity (`agy`) in print mode (`-p`) with plain authentication routing (`DECISION-0003`), `--print-timeout 20m`, and fresh corrective dispatches (`DECISION-0002`).
- **Verification seats**: Ordinary assurance uses one independent GPT-5.6 Luna verifier; paired independent-provider verification is retained only where current `AGENTS.md` requires it (such as security/trust-model specs, per [`SEAT-RELIABILITY`](../delivery/seat-reliability.md)); self-assurance is forbidden.
- **Delivery ledger**: Scripted orc journals and ergo backlog per [`ORC-ERGO-DELIVERY`](../delivery/orc-ergo-delivery.md).
- **Threshold defaults**: `WD_AGY_STARTUP_SECS=60`, `WD_AGY_SECS=900`, `WD_CODEX_SECS=900`, `WD_ALT_SECS=1200`, `WD_IDLE_SECS=1800`.

---

## 3. Downstream local-policy declaration

Every adopting project owns its seat and supervision policy. Before deploying or editing the detector, copy and fill this declaration in the adopting project's documentation:

```markdown
### Local lane-supervision policy declaration

1. **Seat, provider, and model routing**: Which models, harnesses, and reasoning tiers run ship, recon, and verify roles?
2. **Authentication and account routing**: How are credentials and multi-account quotas managed (e.g., config directories, env vars)?
3. **Verifier independence and count**: How many verifiers judge work, and what provider/model separation is required?
4. **Timeout and correction policy**: What are the hard execution timeouts per dispatch, and are fix rounds fresh sessions or resumed turns?
5. **Monitor topology and ownership**: Is the monitor run machine-wide, per-user, or per-project? Does it share or isolate `WD_STATE_DIR`?
6. **Remediation authority**: Who corroborates alerts and authorizes process actions? This reference adoption authorizes no automatic process action; any automated remediation requires approving a separate normative ownership/supervision contract covering process identity/ownership, permitted signals/tree semantics, fail-closed behavior, and audit. Until then remediation is manually corroborated and manually authorized.
7. **Platform and OS support**: Is the host macOS/zsh, or is an adapted Linux/container runtime required?
8. **Gate and CI integration**: What local script or CI command validates the watchdog and documentation?
```

---

## 4. Adoption modes

Choose one of two supported adoption paths:

1. **Vendor the paired release bundle**:
   The planned canonical distribution format under [`LANE-WATCHDOG-CONTRACT`](../contracts/lane-watchdog.md) is a versioned GitHub Release archive `niwa-lane-watchdog-<version>.tar.gz` and sidecar `niwa-lane-watchdog-<version>.tar.gz.sha256` (initial release `0.1.0` is planned and contracted; contracted runtime conformance is complete, but the release is not yet published — do not assume it is available). Consumers download a pinned release bundle, verify the sidecar SHA-256 before extraction, and vendor [`.agents/skills/watchtower-loop/lane-watchdog.sh`](../../.agents/skills/watchtower-loop/lane-watchdog.sh) and [`.agents/skills/watchtower-loop/lane-watchdog.test.mjs`](../../.agents/skills/watchtower-loop/lane-watchdog.test.mjs) together into the target repository. The script and test suite form an indivisible pair: the paired fake-command suite verifies deterministic sensor seams, suppression, lock serialization, and error behavior under fakes, not host integration. Host compatibility still requires prerequisites, syntax checks, the adopting project gate, a bounded isolated probe, and any local live trial the adopter's policy requires.
2. **Reimplement from the evidence model**:
   Build a custom detector matching the evidence invariants (process-owned file inspection, strict time boundaries, atomic suppression, fail-closed process discovery). Adopters must write a comprehensive test suite matching the reference coverage before deployment.
3. **Adaptation boundary**:
   Any partial copy, modified script, or unverified port is classified as **adapted**, not verified compatible. Never claim verified compatibility without passing the paired test suite.

---

## 5. Installation, upgrade, and verification path

1. **Download pinned release and sidecar**:
   Fetch the target release archive and its checksum sidecar for a specific pinned tag from GitHub Releases (substituting the target release version, e.g. `0.1.0` when published):
   ```bash
   curl -fsSLO "https://github.com/odjhey/niwa/releases/download/lane-watchdog-v${VERSION}/niwa-lane-watchdog-${VERSION}.tar.gz"
   curl -fsSLO "https://github.com/odjhey/niwa/releases/download/lane-watchdog-v${VERSION}/niwa-lane-watchdog-${VERSION}.tar.gz.sha256"
   ```
   **Security rules:**
   - **Never** vendor directly from git branch HEAD.
   - **Never** pipe release downloads directly into a shell interpreter (`curl | sh`).
2. **Verify checksum before extraction**:
   ```bash
   shasum -a 256 -c "niwa-lane-watchdog-${VERSION}.tar.gz.sha256"
   ```
3. **Extract and verify internal checksums**:
   ```bash
   tar -xzf "niwa-lane-watchdog-${VERSION}.tar.gz"
   (cd "niwa-lane-watchdog-${VERSION}" && shasum -a 256 -c SHA256SUMS)
   ```
4. **Vendor the pair and commit provenance**:
   Place `lane-watchdog.sh` and `lane-watchdog.test.mjs` in your project's skill or tool path (the packaged `ADOPTION.md` includes commit-pinned provenance and bundle-safe relative links to both). Commit them to version control alongside provenance notes recording the release tag, upstream commit SHA, and manifest.
5. **Run the 4-stage verification gate**:
   ```bash
   # 1. Shell syntax check
   /bin/zsh -n path/to/lane-watchdog.sh

   # 2. Focused regression suite
   node --test path/to/lane-watchdog.test.mjs

   # 3. Adopting project gate
   <local-project-gate-command>

   # 4. Bounded isolated probe (1 iteration, clean teardown, self-contained transcript)
   (
     probe_dir=$(mktemp -d "${TMPDIR:-/tmp}/watchdog-probe.XXXXXX") || exit 1
     trap 'rm -rf -- "$probe_dir"' EXIT
     probe_transcript="$probe_dir/session.jsonl"
     touch "$probe_transcript" || exit 1
     WD_STATE_DIR="$probe_dir" WD_TRANSCRIPT="$probe_transcript" WD_MAX_ITERATIONS=1 /bin/zsh path/to/lane-watchdog.sh
   )
   ```
6. **Declare local policy**: Fill and commit the local lane-supervision policy declaration (§3); Niwa seat policy is non-portable and remains local to Niwa.
7. **Upgrade discipline**: When upgrading from upstream, download the new pinned release bundle, verify checksums before extraction, update both files together, and re-run all 4 verification stages.

---

## 6. Copyable agent handoff prompt

Use this prompt when delegating lane-supervision adoption to an agent in another project:

```text
Adopt or adapt lane supervision for this repository following the stable guide LANE-SUPERVISION-ADOPTION (docs/playbooks/lane-supervision-adoption.md in Niwa) and public package contract LANE-WATCHDOG-CONTRACT (docs/contracts/lane-watchdog.md in Niwa).

Rules:
1. Read LANE-SUPERVISION-ADOPTION and LANE-WATCHDOG-CONTRACT first before modifying or running any code.
2. Inspect this project's existing seat, provider, account, timeout, and verification documentation. Fill the local-policy declaration explicitly; do NOT import Niwa's models, timeouts, or orc/ergo delivery choices by default (Niwa seat policy is non-portable).
3. Treat the detector as alert-only and advisory: it provides claims, not verdicts, and authorizes no automatic process action. Any automated remediation requires approving a separate normative ownership/supervision contract (process identity/ownership, permitted signals/tree semantics, fail-closed behavior, and audit). Until then, remediation is manually corroborated and manually authorized.
4. If vendoring, download a pinned release bundle, verify its sidecar checksum before extraction, verify internal SHA256SUMS, and copy both lane-watchdog.sh and lane-watchdog.test.mjs together with committed provenance. Never vendor from branch HEAD and never use curl | sh. If modifying, declare the implementation as adapted.
5. Verify using shell syntax checks (/bin/zsh -n), the focused Node test suite, the repository gate, and a self-contained bounded isolated probe (isolated WD_STATE_DIR, explicit transcript via WD_TRANSCRIPT, and WD_MAX_ITERATIONS=1).
```
