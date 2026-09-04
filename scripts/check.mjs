#!/usr/bin/env node
// The local gate. Contract: green check = mergeable.
// In pr mode, CI must run exactly this script as the single required check.
// Node only (18+), zero dependencies — keep it that way, or document what
// you add.

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { checkDocs } from '../docs/scripts/docs-check.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// runManifestCheck verifies copyto installs every tracked doc and script
// (starter repo only — targets have no ./copyto, so this is a no-op there).
export function runManifestCheck({ repoRoot = root, report = (message) => console.error(message) } = {}) {
  if (!existsSync(join(repoRoot, 'copyto'))) return true
  const manifest = spawnSync('./copyto', ['--manifest'], { cwd: repoRoot, encoding: 'utf8' })
  if (manifest.error || manifest.status !== 0) {
    report('FAIL: copyto --manifest failed')
    return false
  }
  const listed = new Set(manifest.stdout.split('\n').filter(Boolean))
  const tracked = spawnSync('git', ['ls-files', '-z', 'docs/', 'scripts/'], {
    cwd: repoRoot,
    encoding: 'utf8',
  })
  if (tracked.error || tracked.status !== 0) {
    report('FAIL: git ls-files failed for manifest check')
    return false
  }
  let passed = true
  for (const file of tracked.stdout.split('\0').filter(Boolean)) {
    if (!listed.has(file)) {
      report(`FAIL: ${file} is not in the copyto manifest`)
      passed = false
    }
  }
  return passed
}

function main() {
  let fail = false

  // --- docs check: frontmatter schema, registry sync, link resolution
  const findings = checkDocs({ root })
  for (const finding of findings) console.error(`FAIL: ${finding.file}: ${finding.message}`)
  if (findings.length) fail = true

  // --- the checker's own test suite
  const tests = spawnSync(
    process.execPath,
    ['--test', join(root, 'docs', 'scripts', 'docs-check.test.mjs')],
    { cwd: root, stdio: 'inherit' },
  )
  if (tests.error || tests.status !== 0) fail = true

  // --- lane watchdog regression suite
  const watchdogTests = spawnSync(
    process.execPath,
    ['--test', join(root, '.agents', 'skills', 'watchtower-loop', 'lane-watchdog.test.mjs')],
    { cwd: root, stdio: 'inherit' },
  )
  if (watchdogTests.error || watchdogTests.status !== 0) fail = true

  // --- copyto manifest stays complete (starter repo only)
  if (!runManifestCheck()) fail = true

  // --- project gate
  // ADAPT: add your build / test / lint here as spawnSync calls. Examples:
  //   npm test | python3 -m pytest | cargo test | go test ./...
  // Any non-zero status sets fail = true.

  if (fail) {
    console.error('check: RED')
    process.exit(1)
  }
  console.log('check: green')
}

if (isAbsolute(process.argv[1] ?? '') && import.meta.url === pathToFileURL(process.argv[1]).href) main()
