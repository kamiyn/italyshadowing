#!/usr/bin/env node
// Scans data/ for lesson JSON files and writes data/index.json with the
// metadata needed by the home page (filename stem, title, description).
// Run automatically as part of `npm run build`, or manually after adding a
// new lesson to refresh the listing.

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.resolve(HERE, '..', 'data')
const INDEX_FILE = path.join(DATA_DIR, 'index.json')

// Same constraint enforced by src/router/index.js (FILENAME_PATTERN) and
// src/lib/dataClient.js (encodeLessonFilename), and documented in README.md
// under "教材ファイル名の制約". Kept in sync by convention. If a lesson file
// slips through with a disallowed name, the runtime router would redirect
// it away and fetchLesson() would reject it — so we fail loudly here instead
// of producing an index.json that lists unreachable entries.
const FILENAME_PATTERN = /^[A-Za-z0-9_-]+$/

async function main() {
  const entries = await fs.readdir(DATA_DIR, { withFileTypes: true })
  const lessons = []

  for (const entry of entries) {
    if (!entry.isFile()) continue
    if (!entry.name.endsWith('.json')) continue
    if (entry.name === 'index.json') continue

    const stem = entry.name.replace(/\.json$/, '')
    if (!FILENAME_PATTERN.test(stem)) {
      throw new Error(
        `Invalid lesson filename: "${entry.name}". `
        + `The stem "${stem}" must match ${FILENAME_PATTERN} `
        + `(半角英数字・ハイフン・アンダースコアのみ). `
        + `Rename or remove the file. See README.md "教材ファイル名の制約".`,
      )
    }

    const filePath = path.join(DATA_DIR, entry.name)
    let parsed
    try {
      const raw = await fs.readFile(filePath, 'utf8')
      parsed = JSON.parse(raw)
    }
    catch (err) {
      throw new Error(`Failed to read or parse ${entry.name}: ${err.message}`)
    }

    lessons.push({
      filename: stem,
      title: typeof parsed.title === 'string' ? parsed.title : '',
      description: typeof parsed.description === 'string' ? parsed.description : '',
    })
  }

  lessons.sort((a, b) => a.filename.localeCompare(b.filename))

  const payload = JSON.stringify({ lessons }, null, 2) + '\n'
  await fs.writeFile(INDEX_FILE, payload, 'utf8')
  console.log(`Wrote ${INDEX_FILE} (${lessons.length} lesson${lessons.length === 1 ? '' : 's'})`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
