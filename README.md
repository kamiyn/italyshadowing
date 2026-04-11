# Italy Shadowing

外国語のシャドーイング学習を支援する、シンプルな Vue ベースの静的 Web アプリケーションです。教材 JSON の各行を 1 ページずつ表示し、キーボードだけで前後の行へ移動できます。

## できること

- `data/` 配下の JSON 教材を一覧表示する
- 教材の `lines` 内の 1 行を 1 ページとして表示する
- `?page=` クエリで任意ページを直接開く
- キーボードだけで一覧選択、ページ送り、トップ遷移を行う
- 教材文字列を HTML として描画する
- `title` / `description` をトップページの一覧表示に利用する

## データ形式

教材ファイルは `data/` 配下に配置する JSON オブジェクトです。トップページ用のメタ情報と、本文表示用の行データを持ちます。

```json
{
  "title": "Skit 2026 Spring",
  "description": "sample",
  "lines": [
    "l Celebriamo la Giornata europea delle lingue con qualche curiosita linguistica.",
    "Inizia tu, Carmen!",
    "<b>Vediamo...</b> In Europa ci sono circa duecentoventicinque lingue autoctone."
  ]
}
```

- `title` と `description` はトップページの教材一覧表示に使います
- `lines` 配列の 1 要素が 1 画面に対応します
- シャドーイング中の画面では `title` / `description` を表示しません
- `lines` の文字列は HTML として出力されます
- HTML 描画を行うため、教材データはリポジトリ管理下の信頼済みデータに限定し、不特定の外部入力は受けません
- 教材ファイルの一覧は `data/index.json` で管理します

## URL 仕様

- `/` : 教材一覧ページ
- `/<filename>` : 対象教材の先頭ページ
- `/<filename>?page=<page>` : 対象教材の指定ページ

`page` は `lines` 配列の位置に対応するページ番号です。実装時には不正な値を補正して範囲内に収める想定です。

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
- ESLint
- GitHub Pages
- GitHub Actions

Nuxt は使わず、単機能の静的サイトとして構成します。

Lint の規約は Nuxt 4 の標準 ESLint ルールを、Nuxt アプリケーションではない本アプリにもコーディング規約として援用する想定です。

## 開発コマンド

`package.json` には少なくとも次の npm スクリプトを定義する想定です。

- `lint`
  - ESLint による静的検査を実行する
- `lint-fix`
  - ESLint による静的検査と自動修正、およびフォーマットを実行する

## ビルド時の前処理

ビルドプロセスでは、Vite の本ビルドの前に次を実行します。

- `data/` を走査して `data/index.json` を生成または更新する
- `lint-fix` を実行してソース整形と lint 修正を反映する
- `lint-fix` で解決できないエラーが残った場合は、その時点でビルドを停止する

その後に静的サイトを生成し、GitHub Pages へ配備します。

## 関連ドキュメント

- 要件: `Plan.md`
- 内部設計: `Architecture.md`
