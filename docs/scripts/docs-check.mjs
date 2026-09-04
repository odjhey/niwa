#!/usr/bin/env node
// docs-check.mjs — validate the docs corpus against DOCS-ROOT conventions.
// Zero dependencies (Node 18+). Ported and adapted from xatu-delivery-companion
// via knocknuk. Exported checkDocs() is exercised by docs-check.test.mjs.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

export const DOC_TYPES = new Set([
  'contract', 'decision', 'index', 'ledger', 'plan', 'playbook',
  'reference', 'task-card', 'template',
])

export const STATUSES = new Set([
  // general lifecycle
  'current', 'draft', 'superseded', 'retired',
  // task-card lifecycle (TEMPLATE-TASK-CARD)
  'dispatched', 'merged', 'abandoned',
])

export const AUTHORITIES = new Set(['normative', 'informative'])

const ID_PATTERN = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/

function* markdownFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) yield* markdownFiles(path)
    else if (entry.name.endsWith('.md')) yield path
  }
}

export function parseFrontmatter(text) {
  if (!text.startsWith('---\n')) return null
  const end = text.indexOf('\n---\n', 4)
  if (end < 0) return null
  const values = {}
  const raw = {}
  for (const line of text.slice(4, end).split('\n')) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/)
    if (!match) continue
    let value = match[2].trim()
    raw[match[1]] = value
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    values[match[1]] = value
  }
  return { values, raw }
}

function markdownDestinations(text) {
  const destinations = []
  const pattern = /!?\[[^\]]*\]\(([^)]+)\)/g
  for (const match of text.matchAll(pattern)) {
    let destination = match[1].trim()
    if (destination.startsWith('<') && destination.endsWith('>')) destination = destination.slice(1, -1)
    // A title may follow a destination. Paths containing spaces should be angle-bracketed/escaped.
    destination = destination.replace(/\s+["'][^"']*["']$/, '')
    destinations.push(destination)
  }
  return destinations
}

function localTarget(source, destination) {
  if (!destination || destination.startsWith('#') || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(destination)) return null
  const pathPart = destination.split('#', 1)[0].split('?', 1)[0]
  if (!pathPart) return null
  try {
    return resolve(dirname(source), decodeURIComponent(pathPart))
  } catch {
    return resolve(dirname(source), pathPart)
  }
}

function isIsoDate(value) {
  return typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value) &&
    Number.isFinite(Date.parse(value))
}

// Registry rows in DOCS-ROOT: | `ID` | `path` | authority |
function registryRows(text) {
  return [...text.matchAll(/^\|\s*`([^`]+)`\s*\|\s*`([^`]+)`\s*\|\s*([a-z-]+)\s*\|/gm)]
    .map((match) => ({ id: match[1], path: match[2], authority: match[3] }))
}

export function checkDocs({ root = process.cwd() } = {}) {
  root = resolve(root)
  const docsRoot = join(root, 'docs')
  const files = [...markdownFiles(docsRoot)]
  const registryFile = join(docsRoot, 'README.md')
  const texts = new Map(files.map((file) => [file, readFileSync(file, 'utf8')]))
  const frontmatterByFile = new Map()
  const findings = []
  const rel = (file) => relative(root, file).split(sep).join('/')
  const add = (file, message) => findings.push({ file: rel(file), message })

  for (const file of files) {
    const text = texts.get(file)
    const parsed = parseFrontmatter(text)
    frontmatterByFile.set(file, parsed?.values ?? null)
    if (!parsed) {
      add(file, 'frontmatter is missing or not terminated')
    } else {
      const fm = parsed.values
      for (const field of ['id', 'type', 'status', 'authority', 'description']) {
        if (!fm[field]) add(file, `required frontmatter field "${field}" is missing`)
      }
      if (fm.id && !ID_PATTERN.test(fm.id)) add(file, `frontmatter id "${fm.id}" is not UPPER-KEBAB-CASE`)
      if (fm.type && !DOC_TYPES.has(fm.type)) add(file, `frontmatter type "${fm.type}" is not in the documented taxonomy`)
      if (fm.status && !STATUSES.has(fm.status)) add(file, `frontmatter status "${fm.status}" is not in the documented vocabulary`)
      if (fm.authority && !AUTHORITIES.has(fm.authority)) add(file, `frontmatter authority "${fm.authority}" must be normative or informative`)
      const rawDescription = parsed.raw.description
      if (rawDescription && !/^['"]/.test(rawDescription) && rawDescription.includes(': ')) {
        add(file, 'description contains an unquoted colon-space; quote the value (DOCS-ROOT YAML rule)')
      }
      if (fm.stale_after && !isIsoDate(fm.stale_after)) add(file, 'stale_after is not an ISO-8601 date')
    }

    for (const destination of markdownDestinations(text)) {
      const target = localTarget(file, destination)
      if (target && !existsSync(target)) add(file, `relative link does not resolve: ${destination}`)
    }
  }

  // AGENTS.md is the entry doc: link-check it too (no frontmatter schema applies).
  const agentsFile = join(root, 'AGENTS.md')
  if (existsSync(agentsFile)) {
    for (const destination of markdownDestinations(readFileSync(agentsFile, 'utf8'))) {
      const target = localTarget(agentsFile, destination)
      if (target && !existsSync(target)) add(agentsFile, `relative link does not resolve: ${destination}`)
    }
  }

  // Unique ids across the corpus.
  const ids = new Map()
  for (const [file, fm] of frontmatterByFile) {
    if (!fm?.id) continue
    const previous = ids.get(fm.id)
    if (previous) {
      add(previous, `frontmatter id "${fm.id}" is duplicated by ${rel(file)}`)
      add(file, `frontmatter id "${fm.id}" is duplicated by ${rel(previous)}`)
    } else ids.set(fm.id, file)
  }

  // Registry sync: every row resolves and matches the doc's own frontmatter.
  const registered = new Set()
  const seenRegistryIds = new Set()
  const rows = registryRows(texts.get(registryFile) ?? '')
  for (const row of rows) {
    if (seenRegistryIds.has(row.id)) add(registryFile, `duplicate registry row for "${row.id}"`)
    seenRegistryIds.add(row.id)
    const target = resolve(root, row.path)
    if (!existsSync(target)) {
      add(registryFile, `registry path does not resolve: ${row.path}`)
      continue
    }
    registered.add(target)
    const fm = frontmatterByFile.get(target)
    if (fm && fm.id !== row.id) add(registryFile, `registry id "${row.id}" but ${row.path} declares id "${fm.id}"`)
    if (fm && fm.authority && fm.authority !== row.authority) add(registryFile, `registry lists ${row.path} as ${row.authority} but its frontmatter says ${fm.authority}`)
  }

  // Reachability: every doc is registered in DOCS-ROOT or linked from its
  // directory README (the ledgers-are-directories convention).
  const linksTo = (index, target) => {
    const text = texts.get(index)
    if (!text) return false
    return markdownDestinations(text).some((destination) => localTarget(index, destination) === target)
  }
  for (const file of files) {
    if (file === registryFile || registered.has(file)) continue
    const directoryIndex = join(dirname(file), 'README.md')
    if (file !== directoryIndex && linksTo(directoryIndex, file)) continue
    add(file, 'doc is unreachable: add it to the DOCS-ROOT registry or link it from its directory README')
  }

  // Duplicate decision-number rows in ledger indexes (union-merge guard).
  for (const file of files) {
    if (!rel(file).endsWith('decisions/README.md')) continue
    const seenNumbers = new Set()
    for (const match of texts.get(file).matchAll(/^\|\s*\[(\d+)\]\(([^)]+)\)\s*\|/gm)) {
      if (seenNumbers.has(match[1])) add(file, `duplicate decision-number row "${match[1]}"; remove the repeated table row (a union merge may have kept both copies)`)
      else seenNumbers.add(match[1])
    }
  }

  return findings.sort((a, b) => a.file.localeCompare(b.file) || a.message.localeCompare(b.message))
}

function main() {
  const findings = checkDocs()
  if (!findings.length) {
    console.log('docs-check: all documentation checks passed')
    return
  }
  console.error(`docs-check: ${findings.length} finding(s)`)
  for (const finding of findings) console.error(`${finding.file}: ${finding.message}`)
  process.exitCode = 1
}

if (isAbsolute(process.argv[1] ?? '') && import.meta.url === pathToFileURL(process.argv[1]).href) main()
