# ADR-004: 依存パッケージの定期更新フロー

## Status

Accepted

## Context

`npm` 管理下の依存パッケージ (Vue, Vuetify, ESLint, Vite 等) は頻繁に更新される。
これらを放置すると以下が発生する。

- 古い `package-lock.json` と新しい transitive 依存の不整合で `npm ci` が失敗する
  (実例: 2026-04 GitHub Actions で `esbuild@0.25.12` lock vs `esbuild@0.27.7` 要求の
  不一致により build が落ちた)
- セキュリティ脆弱性 (`npm audit` で検出される) が放置される
- ESLint / Vite の major bump で新しい言語機能 (例: `Object.groupBy` は Node 21+) が
  暗黙に要求され、CI Node のバージョン据え置きで突然落ちる
- 個別更新を後回しにし「まとめて全部上げる」になると、不具合の切り分けコストが急増する

## Decision

依存更新は以下の手順を踏む。**個別 PR で順次** 進めることを原則とし、不具合が出たときに
どのバンプが原因か切り分けやすくする。

### 1. 状況確認

```bash
npm outdated   # 更新候補を一覧
npm audit      # 既知脆弱性を確認
```

`npm outdated` の `Wanted` 列が `Current` と一致しないものは、`package.json` の
caret/tilde 範囲内に新しい patch/minor が出ている。`Latest` 列が異なるものは
major bump が出ている。

### 2. patch / minor 更新

範囲内の patch/minor は単に lock を更新するだけで取り込める。

```bash
npm update              # caret 範囲内で全部上げる
npm ci                  # lock と node_modules の整合性確認
npm run build           # ビルドが通ることを確認
```

### 3. major 更新

major bump はパッケージごとに 1 つずつ進める。

```bash
npm install <pkg>@latest          # devDep の場合は -D を付ける
npm run build                     # 影響範囲を確認
git add package.json package-lock.json
git commit -m "deps: bump <pkg> to vX"
```

複数パッケージが peer dependency で連動している場合 (例:
`eslint-plugin-vue` と `vue-eslint-parser` は同時に major を揃える必要がある) は
package.json を手で書き換えてから

```bash
rm -rf node_modules package-lock.json
npm install
```

で一括解決する。

### 4. Node 本体の更新

Node の minor / major は半年〜1年周期で見直す。新しい LTS が出たタイミングで
**`.nvmrc`** と **`package.json` の `engines.node`** を同時に更新する。両者が
ずれると、ローカルでは動くのに CI で `EBADENGINE` 警告が出るような事故が起こる。

GitHub Actions の `actions/checkout` / `actions/setup-node` 自体も Node ランタイムを
内包しているため、 Node のメジャー deprecation アナウンス (例:
`Node.js 20 actions are deprecated`) が出たら **actions のメジャーバンプ** で対応する。
`actions/checkout@v5` 以降は Node 24 ランタイムを使う。

### 5. ESLint flat-config-utils と Node の組み合わせ

`@nuxt/eslint-config` / `eslint-flat-config-utils` 系は新しい Node API
(`Object.groupBy`, `Array.fromAsync` 等) を前提にしている。CI Node を据え置きで
ESLint だけバンプすると `TypeError: Object.groupBy is not a function` が出る。
ESLint major を上げる際は **必ず Node の最低バージョンを再確認** する。

| ESLint API 群       | 必要 Node                |
|---------------------|--------------------------|
| `Object.groupBy`    | Node 21+ (LTS は 22 以降)|
| 推奨 LTS            | Node 22 / Node 24        |

### 6. CI での検証

更新は必ず CI で検証する。本リポジトリでは `githubActionsFix` 等のブランチに push し、
`gh workflow run deploy.yml --ref <branch>` で `workflow_dispatch` 起動して結果を見る。
`npm ci` が lock の不整合で落ちる典型ケースは、ローカル `npm install` で lock が
更新されていないことが原因なので、ローカルでも `rm -rf node_modules package-lock.json && npm install`
の後に `npm ci` を再実行して確認するとよい。

## Rationale

- **個別 PR 原則**: まとめてバンプすると失敗時の切り分けに時間がかかる。個別なら revert も簡単。
- **`.nvmrc` と `engines.node` 同期**: 片方だけ更新する事故を防ぐ。両方を SSOT
  にせず「ペアで触る」運用とする。
- **`npm outdated` を起点**: 「気付いたときに上げる」ではなく、定期的に
  outdated を眺める運用を明文化することで、lock drift を未然に防ぐ。
- **ESLint と Node の連動を明示**: 過去に踏んだ `Object.groupBy` 事故を ADR に残し、
  次回 ESLint バンプ時にチェックリストとして機能させる。

## Consequences

- Pros: 依存ドリフトが小さく保たれる。個別 PR 単位で原因切り分けが容易。
- Cons: 細かい PR が増えるため、レビュー負荷が分散する。
- 変更時の注意:
  - `package.json` の `engines.node` を上げるときは必ず `.nvmrc` も上げる。
  - GitHub Actions の `actions/setup-node` major を変えるときは `.nvmrc` の Node が
    その action の対応バージョン内かを確認する。
  - ESLint の major bump 後は必ず `npm run lint` をローカルで通してから push する。

## References

- `package.json` `engines.node`, `devDependencies`
- `.nvmrc`
- `.github/workflows/deploy.yml`
- ADR-003: ビルドパイプラインの直列化 (`lint-fix` の位置付け)
- 2026-04-11 incident: lock drift と Node 20 deprecation を同時に解消した PR
