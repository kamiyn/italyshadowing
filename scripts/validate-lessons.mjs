#!/usr/bin/env node
// Walks data/ and validates each lesson JSON file at build time.
//
// 旧 generate-index.mjs を `data/index.json` 生成抜きの **検証専用** として
// 縮小したスクリプト。`npm run build` の最初のステップとして実行され、違反
// を見つけた瞬間に非ゼロ終了して `&&` chain で後続 (lint-fix / vite build)
// をブロックする。これにより不正な教材ファイルを含む状態で CI / GitHub
// Pages デプロイが成功してしまう regression を防ぐ。
//
// 検証内容:
//   - filename regex `^[A-Za-z0-9_-]+$` 一致 (ADR-001)
//   - JSON parse 可能
//   - `title` / `description` が string
//   - `lines` が string の配列
//
// 関連:
//   - src/router/index.js — URL ルートで同じ regex を使用
//   - src/lib/dataClient.js — module init で defense-in-depth として同じ regex
//   - README.md「教材ファイル名の制約」 — ユーザー向け説明
//   - Documents/ADR-001-filename-pattern-duplication.md — 4 箇所重複の決定根拠
//   - Documents/ADR-003-build-pipeline-chaining.md — 3 ステップ chain の決定根拠

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.resolve(HERE, '..', 'data')

// 同じ regex リテラルが src/router/index.js / src/lib/dataClient.js / README にも
// 存在する。変更時は ADR-001 に従い 4 箇所を同一コミットで更新すること。
const FILENAME_PATTERN = /^[A-Za-z0-9_-]+$/

async function main() {
  const entries = await fs.readdir(DATA_DIR, { withFileTypes: true })
  let lessonCount = 0

  for (const entry of entries) {
    if (!entry.isFile()) continue
    if (!entry.name.endsWith('.json')) continue

    const stem = entry.name.replace(/\.json$/, '')
    if (!FILENAME_PATTERN.test(stem)) {
      throw new Error(
        `Invalid lesson filename: "${entry.name}". `
        + `The stem "${stem}" must match ${FILENAME_PATTERN} `
        + `(半角英数字・ハイフン・アンダースコアのみ). `
        + `Rename or remove the file. See README.md "教材ファイル名の制約" `
        + `and Documents/ADR-001-filename-pattern-duplication.md.`,
      )
    }

    const filePath = path.join(DATA_DIR, entry.name)
    let parsed
    try {
      const raw = await fs.readFile(filePath, 'utf8')
      parsed = JSON.parse(raw)
    }
    catch (err) {
      throw new Error(`Failed to read or parse ${entry.name}: ${err.message}`, { cause: err })
    }

    if (typeof parsed.title !== 'string') {
      throw new Error(`${entry.name}: "title" must be a string`)
    }
    if (typeof parsed.description !== 'string') {
      throw new Error(`${entry.name}: "description" must be a string`)
    }
    if (!Array.isArray(parsed.lines) || parsed.lines.some(l => typeof l !== 'string')) {
      throw new Error(`${entry.name}: "lines" must be an array of strings`)
    }

    lessonCount++
  }

  console.log(`Validated ${lessonCount} lesson${lessonCount === 1 ? '' : 's'} in ${DATA_DIR}`)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
