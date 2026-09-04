import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import {
  chmodSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  watch,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const watchdog = resolve(process.env.WD_TEST_WATCHDOG ?? join(here, 'lane-watchdog.sh'))

const fakeCommandSource = `#!${process.execPath}
import { appendFileSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename } from 'node:path'

const fixture = JSON.parse(readFileSync(process.env.WD_TEST_FIXTURE, 'utf8'))
const command = basename(process.argv[1])
const args = process.argv.slice(2)
const print = (value) => {
  if (value !== undefined && value !== '') process.stdout.write(String(value) + '\\n')
}

if (command === 'date') {
  print(fixture.now)
} else if (command === 'pgrep') {
  let pids = []
  let sensor
  if (args.length === 2 && args[0] === '-f' && args[1] === 'codex exec') {
    sensor = 'codex'
    pids = fixture.codexPids
  } else if (args.length === 2 && args[0] === '-x' && args[1] === 'claude') {
    sensor = 'alt'
    pids = Object.entries(fixture.processes)
      .filter(([, proc]) => proc.comm === 'claude')
      .map(([pid]) => pid)
  } else if (args.length === 2 && args[0] === '-x' && args[1] === 'agy') {
    sensor = 'agy'
    pids = fixture.agyPids ?? Object.entries(fixture.processes)
      .filter(([, proc]) => proc.comm === 'agy')
      .map(([pid]) => pid)
  } else {
    process.exitCode = 64
  }
  if (sensor && fixture.blockPgrep === sensor) {
    writeFileSync(fixture.blockReadyPath, sensor)
    readFileSync(0)
  }
  if (sensor && fixture.pgrepStatus?.[sensor] !== undefined) {
    process.exitCode = fixture.pgrepStatus[sensor]
  } else if (pids.length) {
    print(pids.join('\\n'))
  } else if (sensor) {
    process.exitCode = 1
  }
} else if (command === 'ps') {
  const field = args[args.indexOf('-o') + 1].replace(/=$/, '')
  const pid = args[args.indexOf('-p') + 1]
  const proc = fixture.processes[pid]
  const value = proc ? (proc[field] ?? (field === 'args' ? proc.argv : undefined)) : undefined
  if (!proc || value === undefined) process.exitCode = 1
  else print(value)
} else if (command === 'lsof') {
  const pid = args[2]
  const proc = fixture.processes[pid]
  if (args.length !== 3 || args[0] !== '-Fn' || args[1] !== '-p' || !proc || fixture.lsofFail?.[pid]) {
    process.exitCode = 1
  } else {
    print('p' + pid)
    for (const path of proc.openFiles ?? []) print('n' + path)
  }
} else if (command === 'stat') {
  const path = args.at(-1)
  if (fixture.mtimes[path] === undefined) process.exitCode = 1
  else {
    print(fixture.mtimes[path])
    if (fixture.removeSensorLockAfterTranscriptStat && path === process.env.WD_TRANSCRIPT) {
      rmSync(process.env.WD_STATE_DIR + '/.wd-sensors.lock')
    }
  }
} else if (command === 'sleep') {
  appendFileSync(process.env.WD_TEST_SLEEP_LOG, args.join(' ') + '\\n')
} else {
  process.stderr.write('unexpected fake command: ' + command + '\\n')
  process.exitCode = 64
}
`

function makeHarness(t) {
  const root = mkdtempSync(join(tmpdir(), 'lane watchdog test '))
  const bin = join(root, 'fake bin')
  const stateDir = join(root, 'state markers')
  const altHome = join(root, 'alternate claude home')
  const agyConvDir = join(root, '.gemini', 'antigravity-cli', 'conversations')
  const transcript = join(root, 'watchtower transcript.jsonl')
  const fixturePath = join(root, 'fixture.json')
  const sleepLog = join(root, 'sleep.log')
  mkdirSync(bin)
  mkdirSync(stateDir)
  mkdirSync(altHome)
  mkdirSync(agyConvDir, { recursive: true })
  const fakeCommand = join(bin, 'fake-command.mjs')
  writeFileSync(fakeCommand, fakeCommandSource)
  chmodSync(fakeCommand, 0o755)
  for (const command of ['date', 'pgrep', 'ps', 'lsof', 'stat', 'sleep']) {
    symlinkSync('fake-command.mjs', join(bin, command))
  }
  t.after(() => rmSync(root, { recursive: true, force: true }))

  function writeFixture(fixture) {
    const normalized = {
      now: 10_000,
      codexPids: [],
      processes: {},
      mtimes: {},
      ...fixture,
    }
    normalized.mtimes = { [transcript]: normalized.now, ...normalized.mtimes }
    writeFileSync(fixturePath, JSON.stringify(normalized))
  }

  function watchdogEnv(env = {}) {
    return {
      ...process.env,
      HOME: root,
      PATH: `${bin}:/usr/bin:/bin:/usr/sbin:/sbin`,
      ZDOTDIR: root,
      WD_ALT_HOME: altHome,
      WD_MAX_ITERATIONS: '1',
      WD_STATE_DIR: stateDir,
      WD_TEST_FIXTURE: fixturePath,
      WD_TEST_SLEEP_LOG: sleepLog,
      WD_TRANSCRIPT: transcript,
      ...env,
    }
  }

  function runRaw(fixture, env = {}) {
    writeFixture(fixture)
    writeFileSync(sleepLog, '')
    const result = spawnSync('/bin/zsh', [watchdog], {
      encoding: 'utf8',
      env: watchdogEnv(env),
    })
    return {
      ...result,
      lines: result.stdout.trim() ? result.stdout.trim().split('\n') : [],
      sleeps: readFileSync(sleepLog, 'utf8').trim().split('\n').filter(Boolean),
    }
  }

  function run(fixture, env = {}) {
    const result = runRaw(fixture, env)
    assert.equal(result.status, 0, `watchdog failed:\n${result.stderr}`)
    return result
  }

  function spawnRun(fixture, env = {}) {
    let readyWatcher
    let blockedResolve
    const blocked = new Promise((resolve) => {
      blockedResolve = resolve
      if (fixture.blockReadyPath) {
        readyWatcher = watch(dirname(fixture.blockReadyPath), (_event, filename) => {
          if (String(filename) === basename(fixture.blockReadyPath)) {
            readyWatcher.close()
            readyWatcher = undefined
            resolve()
          }
        })
      }
    })
    writeFixture(fixture)
    writeFileSync(sleepLog, '')
    const child = spawn('/bin/zsh', [watchdog], { env: watchdogEnv(env) })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr += chunk })
    const completed = new Promise((resolve, reject) => {
      child.once('error', reject)
      child.once('close', (status, signal) => {
        if (readyWatcher) readyWatcher.close()
        if (!fixture.blockReadyPath) blockedResolve()
        resolve({
          lines: stdout.trim() ? stdout.trim().split('\n') : [],
          signal,
          status,
          stderr,
        })
      })
    })
    return { blocked, child, completed }
  }

  function invokeLsof(args, fixture) {
    writeFixture(fixture)
    return spawnSync(join(bin, 'lsof'), args, {
      encoding: 'utf8',
      env: { ...process.env, WD_TEST_FIXTURE: fixturePath },
    })
  }

  function markers(sensor) {
    return readdirSync(stateDir).filter((name) => name.startsWith(`.wd-${sensor}-`)).sort()
  }

  return { agyConvDir, altHome, invokeLsof, markers, run, runRaw, spawnRun, stateDir, transcript }
}

function holdSensorLock(lockFile) {
  const holderScript = `
    zmodload zsh/system || exit 70
    : >> "$1" || exit 71
    zsystem flock -f lock_fd "$1" || exit 72
    print -r -- LOCK_READY
    IFS= read -r _
    zsystem flock -u "$lock_fd" || exit 73
  `
  const child = spawn('/bin/zsh', ['-fc', holderScript, 'lock-holder', lockFile])
  let stdout = ''
  let stderr = ''
  let readyResolve
  let readyReject
  const ready = new Promise((resolve, reject) => {
    readyResolve = resolve
    readyReject = reject
  })
  child.stdout.on('data', (chunk) => {
    stdout += chunk
    if (stdout.includes('LOCK_READY')) readyResolve()
  })
  child.stderr.on('data', (chunk) => { stderr += chunk })
  const completed = new Promise((resolve, reject) => {
    child.once('error', (error) => {
      readyReject(error)
      reject(error)
    })
    child.once('close', (status, signal) => {
      if (!stdout.includes('LOCK_READY')) {
        readyReject(new Error(`lock holder exited before ready: status=${status} signal=${signal} stderr=${stderr}`))
      }
      resolve({ signal, status, stderr })
    })
  })
  async function release() {
    if (!child.stdin.writableEnded) child.stdin.end('release\n')
    return completed
  }
  return { child, completed, ready, release }
}

function processFixture({
  args,
  argv,
  comm,
  cputime = '00:01',
  etime = '01:41',
  lstart,
  openFiles = [],
}) {
  const proc = { comm, cputime, etime, lstart, openFiles }
  const procArgs = args !== undefined ? args : (argv !== undefined ? argv : undefined)
  if (procArgs !== undefined) {
    proc.args = procArgs
    proc.argv = procArgs
  }
  return proc
}

test('fake lsof accepts only -Fn -p followed by a known fixture PID', (t) => {
  const harness = makeHarness(t)
  const fixture = {
    processes: {
      601: processFixture({ comm: 'codex', lstart: 'known process' }),
    },
  }

  const accepted = harness.invokeLsof(['-Fn', '-p', '601'], fixture)
  assert.equal(accepted.status, 0)
  assert.equal(accepted.stdout, 'p601\n')

  for (const args of [
    ['-p', '601'],
    ['-p', '601', '-Fn'],
    ['-Fn'],
    ['-Fn', '-p'],
    ['-Fn', '-p', '601', 'extra'],
    ['-Fn', '-p', '999'],
  ]) {
    const rejected = harness.invokeLsof(args, fixture)
    assert.notEqual(rejected.status, 0, `unexpectedly accepted ${JSON.stringify(args)}`)
    assert.equal(rejected.stdout, '')
  }
})

test('sensor lock creation failure is an explicit startup error', async (t) => {
  const harness = makeHarness(t)
  const missingStateDir = join(harness.stateDir, 'missing parent', 'missing state')
  const run = harness.spawnRun({}, { WD_STATE_DIR: missingStateDir })
  t.after(() => {
    if (!run.child.stdin.writableEnded) run.child.stdin.end()
    return run.completed
  })
  run.child.stdin.end()
  const result = await run.completed

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /lane-watchdog: cannot create sensor lock /)
})

test('runtime lock disappearance before acquisition fails explicitly', (t) => {
  const harness = makeHarness(t)
  const result = harness.runRaw({ removeSensorLockAfterTranscriptStat: true })

  assert.notEqual(result.status, 0)
  assert.equal(result.stdout, '')
  assert.match(result.stderr, /lane-watchdog: cannot acquire sensor lock /)
  assert.equal(readdirSync(harness.stateDir).includes('.wd-sensors.lock'), false)
})

test('a busy sensor lock preserves markers while heartbeat remains active', { timeout: 10_000 }, async (t) => {
  const harness = makeHarness(t)
  const lockFile = join(harness.stateDir, '.wd-sensors.lock')
  const codexMarker = '.wd-codex-901-held_incarnation'
  const altMarker = '.wd-alt-902-held_incarnation'
  writeFileSync(join(harness.stateDir, codexMarker), 'codex sentinel')
  writeFileSync(join(harness.stateDir, altMarker), 'alt sentinel')

  const holder = holdSensorLock(lockFile)
  t.after(() => holder.release())
  await holder.ready

  const result = harness.run(
    {
      now: 10_000,
      codexPids: ['901'],
      processes: {
        901: processFixture({ comm: 'codex', lstart: 'new codex incarnation' }),
        902: processFixture({ comm: 'claude', lstart: 'new alt incarnation' }),
      },
      mtimes: { [harness.transcript]: 8_000 },
    },
    { WD_IDLE_SECS: '100' },
  )

  assert.deepEqual(result.lines, ['HEARTBEAT: idle 33min, codex=1 alt=0 — board check due'])
  assert.equal(result.stderr, '')
  assert.deepEqual(harness.markers('codex'), [codexMarker])
  assert.deepEqual(harness.markers('alt'), [altMarker])
  assert.equal(readFileSync(join(harness.stateDir, codexMarker), 'utf8'), 'codex sentinel')
  assert.equal(readFileSync(join(harness.stateDir, altMarker), 'utf8'), 'alt sentinel')
  assert.ok(readdirSync(harness.stateDir).includes('.wd-sensors.lock'))

  const released = await holder.release()
  assert.equal(released.status, 0, released.stderr)
})

test('cooperating watchdogs serialize one first marker claim', { timeout: 10_000 }, async (t) => {
  const harness = makeHarness(t)
  const rollout = join(harness.stateDir, 'sessions', 'concurrent rollout.jsonl')
  const fixture = {
    blockPgrep: 'codex',
    blockReadyPath: join(harness.stateDir, 'first-watchdog-holds-lock'),
    codexPids: ['903'],
    processes: {
      903: processFixture({ comm: 'codex', lstart: 'shared incarnation', openFiles: [rollout] }),
    },
    mtimes: { [rollout]: 9_899 },
  }
  const env = { WD_CODEX_SECS: '100' }

  const first = harness.spawnRun(fixture, env)
  t.after(() => {
    if (!first.child.stdin.writableEnded) first.child.stdin.end()
    return first.completed
  })
  await first.blocked

  const second = harness.spawnRun(fixture, env)
  t.after(() => {
    if (!second.child.stdin.writableEnded) second.child.stdin.end()
    return second.completed
  })
  second.child.stdin.end()
  const secondResult = await second.completed
  assert.equal(secondResult.status, 0, secondResult.stderr)
  assert.equal(secondResult.stderr, '')
  assert.deepEqual(secondResult.lines, [])
  assert.deepEqual(harness.markers('codex'), [])

  first.child.stdin.end()
  const firstResult = await first.completed
  assert.equal(firstResult.status, 0, firstResult.stderr)
  assert.equal(firstResult.stderr, '')
  const combinedAlerts = [...firstResult.lines, ...secondResult.lines]
  assert.equal(combinedAlerts.length, 1)
  assert.match(combinedAlerts[0], /STALL: codex pid 903 /)
  assert.equal(harness.markers('codex').length, 1)
})

test('Codex freshness is process-owned across concurrent lanes', (t) => {
  const harness = makeHarness(t)
  const staleRollout = join(harness.stateDir, 'sessions', 'lane one rollout.jsonl')
  const freshRollout = join(harness.stateDir, 'sessions', 'lane two rollout.jsonl')
  const { lines, sleeps } = harness.run(
    {
      codexPids: ['101', '102'],
      processes: {
        101: processFixture({
          comm: 'codex',
          lstart: 'Fri Sep  4 10:00:00 2026',
          openFiles: [staleRollout],
        }),
        102: processFixture({
          comm: 'codex',
          lstart: 'Fri Sep  4 10:00:01 2026',
          openFiles: [freshRollout],
        }),
      },
      mtimes: { [staleRollout]: 9_899, [freshRollout]: 9_950 },
    },
    { WD_CODEX_SECS: '100' },
  )

  assert.equal(lines.length, 1)
  assert.match(lines[0], /STALL: codex pid 101 /)
  assert.doesNotMatch(lines[0], /pid 102 /)
  assert.deepEqual(sleeps, [])
})

test('Codex handles missing evidence, strict boundaries, and every process-time shape', (t) => {
  const harness = makeHarness(t)
  const staleAtBoundary = join(harness.stateDir, 'sessions', 'boundary rollout.jsonl')
  const processes = {
    110: processFixture({ comm: 'codex', etime: '01:41', cputime: '0:00.01', lstart: 'start-110' }),
    111: processFixture({ comm: 'codex', etime: '00:01:41', cputime: '00:00:01.99', lstart: 'start-111' }),
    112: processFixture({ comm: 'codex', etime: '0-00:01:41', cputime: '0-00:00:01.50', lstart: 'start-112' }),
    113: processFixture({ comm: 'codex', etime: '01:40', cputime: '0:00.01', lstart: 'start-113' }),
    114: processFixture({ comm: 'codex', etime: '01:41', cputime: '0:02.00', lstart: 'start-114' }),
    115: processFixture({
      comm: 'codex',
      etime: '01:41',
      cputime: '0:00.01',
      lstart: 'start-115',
      openFiles: [staleAtBoundary],
    }),
    116: processFixture({ comm: 'codex', etime: '01:41', cputime: '0:02.01', lstart: 'start-116' }),
  }
  const { lines } = harness.run(
    {
      codexPids: Object.keys(processes),
      processes,
      mtimes: { [staleAtBoundary]: 9_900 },
    },
    { WD_CODEX_SECS: '100' },
  )

  assert.deepEqual(
    lines.map((line) => line.match(/pid (\d+)/)?.[1]),
    ['110', '111', '112'],
  )
  assert.ok(lines.every((line) => line.includes('own rollout missing')))
})

test('malformed process-time shapes and components fail closed', (t) => {
  const harness = makeHarness(t)
  const malformedElapsed = [
    '1-02:03',
    '00:99',
    '1-24:00:00',
    '',
    '-00:01',
    '+00:01',
    '00:00:00:01',
    '00.5:01',
    '00:00.5:01',
    '00:01.',
    '60:00',
    '00:60',
    '24:00:00',
    '1-00:60:00',
    '1-00:00:60',
    '1-2-03:04:05',
    '00: 01',
    'not-a-time',
  ]
  const processes = Object.fromEntries(
    malformedElapsed.map((etime, index) => [
      String(700 + index),
      processFixture({ comm: 'codex', cputime: '0:00.01', etime, lstart: `malformed-${index}` }),
    ]),
  )
  processes['799'] = processFixture({
    comm: 'codex',
    cputime: '0:00:00:00.01',
    etime: '00:01',
    lstart: 'malformed-cpu',
  })

  const { lines } = harness.run(
    { codexPids: Object.keys(processes), processes },
    { WD_CODEX_SECS: '0' },
  )
  assert.deepEqual(lines, [])
})

test('Claude discovery does not depend on alternate-home text in argv and evidence stays process-owned', (t) => {
  const harness = makeHarness(t)
  const staleTranscript = join(harness.altHome, 'projects', 'project one', 'stale session.jsonl')
  const freshTranscript = join(harness.altHome, 'projects', 'project two', 'fresh session.jsonl')
  const unrelatedTranscript = join(harness.altHome, 'projects', 'project global', 'newest session.jsonl')
  const claudeArgv = 'claude -p --model claude-sonnet-4-6 brief'
  assert.equal(claudeArgv.includes(harness.altHome), false)
  const { lines } = harness.run(
    {
      processes: {
        201: processFixture({
          argv: claudeArgv,
          comm: 'claude',
          lstart: 'Fri Sep  4 11:00:00 2026',
          openFiles: [staleTranscript],
        }),
        202: processFixture({
          comm: 'claude',
          lstart: 'Fri Sep  4 11:00:01 2026',
          openFiles: [freshTranscript],
        }),
        203: processFixture({ comm: 'claude', lstart: 'Fri Sep  4 11:00:02 2026' }),
      },
      mtimes: {
        [staleTranscript]: 8_799,
        [freshTranscript]: 9_950,
        [unrelatedTranscript]: 9_999,
      },
    },
    { WD_ALT_SECS: '1200' },
  )

  assert.equal(lines.length, 1)
  assert.match(lines[0], /ALT-SEAT STALL: claude pid 201 /)
  assert.doesNotMatch(lines[0], /pid 202|pid 203/)
  assert.match(lines[0], /own transcript 1201s silent/)
})

test('repeated marker claim emits one alert and no stderr', (t) => {
  const harness = makeHarness(t)
  const rollout = join(harness.stateDir, 'sessions', 'repeated claim rollout.jsonl')
  const fixture = {
    codexPids: ['304'],
    processes: {
      304: processFixture({ comm: 'codex', lstart: 'repeated claim incarnation', openFiles: [rollout] }),
    },
    mtimes: { [rollout]: 9_899 },
  }
  const env = { WD_CODEX_SECS: '100' }

  const first = harness.run(fixture, env)
  const second = harness.run(fixture, env)
  assert.equal([...first.lines, ...second.lines].length, 1)
  assert.match(first.lines[0], /STALL: codex pid 304 /)
  assert.equal(first.stderr, '')
  assert.equal(second.stderr, '')
})

test('Codex suppression resets on recovery and does not cross PID reuse', (t) => {
  const harness = makeHarness(t)
  const rollout = join(harness.stateDir, 'sessions', 'codex rollout.jsonl')
  const fixture = (mtime, lstart = 'first incarnation') => ({
    codexPids: ['301'],
    processes: {
      301: processFixture({ comm: 'codex', lstart, openFiles: [rollout] }),
    },
    mtimes: { [rollout]: mtime },
  })
  const env = { WD_CODEX_SECS: '100' }

  assert.equal(harness.run(fixture(9_899), env).lines.length, 1)
  assert.deepEqual(harness.run(fixture(9_899), env).lines, [])
  assert.deepEqual(harness.run(fixture(9_950), env).lines, [])
  assert.equal(harness.run(fixture(9_899), env).lines.length, 1)
  assert.equal(harness.run(fixture(9_899, 'second incarnation'), env).lines.length, 1)
})

test('alternate-Claude suppression resets on recovery and does not cross PID reuse', (t) => {
  const harness = makeHarness(t)
  const transcript = join(harness.altHome, 'projects', 'project three', 'session.jsonl')
  const fixture = (mtime, lstart = 'first incarnation') => ({
    processes: {
      401: processFixture({ comm: 'claude', lstart, openFiles: [transcript] }),
    },
    mtimes: { [transcript]: mtime },
  })
  const env = { WD_ALT_SECS: '100' }

  assert.equal(harness.run(fixture(9_899), env).lines.length, 1)
  assert.deepEqual(harness.run(fixture(9_899), env).lines, [])
  assert.deepEqual(harness.run(fixture(9_950), env).lines, [])
  assert.equal(harness.run(fixture(9_899), env).lines.length, 1)
  const firstMarker = harness.markers('alt')
  assert.equal(firstMarker.length, 1)
  assert.equal(harness.run(fixture(9_899, 'second incarnation'), env).lines.length, 1)
  assert.equal(harness.markers('alt').length, 1)
  assert.notDeepEqual(harness.markers('alt'), firstMarker)
})

test('cleanup removes a disappeared Codex marker while preserving a live suspect sibling', (t) => {
  const harness = makeHarness(t)
  const firstRollout = join(harness.stateDir, 'sessions', 'first cleanup rollout.jsonl')
  const siblingRollout = join(harness.stateDir, 'sessions', 'sibling cleanup rollout.jsonl')
  const env = { WD_CODEX_SECS: '100' }
  const processes = {
    310: processFixture({ comm: 'codex', lstart: 'cleanup first', openFiles: [firstRollout] }),
    311: processFixture({ comm: 'codex', lstart: 'cleanup sibling', openFiles: [siblingRollout] }),
  }

  assert.equal(
    harness.run(
      {
        codexPids: ['310', '311'],
        processes,
        mtimes: { [firstRollout]: 9_899, [siblingRollout]: 9_899 },
      },
      env,
    ).lines.length,
    2,
  )
  assert.equal(harness.markers('codex').length, 2)

  assert.deepEqual(
    harness.run(
      {
        codexPids: ['311'],
        processes: { 311: processes[311] },
        mtimes: { [siblingRollout]: 9_899 },
      },
      env,
    ).lines,
    [],
  )
  assert.equal(harness.markers('codex').length, 1)
  assert.match(harness.markers('codex')[0], /-311-/)
})

test('an unattributable live Claude incarnation keeps its marker until it disappears', (t) => {
  const harness = makeHarness(t)
  const transcript = join(harness.altHome, 'projects', 'cleanup project', 'session.jsonl')
  const suspect = {
    processes: {
      410: processFixture({ comm: 'claude', lstart: 'live unattributable', openFiles: [transcript] }),
    },
    mtimes: { [transcript]: 9_899 },
  }
  const env = { WD_ALT_SECS: '100' }

  assert.equal(harness.run(suspect, env).lines.length, 1)
  const marker = harness.markers('alt')
  assert.equal(marker.length, 1)

  assert.deepEqual(
    harness.run(
      {
        processes: {
          410: processFixture({ comm: 'claude', lstart: 'live unattributable' }),
        },
      },
      env,
    ).lines,
    [],
  )
  assert.deepEqual(harness.markers('alt'), marker)

  harness.run({}, env)
  assert.deepEqual(harness.markers('alt'), [])
})

test('missing lstart fails cleanup closed for both sensors until conclusive disappearance', (t) => {
  const harness = makeHarness(t)
  const codexRollout = join(harness.stateDir, 'sessions', 'missing lstart codex.jsonl')
  const altTranscript = join(harness.altHome, 'projects', 'missing lstart project', 'alt.jsonl')
  const env = { WD_CODEX_SECS: '100', WD_ALT_SECS: '100' }

  assert.equal(
    harness.run(
      {
        codexPids: ['330'],
        processes: {
          330: processFixture({ comm: 'codex', lstart: 'stable codex start', openFiles: [codexRollout] }),
          430: processFixture({ comm: 'claude', lstart: 'stable alt start', openFiles: [altTranscript] }),
        },
        mtimes: { [codexRollout]: 9_899, [altTranscript]: 9_899 },
      },
      env,
    ).lines.length,
    2,
  )
  const codexMarker = harness.markers('codex')
  const altMarker = harness.markers('alt')

  assert.deepEqual(
    harness.run(
      {
        codexPids: ['330'],
        processes: {
          330: processFixture({ comm: 'codex', lstart: '', openFiles: [codexRollout] }),
          430: processFixture({ comm: 'claude', openFiles: [altTranscript] }),
        },
        mtimes: { [codexRollout]: 9_899, [altTranscript]: 9_899 },
      },
      env,
    ).lines,
    [],
  )
  assert.deepEqual(harness.markers('codex'), codexMarker)
  assert.deepEqual(harness.markers('alt'), altMarker)

  harness.run({}, env)
  assert.deepEqual(harness.markers('codex'), [])
  assert.deepEqual(harness.markers('alt'), [])
})

test('failed comm lookup blocks only its sensor cleanup', (t) => {
  const harness = makeHarness(t)
  const codexRollout = join(harness.stateDir, 'sessions', 'missing comm codex.jsonl')
  const altTranscript = join(harness.altHome, 'projects', 'missing comm project', 'alt.jsonl')
  const env = { WD_CODEX_SECS: '100', WD_ALT_SECS: '100' }

  assert.equal(
    harness.run(
      {
        codexPids: ['340'],
        processes: {
          340: processFixture({ comm: 'codex', lstart: 'stable comm codex', openFiles: [codexRollout] }),
          440: processFixture({ comm: 'claude', lstart: 'stable comm alt', openFiles: [altTranscript] }),
        },
        mtimes: { [codexRollout]: 9_899, [altTranscript]: 9_899 },
      },
      env,
    ).lines.length,
    2,
  )
  const codexMarker = harness.markers('codex')

  harness.run(
    {
      codexPids: ['340'],
      processes: {
        340: processFixture({ lstart: 'stable comm codex', openFiles: [codexRollout] }),
      },
      mtimes: { [codexRollout]: 9_899 },
    },
    env,
  )
  assert.deepEqual(harness.markers('codex'), codexMarker)
  assert.deepEqual(harness.markers('alt'), [])

  harness.run(
    {
      codexPids: ['341'],
      processes: {
        341: processFixture({ comm: 'not-codex', lstart: 'excluded executable' }),
      },
    },
    env,
  )
  assert.deepEqual(harness.markers('codex'), [])
})

test('candidate-discovery errors fail closed for only the affected sensor', (t) => {
  const harness = makeHarness(t)
  const codexRollout = join(harness.stateDir, 'sessions', 'discovery codex.jsonl')
  const altTranscript = join(harness.altHome, 'projects', 'discovery project', 'alt.jsonl')
  const env = { WD_CODEX_SECS: '100', WD_ALT_SECS: '100' }

  assert.equal(
    harness.run(
      {
        codexPids: ['320'],
        processes: {
          320: processFixture({ comm: 'codex', lstart: 'discovery codex', openFiles: [codexRollout] }),
          420: processFixture({ comm: 'claude', lstart: 'discovery alt', openFiles: [altTranscript] }),
        },
        mtimes: { [codexRollout]: 9_899, [altTranscript]: 9_899 },
      },
      env,
    ).lines.length,
    2,
  )
  assert.equal(harness.markers('codex').length, 1)
  assert.equal(harness.markers('alt').length, 1)
  writeFileSync(join(harness.stateDir, 'unrelated-state'), 'keep')

  harness.run({ pgrepStatus: { codex: 2 } }, env)
  assert.equal(harness.markers('codex').length, 1)
  assert.deepEqual(harness.markers('alt'), [])
  assert.equal(readFileSync(join(harness.stateDir, 'unrelated-state'), 'utf8'), 'keep')
})

test('production defaults and existing threshold overrides remain effective', (t) => {
  const harness = makeHarness(t)
  const codexRollout = join(harness.stateDir, 'sessions', 'default codex rollout.jsonl')
  const altTranscript = join(harness.altHome, 'projects', 'defaults project', 'default alt.jsonl')
  const fixture = {
    codexPids: ['501'],
    processes: {
      501: processFixture({
        comm: 'codex',
        etime: '15:01',
        lstart: 'start-501',
        openFiles: [codexRollout],
      }),
      502: processFixture({ comm: 'claude', lstart: 'start-502', openFiles: [altTranscript] }),
    },
    mtimes: { [codexRollout]: 9_099, [altTranscript]: 8_799 },
  }

  const defaults = harness.run(fixture)
  assert.ok(defaults.lines.some((line) => line.includes('codex pid 501')))
  assert.ok(defaults.lines.some((line) => line.includes('claude pid 502')))

  const overridden = harness.run(fixture, { WD_CODEX_SECS: '902', WD_ALT_SECS: '1202' })
  assert.deepEqual(overridden.lines, [])

  const heartbeat = harness.run(
    { now: 10_000, mtimes: { [harness.transcript]: 9_990 } },
    { WD_IDLE_SECS: '10' },
  )
  assert.deepEqual(heartbeat.lines, ['HEARTBEAT: idle 0min, codex=0 alt=0 — board check due'])
  assert.deepEqual(heartbeat.sleeps, [])
})

test('the default sample interval is fake-clock testable without wall-clock sleep', (t) => {
  const harness = makeHarness(t)
  const result = harness.run({}, { WD_MAX_ITERATIONS: '2' })
  assert.deepEqual(result.sleeps, ['60'])
})

test('the watchdog remains notification-only and has no debug leftovers', () => {
  const source = readFileSync(watchdog, 'utf8')
  assert.doesNotMatch(source, /^\s*(?:command\s+)?(?:kill|pkill|killall)\b/m)
  assert.doesNotMatch(source, /\b(?:orc|ergo)\s+(?:record|dispatch|result|done|fail|cancel)\b/)
  assert.doesNotMatch(source, new RegExp('\\[DE' + 'BUG-[^\\]]+\\]'))
})

test('Antigravity candidate discovery enforces exact comm, print-token boundaries, and excludes interactive processes', (t) => {
  const harness = makeHarness(t)
  const dbPath = (name) => join(harness.agyConvDir, `${name}.db`)
  const staleMtime = 8_000

  const processes = {
    101: processFixture({ comm: 'not-agy', args: 'not-agy -p test', etime: '02:00', lstart: 'start-101', openFiles: [dbPath('c101')] }),
    102: processFixture({ comm: 'agy', args: 'agy', etime: '02:00', lstart: 'start-102', openFiles: [dbPath('c102')] }),
    103: processFixture({ comm: 'agy', args: 'agy --model "Gemini 3.8 Flash (High)"', etime: '02:00', lstart: 'start-103', openFiles: [dbPath('c103')] }),
    104: processFixture({ comm: 'agy', args: 'agy -profile custom', etime: '02:00', lstart: 'start-104', openFiles: [dbPath('c104')] }),
    105: processFixture({ comm: 'agy', args: 'agy foo-p bar', etime: '02:00', lstart: 'start-105', openFiles: [dbPath('c105')] }),
    106: processFixture({ comm: 'agy', args: 'agy --print-timeout 20m', etime: '02:00', lstart: 'start-106', openFiles: [dbPath('c106')] }),
    107: processFixture({ comm: 'agy', args: 'agy -p "read brief"', etime: '02:00', lstart: 'start-107', openFiles: [dbPath('c107')] }),
    108: processFixture({ comm: 'agy', args: 'agy --print "read brief"', etime: '02:00', lstart: 'start-108', openFiles: [dbPath('c108')] }),
    109: processFixture({ comm: 'agy', args: 'agy --print-timeout 20m -p "read brief"', etime: '02:00', lstart: 'start-109', openFiles: [dbPath('c109')] }),
    110: processFixture({ comm: 'agy', args: "agy\t-p\t'read brief'", etime: '02:00', lstart: 'start-110', openFiles: [dbPath('c110')] }),
  }

  const mtimes = {
    [dbPath('c101')]: staleMtime,
    [dbPath('c102')]: staleMtime,
    [dbPath('c103')]: staleMtime,
    [dbPath('c104')]: staleMtime,
    [dbPath('c105')]: staleMtime,
    [dbPath('c106')]: staleMtime,
    [dbPath('c107')]: staleMtime,
    [dbPath('c108')]: staleMtime,
    [dbPath('c109')]: staleMtime,
    [dbPath('c110')]: staleMtime,
  }

  const { lines } = harness.run({ processes, mtimes }, { WD_AGY_SECS: '900' })
  const alertedPids = lines.map((l) => l.match(/pid (\d+)/)?.[1]).sort()
  assert.deepEqual(alertedPids, ['107', '108', '109', '110'])
  assert.ok(lines.every((l) => l.startsWith('AGY STALL:') && l.includes('own conversation database 2000s silent')))
})

test('Antigravity evidence isolates sibling PIDs, accepts .db-wal, and excludes .db-shm, summary DBs, logs, and stdout', (t) => {
  const harness = makeHarness(t)
  const convDir = harness.agyConvDir
  const dbStale = join(convDir, 'stale.db')
  const dbFresh = join(convDir, 'fresh.db')
  const walStale = join(convDir, 'wal-stale.db-wal')
  const walFresh = join(convDir, 'wal-fresh.db-wal')
  const shmFresh = join(convDir, 'fresh.db-shm')
  const summaryDbFresh = join(convDir, 'conversation_summaries.db')
  const summaryWalFresh = join(convDir, 'conversation_summaries.db-wal')
  const logFresh = join(convDir, 'agent.log')
  const stdoutFresh = join(harness.stateDir, 'stdout.log')

  const processes = {
    201: processFixture({ comm: 'agy', args: 'agy -p run', etime: '20:00', lstart: 'start-201', openFiles: [dbStale] }),
    202: processFixture({ comm: 'agy', args: 'agy -p run', etime: '20:00', lstart: 'start-202', openFiles: [dbFresh] }),
    203: processFixture({ comm: 'agy', args: 'agy -p run', etime: '20:00', lstart: 'start-203', openFiles: [walFresh] }),
    204: processFixture({ comm: 'agy', args: 'agy -p run', etime: '20:00', lstart: 'start-204', openFiles: [dbStale, shmFresh] }),
    205: processFixture({ comm: 'agy', args: 'agy -p run', etime: '20:00', lstart: 'start-205', openFiles: [dbStale, summaryDbFresh, summaryWalFresh] }),
    206: processFixture({ comm: 'agy', args: 'agy -p run', etime: '20:00', lstart: 'start-206', openFiles: [dbStale, logFresh] }),
    207: processFixture({ comm: 'agy', args: 'agy -p run', etime: '20:00', lstart: 'start-207', openFiles: [dbStale, stdoutFresh] }),
    208: processFixture({ comm: 'agy', args: 'agy -p run', etime: '20:00', lstart: 'start-208', openFiles: [dbStale, walStale] }),
  }

  const mtimes = {
    [dbStale]: 8_000,
    [dbFresh]: 9_950,
    [walFresh]: 9_950,
    [walStale]: 8_500,
    [shmFresh]: 9_950,
    [summaryDbFresh]: 9_950,
    [summaryWalFresh]: 9_950,
    [logFresh]: 9_950,
    [stdoutFresh]: 9_950,
  }

  const { lines } = harness.run({ processes, mtimes }, { WD_AGY_SECS: '900' })
  const alerted = Object.fromEntries(lines.map((l) => [l.match(/pid (\d+)/)?.[1], l]))
  assert.ok(alerted['201'])
  assert.equal(alerted['202'], undefined)
  assert.equal(alerted['203'], undefined)
  assert.ok(alerted['204'])
  assert.ok(alerted['205'])
  assert.ok(alerted['206'])
  assert.ok(alerted['207'])
  assert.ok(alerted['208'])
  assert.match(alerted['208'], /own conversation database 1500s silent/)
})

test('Antigravity enforces strict startup 60s and silence 900s boundaries and parses all elapsed shapes', (t) => {
  const harness = makeHarness(t)
  const dbBoundary = join(harness.agyConvDir, 'boundary.db')

  const processes = {
    301: processFixture({ comm: 'agy', args: 'agy -p run', etime: '01:00', lstart: 'start-301' }),
    302: processFixture({ comm: 'agy', args: 'agy -p run', etime: '01:01', lstart: 'start-302' }),
    303: processFixture({ comm: 'agy', args: 'agy -p run', etime: '00:01:01', lstart: 'start-303' }),
    304: processFixture({ comm: 'agy', args: 'agy -p run', etime: '0-00:01:01', lstart: 'start-304' }),
    305: processFixture({ comm: 'agy', args: 'agy -p run', etime: '00:59', lstart: 'start-305' }),
    306: processFixture({ comm: 'agy', args: 'agy -p run', etime: '20:00', lstart: 'start-306', openFiles: [dbBoundary] }),
    307: processFixture({ comm: 'agy', args: 'agy -p run', etime: '20:00', lstart: 'start-307', openFiles: [dbBoundary] }),
  }

  const run1 = harness.run({
    processes: { 301: processes[301], 302: processes[302], 303: processes[303], 304: processes[304], 305: processes[305], 306: processes[306] },
    mtimes: { [dbBoundary]: 9_100 },
  })
  const alerted1 = run1.lines.map((l) => l.match(/pid (\d+)/)?.[1]).sort()
  assert.deepEqual(alerted1, ['302', '303', '304'])
  assert.ok(run1.lines.every((l) => l.includes('own conversation database missing after 61s')))

  const run2 = harness.run({
    processes: { 307: processes[307] },
    mtimes: { [dbBoundary]: 9_099 },
  })
  assert.equal(run2.lines.length, 1)
  assert.match(run2.lines[0], /AGY STALL: agy pid 307 own conversation database 901s silent/)
})

test('failed/empty args, comm, lstart, pgrep >1, failed lsof, and matched stat failure fail closed only for agy', (t) => {
  const harness = makeHarness(t)
  const dbPath = join(harness.agyConvDir, 'fail-closed.db')
  const altTranscript = join(harness.altHome, 'projects', 'p1', 'session.jsonl')
  const env = { WD_AGY_SECS: '100', WD_ALT_SECS: '100' }

  const initial = harness.run(
    {
      processes: {
        401: processFixture({ comm: 'agy', args: 'agy -p run', etime: '20:00', lstart: 'start-401', openFiles: [dbPath] }),
        402: processFixture({ comm: 'claude', lstart: 'start-402', openFiles: [altTranscript] }),
      },
      mtimes: { [dbPath]: 9_800, [altTranscript]: 9_800 },
    },
    env,
  )
  assert.equal(initial.lines.length, 2)
  const agyMarker = harness.markers('agy')
  const altMarker = harness.markers('alt')
  assert.equal(agyMarker.length, 1)
  assert.equal(altMarker.length, 1)

  // 1. Failed args (undefined args) preserves agy marker, does not alert, alt cleans up if disappeared
  harness.run({
    processes: {
      401: { comm: 'agy', etime: '20:00', lstart: 'start-401', openFiles: [dbPath] },
    },
    mtimes: { [dbPath]: 9_800 },
  }, env)
  assert.deepEqual(harness.markers('agy'), agyMarker)
  assert.deepEqual(harness.markers('alt'), [])

  // 2. Empty args ('') preserves agy marker
  harness.run({
    processes: {
      401: processFixture({ comm: 'agy', args: '', etime: '20:00', lstart: 'start-401', openFiles: [dbPath] }),
    },
    mtimes: { [dbPath]: 9_800 },
  }, env)
  assert.deepEqual(harness.markers('agy'), agyMarker)

  // 3. Failed comm (undefined comm) preserves agy marker
  harness.run({
    agyPids: ['401'],
    processes: {
      401: { args: 'agy -p run', etime: '20:00', lstart: 'start-401', openFiles: [dbPath] },
    },
    mtimes: { [dbPath]: 9_800 },
  }, env)
  assert.deepEqual(harness.markers('agy'), agyMarker)

  // 4. Failed lstart (undefined lstart or empty) preserves agy marker
  harness.run({
    processes: {
      401: processFixture({ comm: 'agy', args: 'agy -p run', etime: '20:00', lstart: '', openFiles: [dbPath] }),
    },
    mtimes: { [dbPath]: 9_800 },
  }, env)
  assert.deepEqual(harness.markers('agy'), agyMarker)

  // 5. pgrep > 1 preserves agy marker
  harness.run({
    pgrepStatus: { agy: 2 },
  }, env)
  assert.deepEqual(harness.markers('agy'), agyMarker)

  // 6. Failed lsof preserves agy marker
  harness.run({
    processes: {
      401: processFixture({ comm: 'agy', args: 'agy -p run', etime: '20:00', lstart: 'start-401', openFiles: [dbPath] }),
    },
    lsofFail: { 401: true },
    mtimes: { [dbPath]: 9_800 },
  }, env)
  assert.deepEqual(harness.markers('agy'), agyMarker)

  // 7. Matched stat failure (file in openFiles but not in mtimes) preserves agy marker
  harness.run({
    processes: {
      401: processFixture({ comm: 'agy', args: 'agy -p run', etime: '20:00', lstart: 'start-401', openFiles: [dbPath] }),
    },
    mtimes: {},
  }, env)
  assert.deepEqual(harness.markers('agy'), agyMarker)

  // Conclusive disappearance cleans up agy marker
  harness.run({}, env)
  assert.deepEqual(harness.markers('agy'), [])
})

test('Antigravity handles suppression, recovery, PID reuse, disappearance, live siblings, and unrelated state', (t) => {
  const harness = makeHarness(t)
  const db1 = join(harness.agyConvDir, 'conv1.db')
  const db2 = join(harness.agyConvDir, 'conv2.db')
  const env = { WD_AGY_SECS: '100' }

  // 501 and 502 both suspect
  const init = harness.run({
    processes: {
      501: processFixture({ comm: 'agy', args: 'agy -p run', etime: '20:00', lstart: 'start-501', openFiles: [db1] }),
      502: processFixture({ comm: 'agy', args: 'agy -p run', etime: '20:00', lstart: 'start-502', openFiles: [db2] }),
    },
    mtimes: { [db1]: 9_800, [db2]: 9_800 },
  }, env)
  assert.equal(init.lines.length, 2)
  assert.equal(harness.markers('agy').length, 2)

  // Repeated iteration: suppressed, 0 alerts, 0 stderr
  const repeat = harness.run({
    processes: {
      501: processFixture({ comm: 'agy', args: 'agy -p run', etime: '20:00', lstart: 'start-501', openFiles: [db1] }),
      502: processFixture({ comm: 'agy', args: 'agy -p run', etime: '20:00', lstart: 'start-502', openFiles: [db2] }),
    },
    mtimes: { [db1]: 9_800, [db2]: 9_800 },
  }, env)
  assert.deepEqual(repeat.lines, [])
  assert.equal(repeat.stderr, '')

  // Recovery: 501 gets fresh evidence (mtime 9950), 502 stays suspect
  const recovery = harness.run({
    processes: {
      501: processFixture({ comm: 'agy', args: 'agy -p run', etime: '20:00', lstart: 'start-501', openFiles: [db1] }),
      502: processFixture({ comm: 'agy', args: 'agy -p run', etime: '20:00', lstart: 'start-502', openFiles: [db2] }),
    },
    mtimes: { [db1]: 9_950, [db2]: 9_800 },
  }, env)
  assert.deepEqual(recovery.lines, [])
  assert.equal(harness.markers('agy').length, 1)
  assert.match(harness.markers('agy')[0], /-502-/)

  // 501 becomes suspect again -> alerts again
  const reStall = harness.run({
    processes: {
      501: processFixture({ comm: 'agy', args: 'agy -p run', etime: '20:00', lstart: 'start-501', openFiles: [db1] }),
      502: processFixture({ comm: 'agy', args: 'agy -p run', etime: '20:00', lstart: 'start-502', openFiles: [db2] }),
    },
    mtimes: { [db1]: 9_800, [db2]: 9_800 },
  }, env)
  assert.equal(reStall.lines.length, 1)
  assert.match(reStall.lines[0], /pid 501/)
  assert.equal(harness.markers('agy').length, 2)

  // 502 disappears, 501 still live -> 502 marker removed, 501 marker preserved
  writeFileSync(join(harness.stateDir, 'unrelated-marker.txt'), 'preserve')
  const dis = harness.run({
    processes: {
      501: processFixture({ comm: 'agy', args: 'agy -p run', etime: '20:00', lstart: 'start-501', openFiles: [db1] }),
    },
    mtimes: { [db1]: 9_800 },
  }, env)
  assert.deepEqual(dis.lines, [])
  assert.equal(harness.markers('agy').length, 1)
  assert.match(harness.markers('agy')[0], /-501-/)
  assert.equal(readFileSync(join(harness.stateDir, 'unrelated-marker.txt'), 'utf8'), 'preserve')

  // PID reuse: 501 PID reused with new lstart
  const reuse = harness.run({
    processes: {
      501: processFixture({ comm: 'agy', args: 'agy -p run', etime: '20:00', lstart: 'new-start-501', openFiles: [db1] }),
    },
    mtimes: { [db1]: 9_800 },
  }, env)
  assert.equal(reuse.lines.length, 1)
  assert.match(reuse.lines[0], /pid 501/)
  assert.equal(harness.markers('agy').length, 1)
  assert.match(harness.markers('agy')[0], /new_start_501/)
})

test('cooperating watchdogs serialize one first AGY alert and busy lock preserves .wd-agy-* state', { timeout: 10_000 }, async (t) => {
  const harness = makeHarness(t)
  const dbPath = join(harness.agyConvDir, 'coop.db')
  const lockFile = join(harness.stateDir, '.wd-sensors.lock')
  const agyMarker = '.wd-agy-601-held_incarnation'
  writeFileSync(join(harness.stateDir, agyMarker), 'agy sentinel')

  // Busy lock preserves marker while heartbeat active
  const holder = holdSensorLock(lockFile)
  t.after(() => holder.release())
  await holder.ready

  const busyResult = harness.run(
    {
      now: 10_000,
      processes: {
        601: processFixture({ comm: 'agy', args: 'agy -p run', lstart: 'new agy incarnation', openFiles: [dbPath] }),
      },
      mtimes: { [harness.transcript]: 8_000, [dbPath]: 8_000 },
    },
    { WD_IDLE_SECS: '100', WD_AGY_SECS: '100' },
  )
  assert.deepEqual(busyResult.lines, ['HEARTBEAT: idle 33min, codex=0 alt=0 — board check due'])
  assert.equal(busyResult.stderr, '')
  assert.deepEqual(harness.markers('agy'), [agyMarker])
  assert.equal(readFileSync(join(harness.stateDir, agyMarker), 'utf8'), 'agy sentinel')

  await holder.release()
  rmSync(join(harness.stateDir, agyMarker))

  // Cooperating watchdogs serialize one first marker claim
  const fixture = {
    blockPgrep: 'agy',
    blockReadyPath: join(harness.stateDir, 'first-watchdog-holds-agy-lock'),
    processes: {
      602: processFixture({ comm: 'agy', args: 'agy -p run', lstart: 'shared agy incarnation', openFiles: [dbPath] }),
    },
    mtimes: { [dbPath]: 9_800 },
  }
  const env = { WD_AGY_SECS: '100' }

  const first = harness.spawnRun(fixture, env)
  t.after(() => {
    if (!first.child.stdin.writableEnded) first.child.stdin.end()
    return first.completed
  })
  await first.blocked

  const second = harness.spawnRun(fixture, env)
  t.after(() => {
    if (!second.child.stdin.writableEnded) second.child.stdin.end()
    return second.completed
  })
  second.child.stdin.end()
  const secondResult = await second.completed
  assert.equal(secondResult.status, 0, secondResult.stderr)
  assert.deepEqual(secondResult.lines, [])
  assert.deepEqual(harness.markers('agy'), [])

  first.child.stdin.end()
  const firstResult = await first.completed
  assert.equal(firstResult.status, 0, firstResult.stderr)
  assert.equal([...firstResult.lines, ...secondResult.lines].length, 1)
  assert.match(firstResult.lines[0], /AGY STALL: agy pid 602 /)
  assert.equal(harness.markers('agy').length, 1)
})

test('Antigravity production defaults and threshold overrides remain effective', (t) => {
  const harness = makeHarness(t)
  const dbPath = join(harness.agyConvDir, 'defaults.db')

  const fixture = {
    now: 10_000,
    processes: {
      701: processFixture({ comm: 'agy', args: 'agy -p run', etime: '01:01', lstart: 'start-701' }),
      702: processFixture({ comm: 'agy', args: 'agy -p run', etime: '20:00', lstart: 'start-702', openFiles: [dbPath] }),
    },
    mtimes: { [dbPath]: 9_099 },
  }

  const defaults = harness.run(fixture)
  assert.equal(defaults.lines.length, 2)
  assert.ok(defaults.lines.some((l) => l.includes('pid 701') && l.includes('missing after 61s')))
  assert.ok(defaults.lines.some((l) => l.includes('pid 702') && l.includes('901s silent')))

  const overridden = harness.run(fixture, { WD_AGY_STARTUP_SECS: '62', WD_AGY_SECS: '902' })
  assert.deepEqual(overridden.lines, [])
})

test('Antigravity print mode selector distinguishes print and interactive flags across orderings and prompt text', (t) => {
  const harness = makeHarness(t)
  const dbPath = (name) => join(harness.agyConvDir, `${name}.db`)
  const staleMtime = 8_000

  const processes = {
    // Ordering 1: Interactive mode option occurs first, prompt text mentions print tokens -> EXCLUDED
    801: processFixture({ comm: 'agy', args: 'agy -i talk about -p now', etime: '20:00', lstart: 'start-801', openFiles: [dbPath('c801')] }),
    802: processFixture({ comm: 'agy', args: 'agy -i talk about --print now', etime: '20:00', lstart: 'start-802', openFiles: [dbPath('c802')] }),
    803: processFixture({ comm: 'agy', args: 'agy --prompt-interactive talk about -p now', etime: '20:00', lstart: 'start-803', openFiles: [dbPath('c803')] }),
    804: processFixture({ comm: 'agy', args: 'agy --prompt-interactive talk about --print now', etime: '20:00', lstart: 'start-804', openFiles: [dbPath('c804')] }),
    805: processFixture({ comm: 'agy', args: "agy -i 'talk about -p now'", etime: '20:00', lstart: 'start-805', openFiles: [dbPath('c805')] }),
    806: processFixture({ comm: 'agy', args: "agy --prompt-interactive 'talk about --print now'", etime: '20:00', lstart: 'start-806', openFiles: [dbPath('c806')] }),

    // Ordering 2: Print mode option occurs first, prompt text mentions interactive tokens -> SELECTED
    811: processFixture({ comm: 'agy', args: 'agy -p talk about -i now', etime: '20:00', lstart: 'start-811', openFiles: [dbPath('c811')] }),
    812: processFixture({ comm: 'agy', args: 'agy -p talk about --prompt-interactive now', etime: '20:00', lstart: 'start-812', openFiles: [dbPath('c812')] }),
    813: processFixture({ comm: 'agy', args: 'agy --print talk about -i now', etime: '20:00', lstart: 'start-813', openFiles: [dbPath('c813')] }),
    814: processFixture({ comm: 'agy', args: 'agy --print talk about --prompt-interactive now', etime: '20:00', lstart: 'start-814', openFiles: [dbPath('c814')] }),
    815: processFixture({ comm: 'agy', args: "agy -p 'talk about -i now'", etime: '20:00', lstart: 'start-815', openFiles: [dbPath('c815')] }),
    816: processFixture({ comm: 'agy', args: "agy --print 'talk about --prompt-interactive now'", etime: '20:00', lstart: 'start-816', openFiles: [dbPath('c816')] }),
  }

  const mtimes = {
    [dbPath('c801')]: staleMtime,
    [dbPath('c802')]: staleMtime,
    [dbPath('c803')]: staleMtime,
    [dbPath('c804')]: staleMtime,
    [dbPath('c805')]: staleMtime,
    [dbPath('c806')]: staleMtime,
    [dbPath('c811')]: staleMtime,
    [dbPath('c812')]: staleMtime,
    [dbPath('c813')]: staleMtime,
    [dbPath('c814')]: staleMtime,
    [dbPath('c815')]: staleMtime,
    [dbPath('c816')]: staleMtime,
  }

  const { lines } = harness.run({ processes, mtimes }, { WD_AGY_SECS: '900' })
  const alertedPids = lines.map((l) => l.match(/pid (\d+)/)?.[1]).sort()
  assert.deepEqual(alertedPids, ['811', '812', '813', '814', '815', '816'])
  assert.ok(lines.every((l) => l.startsWith('AGY STALL:') && l.includes('own conversation database 2000s silent')))
})
