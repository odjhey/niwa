#!/usr/bin/env node
// find-docs.mjs — query docs by frontmatter. Zero dependencies (Node 18+).
//
// Usage:
//   node docs/scripts/find-docs.mjs                        # list live docs (superseded/retired/stale hidden)
//   node docs/scripts/find-docs.mjs --type playbook        # filter by type
//   node docs/scripts/find-docs.mjs --authority normative  # filter by authority
//   node docs/scripts/find-docs.mjs --id OPERATING-MODEL   # exact id lookup
//   node docs/scripts/find-docs.mjs gate review            # free-text terms (id+description)
//   node docs/scripts/find-docs.mjs --all                  # include superseded/retired/stale docs
//   node docs/scripts/find-docs.mjs --stale                # ONLY superseded/retired or past stale_after
//   node docs/scripts/find-docs.mjs --status draft         # filter by explicit status (implies --all)
//   node docs/scripts/find-docs.mjs --json                 # JSON output for tooling
//
// Default excludes stale docs (status superseded/retired/merged/abandoned, or
// stale_after in the past) so day-to-day queries only surface live content.
// Exit code: 0 if matches found, 1 if none.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const DOCS_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const STALE_STATUSES = new Set(['superseded', 'retired', 'merged', 'abandoned'])

function* mdFiles(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) yield* mdFiles(p)
    else if (entry.endsWith('.md')) yield p
  }
}

function parseFrontmatter(text) {
  if (!text.startsWith('---\n')) return null
  const end = text.indexOf('\n---', 4)
  if (end === -1) return null
  const fm = {}
  for (const line of text.slice(4, end).split('\n')) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*): (.*)$/)
    if (!m) continue
    let [, key, value] = m
    value = value.trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
    fm[key] = value
  }
  return fm
}

// --- parse args
const args = process.argv.slice(2)
const filters = { type: [], status: [], authority: [], id: [] }
const terms = []
let stale = false
let all = false
let json = false
for (let i = 0; i < args.length; i++) {
  const a = args[i]
  if (a === '--stale') stale = true
  else if (a === '--all') all = true
  else if (a === '--json') json = true
  else if (a === '--help' || a === '-h') {
    console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').filter((l) => l.startsWith('//')).map((l) => l.slice(3)).join('\n'))
    process.exit(0)
  } else if (a.startsWith('--')) {
    const key = a.slice(2)
    if (!(key in filters)) { console.error(`unknown flag: ${a}`); process.exit(2) }
    filters[key].push(args[++i])
  } else terms.push(a.toLowerCase())
}

// --- collect + filter
const today = new Date().toISOString().slice(0, 10)
const docs = []
for (const file of mdFiles(DOCS_ROOT)) {
  const fm = parseFrontmatter(readFileSync(file, 'utf8'))
  if (!fm || !fm.id) continue
  const rel = relative(DOCS_ROOT, file)
  const isStale = STALE_STATUSES.has(fm.status) ||
    Boolean(fm.stale_after && fm.stale_after.slice(0, 10) < today)

  if (stale && !isStale) continue
  // default: hide stale docs unless --stale/--all or an explicit --status filter asks for them
  if (!stale && !all && !filters.status.length && isStale) continue
  if (filters.type.length && !filters.type.includes(fm.type)) continue
  if (filters.status.length && !filters.status.includes(fm.status)) continue
  if (filters.authority.length && !filters.authority.includes(fm.authority)) continue
  if (filters.id.length && !filters.id.includes(fm.id)) continue
  if (terms.length) {
    const haystack = `${fm.id} ${fm.description ?? ''}`.toLowerCase()
    if (!terms.every((t) => haystack.includes(t))) continue
  }
  docs.push({ path: `docs/${rel}`, ...fm, stale: isStale })
}

docs.sort((a, b) => a.path.localeCompare(b.path))

// --- output
if (json) {
  console.log(JSON.stringify(docs, null, 2))
} else {
  for (const d of docs) {
    const flags = d.stale ? ' [STALE]' : ''
    console.log(`${d.path}${flags}`)
    console.log(`  ${d.id} · ${d.type ?? '?'} · ${d.authority ?? '?'}`)
    console.log(`  ${d.description ?? ''}`)
  }
  console.error(`\n${docs.length} doc(s)`)
}
process.exit(docs.length ? 0 : 1)
