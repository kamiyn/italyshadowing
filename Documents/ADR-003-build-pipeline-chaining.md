# ADR-003: ビルドパイプラインを npm `&&` チェーンで直列化する

## Status

Accepted (2025-Q1 制定 / 2026-04 dataClient inline 化に伴い 3 → 2 ステップに改定 / 同月 build-time 検証復活で再び 3 ステップに戻す)

## Context

本リポジトリのビルドは次の 3 ステップからなる。

1. `validate-lessons` — `scripts/validate-lessons.mjs` が `data/` を走査し、各教材 JSON のファイル名 (ADR-001 の regex) と JSON 構造を検証する
2. `lint-fix` — ESLint による自動修正とフォーマット
3. `vite build` — rolldown-vite による本ビルド (`data/*.json` は `import.meta.glob` で JS バンドルへ inline される)

各ステップの起動方法について次の選択肢を検討した。

> **改定経緯 (時系列)**:
> 1. **初版**: `generate-index → lint-fix → vite build` の 3 ステップ。`generate-index` は `data/index.json` 生成 + ADR-001 の filename 検証 (fail-loud) を兼ねていた
> 2. **PR #12 (dataClient inline 化)**: `data/*.json` を `import.meta.glob` で JS バンドルへ inline する方針に切替したため `scripts/generate-index.mjs` を撤廃。pipeline を `lint-fix && vite build` の 2 ステップに簡略化し、filename 検証は `src/lib/dataClient.js` の module init に移管した
> 3. **PR #12 follow-up**: 上記 (2) は **`vite build` がクライアント JS を実行しないため build-time の fail-loud が消失する** regression を含んでいた。レビュー指摘により `scripts/validate-lessons.mjs` (検証専用 Node スクリプト、`data/index.json` の生成は伴わない) を新規追加し、pipeline を **再び 3 ステップ** に戻した

## Options

1. `package.json` の `build` スクリプトを `&&` で直列連結
2. npm の `prebuild` フック (暗黙呼び出し)
3. Vite プラグインの lifecycle hook にビルド前処理を吸収させる

## Decision

`package.json` の `build` スクリプトに直列連結を書く。

```json
"build": "npm run validate-lessons && npm run lint-fix && vite build"
```

## Rationale

- **順序の明示性**: 3 ステップの順序がスクリプト文面から一目で読める。`prebuild` フックは暗黙実行になるため、どの順でどのステップが走るかが `package.json` を横に読まないと分からない。
- **中断挙動が自然**: `&&` は先行コマンドが非ゼロ終了なら後続を実行しないため、`validate-lessons` が違反を検出した時点で `lint-fix` / `vite build` に進まず中断する、という仕様要件 (`Development.md` 「ビルド時の前処理」) を追加コードなしで満たす。
- **validate-lessons は build-time fail-loud の正本**: `import.meta.glob` で inline 化された後も filename / JSON 構造の検証は **CI 段階で必ず止める** 必要があり、Node script として独立ステップにするのが最も確実。`vite build` 内で client bundle が browser で実行されるのを待つ仕様 (= `dataClient.js` の module init 検証だけに依存) では、CI が成功してデプロイ後の本番 page load 時にだけクラッシュする regression が起きる。これを避けるため、**ビルド時検証は client runtime とは別の Node プロセスで走らせる**。
- **dataClient.js の module init 検証は defense in depth**: validate-lessons を経由しない `vite dev` 直接起動や、何らかの経路でバンドルが browser に落ちた場合の最終防御として並走する (詳細は ADR-001)。
- **Vite プラグイン (例: `buildStart` hook で検証) 不採用理由**: `validate-lessons` をあえて Vite plugin の lifecycle hook に押し込まず独立 step にすることで、エラー出力が `vite build` の冗長なバナーに埋もれず、`lint-fix` などの隣接ステップとの順序が明示される (本 ADR 元来の「順序の明示性」と一致)。`lint-fix` 自体も Vite 外で走らせる必要があり、検証を build プロセスの外側に統一するのが整合的。

## Consequences

- Pros: 順序が明示的、abort 挙動が自然、npm 標準機能のみで完結、ローカル実行と CI の挙動が一致。CI 段階で必ず fail-loud (browser 実行を待たない)。
- Cons: `&&` はシェル依存の形式。現時点では GitHub Actions (Ubuntu) とローカル (Linux/macOS/WSL) の双方で動作確認済み。Windows cmd.exe でも `&&` は有効だが、クロスプラットフォーム化時は留意が必要。
- 変更時の注意: ステップを追加・並べ替える際は [`Development.md`](Development.md) 「ビルド時の前処理」セクションと整合させる。

## References

- [`Development.md`](Development.md) 「ビルド時の前処理」 (旧 `README.md` から移動。PR #9 で再配置)
- `package.json` `scripts.build`
- `scripts/validate-lessons.mjs` build-time validator
- `.github/workflows/deploy.yml` build job
- ADR-001: 教材ファイル名正規表現の重複管理 (validate-lessons.mjs を含む 4 箇所重複の決定根拠)
