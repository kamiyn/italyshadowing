# Italy Shadowing

外国語のシャドーイング学習を支援する、シンプルな Vue ベースの静的 Web アプリケーションです。教材 JSON の各行を 1 ページずつ表示し、キーボードだけで前後の行へ移動できます。

## できること

- `data/` 配下の JSON 教材を一覧表示する
- 教材の 1 行を 1 ページとして表示する
- `?page=` クエリで任意ページを直接開く
- キーボードだけで一覧選択、ページ送り、トップ遷移を行う
- 教材文字列を HTML として描画する

## データ形式

教材ファイルは `data/` 配下に配置する JSON 配列です。各要素が 1 ページとして表示されます。

```json
[
  "l Celebriamo la Giornata europea delle lingue con qualche curiosita linguistica.",
  "Inizia tu, Carmen!",
  "<b>Vediamo...</b> In Europa ci sono circa duecentoventicinque lingue autoctone."
]
```

- 配列の 1 要素が 1 画面に対応します
- 文字列は HTML として出力されます
- 教材ファイルの一覧は `data/index.json` で管理します

## URL 仕様

- `/` : 教材一覧ページ
- `/<filename>` : 対象教材の先頭ページ
- `/<filename>?page=<page>` : 対象教材の指定ページ

`page` は配列要素の位置に対応するページ番号です。実装時には不正な値を補正して範囲内に収める想定です。

## キーボード操作

- `ArrowUp`
  - トップページでは一覧の選択を 1 つ上へ移動
  - 教材ページではトップページへ戻る
- `ArrowDown`
  - トップページで一覧の選択を 1 つ下へ移動
- `Enter`
  - トップページで選択中の教材を開く
- `ArrowLeft`
  - 教材ページで前のページへ移動
- `ArrowRight`
  - 教材ページで次のページへ移動

## 想定技術構成

- Vue
- Vuetify
- Vite Rolldown
- GitHub Pages
- GitHub Actions

Nuxt は使わず、単機能の静的サイトとして構成します。

## 関連ドキュメント

- 要件: `Plan.md`
- 内部設計: `Architecture.md`
