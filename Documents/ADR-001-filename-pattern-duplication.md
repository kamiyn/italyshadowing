# ADR-001: 教材ファイル名正規表現の重複管理

## Status

Accepted (2025-Q1 制定 / 2026-04 dataClient inline 化に伴い改定 / 同月 build-time 検証復活で再改定)

## Context

教材ファイル名の制約 `^[A-Za-z0-9_-]+$` は、ランタイム・ビルドスクリプト・ユーザー向けドキュメントの計 4 箇所で参照される。

- `src/router/index.js` — reader ルートの `FILENAME_PATTERN` 定数
- `src/lib/dataClient.js` — `FILENAME_PATTERN` 定数 (`encodeLessonFilename()` 入力検証 + module init での **defense-in-depth** 検証で再利用)
- `scripts/validate-lessons.mjs` — `FILENAME_PATTERN` 定数 (`npm run build` 最初のステップで走る **build-time fail-loud** 検証)
- `README.md` 「教材ファイル名の制約」セクション — ユーザー向けドキュメント

これらを共有モジュールに切り出すべきかを検討した。

> **改定経緯 (時系列)**:
> 1. **初版**: `scripts/generate-index.mjs` を含む 4 箇所重複。`generate-index` が `data/index.json` を生成する際に filename 検証も行う構成だった
> 2. **PR #12 (dataClient inline 化)**: `data/*.json` を Vite の `import.meta.glob` で JS バンドルへ inline する方針に切替 (iPhone Safari の `data/*.json` キャッシュ問題回避)。`generate-index.mjs` 撤廃に伴い検証を `src/lib/dataClient.js` の module init に統合し sync 対象を 3 箇所に縮小したが、**`vite build` はクライアント JS を実行しないため build-time の fail-loud が消失する regression** を含んでいた
> 3. **PR #12 follow-up**: 上記 regression をレビュー指摘で発見。`scripts/validate-lessons.mjs` (検証専用 Node スクリプト) として build-time 検証を復活させ、sync 対象を **再び 4 箇所** に戻した。`dataClient.js` の module init 検証は **defense in depth** として並走させる

## Decision

共有モジュールを作らず、4 箇所にコピーで置く。変更時の同期義務を CLAUDE.md と本 ADR で担保する。

## Rationale

- `src/router` と `src/lib/dataClient` は Vite バンドラ経由、`scripts/validate-lessons.mjs` は bundler を通さない Node 実行、`README.md` は Markdown。それぞれ異なる読み込み経路で、共通モジュールを跨って import するとビルド構成が複雑化する。
- 正規表現は 1 行の定数で、変更頻度が極めて低い。
- **build-time fail-loud は `scripts/validate-lessons.mjs` が担う**: Node script として `npm run build` の最初に確実に実行され、違反で非ゼロ終了して `&&` chain で後続をブロックする。CI / GitHub Pages デプロイは validation を経由してから走るため、不正ファイル名を含むデプロイは構造的に不可能。
- **dataClient.js の module init 検証は defense in depth**: validate-lessons を経由しない `vite dev` 直接起動や、バンドルが何らかの経路で browser に落ちた場合の最終防御。Node 側 (build) と browser 側 (runtime) で同じ regex を独立評価することで、片方が抜けても他方で検出できる。
- 重複によるリスクは「変更時に 1 箇所を更新し忘れる」ことだが、ランタイム 2 箇所 + ビルドスクリプト 1 箇所 + ドキュメント 1 箇所はいずれも `FILENAME_PATTERN` / `^[A-Za-z0-9_-]+$` で grep すれば一括特定できる。

## Consequences

- Pros: ビルド設定がシンプル、各ファイルが自己完結、複数モジュール系 (Vite bundle / plain Node / Markdown) を跨がない。CI 段階で必ず fail-loud (browser 実行を待たない)。
- Cons: regex を変更する際は 4 箇所すべてを同一コミットで更新する必要がある。
- 対策: regex 変更時は `grep -r 'A-Za-z0-9_-' .` で漏れを確認する運用とし、`scripts/validate-lessons.mjs` がビルド時に実ファイル名との整合を検証する fail-loud 挙動を維持する (ADR-003 参照)。

## References

- CLAUDE.md (ファイル名 regex 同期義務)
- ADR-003: ビルドパイプラインの直列連結順序
