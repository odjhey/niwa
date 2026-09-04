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
  if (!proc || proc[field] === undefined) process.exitCode = 1
  else print(proc[field])
} else if (command === 'lsof') {
  const pid = args[2]
  const proc = fixture.processes[pid]
  if (args.length !== 3 || args[0] !== '-Fn' || args[1] !== '-p' || !proc) {
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
  const transcript = join(root, 'watchtower transcript.jsonl')
  const fixturePath = join(root, 'fixture.json')
  const sleepLog = join(root, 'sleep.log')
  mkdirSync(bin)
  mkdirSync(stateDir)
  mkdirSync(altHome)
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

  return { altHome, invokeLsof, markers, run, runRaw, spawnRun, stateDir, transcript }
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
  argv = '',
  comm,
  cputime = '00:01',
  etime = '01:41',
  lstart,
  openFiles = [],
}) {
  return { argv, comm, cputime, etime, lstart, openFiles }
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
