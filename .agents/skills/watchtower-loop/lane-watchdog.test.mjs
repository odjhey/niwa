import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  chmodSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const watchdog = join(here, 'lane-watchdog.sh')

const fakeCommandSource = `#!${process.execPath}
import { appendFileSync, readFileSync } from 'node:fs'
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
  if (args.length === 2 && args[0] === '-f' && args[1] === 'codex exec') {
    pids = fixture.codexPids
  } else if (args.length === 2 && args[0] === '-x' && args[1] === 'claude') {
    pids = Object.entries(fixture.processes)
      .filter(([, proc]) => proc.comm === 'claude')
      .map(([pid]) => pid)
  }
  if (pids.length) print(pids.join('\\n'))
  else process.exitCode = 1
} else if (command === 'ps') {
  const field = args[args.indexOf('-o') + 1].replace(/=$/, '')
  const pid = args[args.indexOf('-p') + 1]
  const proc = fixture.processes[pid]
  if (!proc || proc[field] === undefined) process.exitCode = 1
  else print(proc[field])
} else if (command === 'lsof') {
  const pid = args[args.indexOf('-p') + 1]
  const proc = fixture.processes[pid]
  if (!proc) process.exitCode = 1
  else {
    print('p' + pid)
    for (const path of proc.openFiles ?? []) print('n' + path)
  }
} else if (command === 'stat') {
  const path = args.at(-1)
  if (fixture.mtimes[path] === undefined) process.exitCode = 1
  else print(fixture.mtimes[path])
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

  function run(fixture, env = {}) {
    const normalized = {
      now: 10_000,
      codexPids: [],
      processes: {},
      mtimes: {},
      ...fixture,
    }
    normalized.mtimes = { [transcript]: normalized.now, ...normalized.mtimes }
    writeFileSync(fixturePath, JSON.stringify(normalized))
    writeFileSync(sleepLog, '')
    const result = spawnSync('/bin/zsh', [watchdog], {
      encoding: 'utf8',
      env: {
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
      },
    })
    assert.equal(result.status, 0, `watchdog failed:\n${result.stderr}`)
    return {
      lines: result.stdout.trim() ? result.stdout.trim().split('\n') : [],
      sleeps: readFileSync(sleepLog, 'utf8').trim().split('\n').filter(Boolean),
    }
  }

  return { altHome, run, stateDir, transcript }
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
  assert.equal(harness.run(fixture(9_899, 'second incarnation'), env).lines.length, 1)
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
