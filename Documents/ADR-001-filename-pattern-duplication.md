# ADR-001: 教材ファイル名正規表現の重複管理

## Status

Accepted

## Context

教材ファイル名の制約 `^[A-Za-z0-9_-]+$` は、ランタイム・ビルドスクリプト・ユーザー向けドキュメントの計 4 箇所で参照される。

- `src/router/index.js` — reader ルートの `FILENAME_PATTERN` 定数
- `src/lib/dataClient.js` — `encodeLessonFilename()` 内のバリデーション
- `scripts/generate-index.mjs` — `FILENAME_PATTERN` 定数
- `README.md` 「教材ファイル名の制約」セクション — ユーザー向けドキュメント

これらを共有モジュールに切り出すべきかを検討した。

## Decision

共有モジュールを作らず、4 箇所にコピーで置く。変更時の同期義務を CLAUDE.md と本 ADR で担保する。

## Rationale

- `src/router` と `src/lib/dataClient` は Vite バンドラ経由、`scripts/generate-index.mjs` は bundler を通さない Node 実行、`README.md` は Markdown。それぞれ異なる読み込み経路で、共通モジュールを跨って import するとビルド構成が複雑化する。
- 正規表現は 1 行の定数で、変更頻度が極めて低い。
- generate-index 側は呼び出し時点で不一致を検知できる (fail loud、ADR-003 参照)。
- 重複によるリスクは「変更時に 1 箇所を更新し忘れる」ことだが、ランタイム 3 箇所 + ドキュメント 1 箇所はいずれも `FILENAME_PATTERN` / `^[A-Za-z0-9_-]+$` で grep すれば一括特定できる。

## Consequences

- Pros: ビルド設定がシンプル、各ファイルが自己完結、複数モジュール系 (Vite bundle / plain Node / Markdown) を跨がない。
- Cons: regex を変更する際は 4 箇所すべてを同一コミットで更新する必要がある。
- 対策: regex 変更時は `grep -r 'A-Za-z0-9_-' .` で漏れを確認する運用とし、`scripts/generate-index.mjs` がビルド時に実ファイル名との整合を検証する fail-loud 挙動を維持する (ADR-003 参照)。

## References

- CLAUDE.md (ファイル名 regex 同期義務)
- ADR-003: ビルドパイプラインの直列連結順序
