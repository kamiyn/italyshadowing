# ADR-003: ビルドパイプラインを npm `&&` チェーンで直列化する

## Status

Accepted (2025-Q1 制定 / 2026-04 dataClient inline 化に伴い 3 ステップ → 2 ステップに改定)

## Context

本リポジトリのビルドは次の 2 ステップからなる。

1. `lint-fix` — ESLint による自動修正とフォーマット
2. `vite build` — rolldown-vite による本ビルド (data/*.json は `import.meta.glob` で JS バンドルへ inline される)

各ステップの起動方法について次の選択肢を検討した。

> **改定経緯**: 旧版は `generate-index → lint-fix → vite build` の 3 ステップだった。`generate-index` は `data/index.json` を生成する Node スクリプトで、ADR-001 の教材ファイル名バリデーションも担っていた。後続改定で `data/*.json` を Vite の `import.meta.glob` で JS バンドルへ inline する方針に切り替えたため、`scripts/generate-index.mjs` と `data/index.json` を撤廃。教材ファイル名の fail-loud 検証は `src/lib/dataClient.js` の module init に移管した (ADR-001 参照)。これに伴い build pipeline は 2 ステップに簡略化された。

## Options

1. `package.json` の `build` スクリプトを `&&` で直列連結
2. npm の `prebuild` フック (暗黙呼び出し)
3. Vite プラグインの lifecycle hook にビルド前処理を吸収させる

## Decision

`package.json` の `build` スクリプトに直列連結を書く。

```json
"build": "npm run lint-fix && vite build"
```

## Rationale

- **順序の明示性**: 2 ステップの順序がスクリプト文面から一目で読める。`prebuild` フックは暗黙実行になるため、どの順でどのステップが走るかが `package.json` を横に読まないと分からない。
- **中断挙動が自然**: `&&` は先行コマンドが非ゼロ終了なら後続を実行しないため、`lint-fix` が未修正エラーで落ちた時点で `vite build` に進まず中断する、という仕様要件 (`Development.md` 「ビルド時の前処理」) を追加コードなしで満たす。
- **fail-loud は dataClient に統合済み**: ADR-001 の教材ファイル名バリデーションは旧 `generate-index.mjs` から `src/lib/dataClient.js` の module init validation に移管された。`vite build` の中で `import.meta.glob` 経由でファイル名が dataClient のチェックを通り、不一致なら throw → CI / dev 起動が落ちる。pipeline を独立した検証ステップに分割する必要は無い。
- **Vite プラグイン不採用理由**: `lint-fix` を build 前に走らせる性質上、Vite の lifecycle フック内ではなく build プロセスの外側で直列化する必要がある。

## Consequences

- Pros: 順序が明示的、abort 挙動が自然、npm 標準機能のみで完結、ローカル実行と CI の挙動が一致。
- Cons: `&&` はシェル依存の形式。現時点では GitHub Actions (Ubuntu) とローカル (Linux/macOS/WSL) の双方で動作確認済み。Windows cmd.exe でも `&&` は有効だが、クロスプラットフォーム化時は留意が必要。
- 変更時の注意: ステップを追加・並べ替える際は [`Development.md`](Development.md) 「ビルド時の前処理」セクションと整合させる。

## References

- [`Development.md`](Development.md) 「ビルド時の前処理」 (旧 `README.md` から移動。PR #9 で再配置)
- `package.json` `scripts.build`
- `.github/workflows/deploy.yml` build job
- ADR-001: 教材ファイル名正規表現の重複管理 (fail-loud 検証が dataClient module init に移管された経緯)
