# ADR-003: ビルドパイプラインを npm `&&` チェーンで直列化する

## Status

Accepted

## Context

本リポジトリのビルドは次の 3 ステップからなる。

1. `generate-index` — `data/` を走査し `data/index.json` を再生成する (ADR-001 の教材ファイル名バリデーションもここで走る)
2. `lint-fix` — ESLint による自動修正とフォーマット
3. `vite build` — rolldown-vite による本ビルド

各ステップの起動方法について次の選択肢を検討した。

## Options

1. `package.json` の `build` スクリプトを `&&` で直列連結
2. npm の `prebuild` フック (暗黙呼び出し)
3. Vite プラグインの lifecycle hook にビルド前処理を吸収させる

## Decision

`package.json` の `build` スクリプトに直列連結を書く。

```json
"build": "npm run generate-index && npm run lint-fix && vite build"
```

## Rationale

- **順序の明示性**: 3 ステップの順序がスクリプト文面から一目で読める。`prebuild` フックは暗黙実行になるため、どの順でどのステップが走るかが `package.json` を横に読まないと分からない。
- **中断挙動が自然**: `&&` は先行コマンドが非ゼロ終了なら後続を実行しないため、`lint-fix` が未修正エラーで落ちた時点で `vite build` に進まず中断する、という仕様要件 (`README.md` 「ビルド時の前処理」) を追加コードなしで満たす。
- **generate-index は fail-loud**: ADR-001 の教材ファイル名バリデーションで違反を検出したら非ゼロ終了する。これが `&&` で後段のビルドを即座に停止させる。
- **Vite プラグイン不採用理由**: `lint-fix` を build 前に走らせる性質上、Vite の lifecycle フック内ではなく build プロセスの外側で直列化する必要がある。

## Consequences

- Pros: 順序が明示的、abort 挙動が自然、npm 標準機能のみで完結、ローカル実行と CI の挙動が一致。
- Cons: `&&` はシェル依存の形式。現時点では GitHub Actions (Ubuntu) とローカル (Linux/macOS/WSL) の双方で動作確認済み。Windows cmd.exe でも `&&` は有効だが、クロスプラットフォーム化時は留意が必要。
- 変更時の注意: ステップを追加・並べ替える際は `README.md` 「ビルド時の前処理」セクションと整合させる。

## References

- `README.md` 「ビルド時の前処理」
- `package.json` `scripts.build`
- `.github/workflows/deploy.yml` build job
- ADR-001: 教材ファイル名正規表現の重複管理 (generate-index の fail-loud 挙動の前提)
