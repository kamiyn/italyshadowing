# ADR-001: 教材ファイル名正規表現の重複管理

## Status

Accepted (2025-Q1 制定 / 2026-04 dataClient inline 化に伴い改定)

## Context

教材ファイル名の制約 `^[A-Za-z0-9_-]+$` は、ランタイム・ユーザー向けドキュメントの計 3 箇所で参照される。

- `src/router/index.js` — reader ルートの `FILENAME_PATTERN` 定数
- `src/lib/dataClient.js` — `FILENAME_PATTERN` 定数 (`encodeLessonFilename()` 入力検証 + module init での lesson 一覧 fail-loud 検証で再利用)
- `README.md` 「教材ファイル名の制約」セクション — ユーザー向けドキュメント

これらを共有モジュールに切り出すべきかを検討した。

> **改定経緯**: 旧版は `scripts/generate-index.mjs` を含む 4 箇所重複だった。後続改定で `data/*.json` を Vite の `import.meta.glob` で JS バンドルへ inline する方針 (build 時 fetch 排除 + iPhone Safari キャッシュ問題回避) に切り替えたため、`generate-index.mjs` は撤廃。それが担っていた fail-loud 検証は `src/lib/dataClient.js` の module init に統合した。

## Decision

共有モジュールを作らず、3 箇所にコピーで置く。変更時の同期義務を CLAUDE.md と本 ADR で担保する。

## Rationale

- `src/router` と `src/lib/dataClient` は Vite バンドラ経由、`README.md` は Markdown。それぞれ異なる読み込み経路で、共通モジュールを跨って import するとビルド構成が複雑化する。
- 正規表現は 1 行の定数で、変更頻度が極めて低い。
- `src/lib/dataClient.js` は module init で lesson 一覧を組み立てる際に各ファイル名を `FILENAME_PATTERN.test()` し、不一致時に throw する。これにより bad filename の commit は dev 起動直後 / 初回 page load 時に即座に検出される (旧 `generate-index.mjs` の fail-loud と同等)。
- 重複によるリスクは「変更時に 1 箇所を更新し忘れる」ことだが、ランタイム 2 箇所 + ドキュメント 1 箇所はいずれも `FILENAME_PATTERN` / `^[A-Za-z0-9_-]+$` で grep すれば一括特定できる。

## Consequences

- Pros: ビルド設定がシンプル、各ファイルが自己完結、複数モジュール系 (Vite bundle / Markdown) を跨がない。
- Cons: regex を変更する際は 3 箇所すべてを同一コミットで更新する必要がある。
- 対策: regex 変更時は `grep -r 'A-Za-z0-9_-' .` で漏れを確認する運用とし、`src/lib/dataClient.js` の module init validation がランタイムで実ファイル名との整合を検証する fail-loud 挙動を維持する (ADR-003 参照)。

## References

- CLAUDE.md (ファイル名 regex 同期義務)
- ADR-003: ビルドパイプラインの直列連結順序
