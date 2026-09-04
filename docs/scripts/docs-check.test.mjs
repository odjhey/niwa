import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { checkDocs } from './docs-check.mjs'

const fm = ({ id = 'TARGET', type = 'reference', status = 'current', authority = 'informative', description = "'Fixture doc.'", extra = '' } = {}) => `---
id: ${id}
type: ${type}
status: ${status}
authority: ${authority}
description: ${description}
${extra}---

# Fixture
`

// Builds a minimal valid corpus: docs/README.md (DOCS-ROOT registry) + one
// target doc, registered by default.
function fixture(target = fm(), { path = 'target.md', register = true, directoryLink = false, registryRows = '' } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'docs-check-'))
  const docs = join(root, 'docs')
  mkdirSync(join(docs, ...path.split('/').slice(0, -1)), { recursive: true })
  writeFileSync(join(docs, path), target)
  const rows = [
    '| `DOCS-ROOT` | `docs/README.md` | normative |',
    register ? `| \`TARGET\` | \`docs/${path}\` | informative |` : '',
    registryRows,
  ].filter(Boolean).join('\n')
  writeFileSync(join(docs, 'README.md'), fm({ id: 'DOCS-ROOT', authority: 'normative' }) + `\n| ID | Path | Authority |\n|---|---|---|\n${rows}\n`)
  if (directoryLink) {
    const directory = path.split('/').slice(0, -1).join('/')
    const name = path.split('/').at(-1)
    writeFileSync(join(docs, directory, 'README.md'), fm({ id: 'DIR-INDEX', type: 'index' }) + `\n[target](./${name})\n`)
    const readme = readFileSync(join(docs, 'README.md'), 'utf8')
    writeFileSync(join(docs, 'README.md'), readme + `| \`DIR-INDEX\` | \`docs/${directory}/README.md\` | informative |\n`)
  }
  return root
}

const messages = (root) => checkDocs({ root }).map((finding) => finding.message)

test('accepts a valid corpus', () => assert.deepEqual(messages(fixture()), []))

test('requires frontmatter and the five required fields', () => {
  assert(messages(fixture('# no frontmatter')).some((m) => m.includes('frontmatter is missing')))
  assert(messages(fixture('---\nid: TARGET\ntype: reference\nstatus: current\nauthority: informative\n---\n')).includes('required frontmatter field "description" is missing'))
})

test('enforces the id, type, status, and authority vocabularies', () => {
  assert(messages(fixture(fm({ id: 'lower_case' }), { register: false })).some((m) => m.includes('is not UPPER-KEBAB-CASE')))
  assert(messages(fixture(fm({ type: 'mystery' }))).includes('frontmatter type "mystery" is not in the documented taxonomy'))
  assert(messages(fixture(fm({ status: 'vibing' }))).includes('frontmatter status "vibing" is not in the documented vocabulary'))
  assert(messages(fixture(fm({ authority: 'absolute' }))).includes('frontmatter authority "absolute" must be normative or informative'))
})

test('flags an unquoted colon-space in description', () => {
  assert(messages(fixture(fm({ description: 'Broken: yaml nesting.' }))).some((m) => m.includes('unquoted colon-space')))
  assert.deepEqual(messages(fixture(fm({ description: "'Quoted: fine.'" }))), [])
})

test('validates stale_after as an ISO-8601 date', () => {
  assert(messages(fixture(fm({ extra: 'stale_after: someday\n' }))).includes('stale_after is not an ISO-8601 date'))
  assert.deepEqual(messages(fixture(fm({ extra: 'stale_after: 2027-01-01\n' }))), [])
})

test('reports duplicate ids on both files', () => {
  const root = fixture()
  writeFileSync(join(root, 'docs', 'second.md'), fm())
  const readme = readFileSync(join(root, 'docs', 'README.md'), 'utf8')
  writeFileSync(join(root, 'docs', 'README.md'), readme + '| `SECOND` | `docs/second.md` | informative |\n')
  assert.equal(messages(root).filter((m) => m.includes('duplicated by')).length, 2)
})

test('reports unresolved relative markdown links', () => {
  assert(messages(fixture(fm() + '\n[missing](./missing.md)\n')).includes('relative link does not resolve: ./missing.md'))
})

test('link-checks AGENTS.md', () => {
  const root = fixture()
  writeFileSync(join(root, 'AGENTS.md'), '# Agents\n\n[gone](docs/gone.md)\n')
  assert(messages(root).includes('relative link does not resolve: docs/gone.md'))
})

test('checks registry rows against the docs they point to', () => {
  assert(messages(fixture(fm(), { register: false, registryRows: '| `GHOST` | `docs/ghost.md` | informative |' })).includes('registry path does not resolve: docs/ghost.md'))
  assert(messages(fixture(fm({ id: 'OTHER-ID' }))).some((m) => m.includes('declares id "OTHER-ID"')))
  assert(messages(fixture(fm({ authority: 'normative' }))).some((m) => m.includes('frontmatter says normative')))
  const dupe = fixture(fm(), { registryRows: '| `TARGET` | `docs/target.md` | informative |' })
  assert(messages(dupe).some((m) => m.includes('duplicate registry row for "TARGET"')))
})

test('requires every doc to be registered or linked from its directory README', () => {
  assert(messages(fixture(fm(), { register: false })).some((m) => m.includes('doc is unreachable')))
  assert.deepEqual(messages(fixture(fm(), { path: 'area/target.md', register: false, directoryLink: true })), [])
})

test('rejects duplicate decision-number rows in the ledger index', () => {
  const root = fixture(fm({ id: 'DECISION-0001', type: 'decision' }), { path: 'delivery/decisions/0001-fixture.md', register: false, directoryLink: true })
  const index = join(root, 'docs', 'delivery', 'decisions', 'README.md')
  writeFileSync(index, `${readFileSync(index, 'utf8')}\n| [1](0001-fixture.md) | First |\n| [1](0001-fixture.md) | Duplicate |\n`)
  assert(messages(root).some((m) => m.includes('duplicate decision-number row "1"')))
})
