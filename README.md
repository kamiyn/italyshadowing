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

### 教材ファイル名の制約

教材ファイル名 (拡張子 `.json` を除いた部分) は次のパターンに合致する必要があります。

- 使用可能な文字: 半角英大文字 (`A`-`Z`)、半角英小文字 (`a`-`z`)、半角数字 (`0`-`9`)、ハイフン (`-`)、アンダースコア (`_`)
- 1 文字以上 (空ファイル名不可)
- 正規表現で表すと `^[A-Za-z0-9_-]+$`

例:

| ファイル名 | 可否 | 備考 |
|------------|------|------|
| `skit2026spring.json` | ○ | 既定の教材 |
| `lesson-01.json` | ○ | ハイフン可 |
| `Italy_Beginner.json` | ○ | 大文字・アンダースコア可 |
| `skit 2026.json` | × | 半角スペースは不可 |
| `レッスン.json` | × | 全角文字は不可 |
| `lesson.v2.json` | × | ドット (拡張子以外) は不可 |

この制約は次の 2 箇所で運用上の前提となっています。

- `src/router/index.js` のルート定義 (`/:filename([A-Za-z0-9_-]+)`) が、URL パスからこのパターンに一致しない文字列を受け付けない
- 上記に合致しない URL は catch-all ルートでトップページへリダイレクトされる
- これにより `%2F` などのデコード結果や予期しない文字列が `fetchLesson()` に到達して URL を組み立てる経路を遮断する

## 教材で使える HTML 要素

`lines` 内の文字列は v-html で描画されます。技術的にはほぼ任意の HTML が書けますが、教材表現として推奨し、`ReaderPage.vue` 側でスタイルを定義しているのは次の要素です。

| 要素 | 用途 | スタイル定義箇所 |
|------|------|------------------|
| `<b>` | 太字での強調 | `src/pages/ReaderPage.vue` の `.reader-line :deep(b)` |
| `<u>` | 下線での強調 | `src/pages/ReaderPage.vue` の `.reader-line :deep(u)` |

例:

```json
{
  "lines": [
    "<b>Vediamo...</b> In Europa ci sono circa duecentoventicinque lingue autoctone.",
    "Il <u>basco</u> è la lingua indigena più antica d'Europa."
  ]
}
```

新しい装飾要素を追加する場合は、`ReaderPage.vue` の `<style scoped>` 内に `:deep()` セレクタを追記し、本表にも追加してください。

なお、教材データは信頼済みデータ前提で扱うため、`<script>` などの実行を伴う要素は教材ファイル側で記述しないでください。

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
- `ArrowRight` または `Space`
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

## デバッグ開始方法

リポジトリをクローンした直後の手順です。

```sh
npm install
npm run dev
```

- `npm install` で依存関係を取得します
- `npm run dev` で Vite Rolldown の開発サーバーが起動します
- 起動時にコンソールへ表示される URL (既定では `http://localhost:5173/italyshadowing/`) をブラウザで開くとアプリが表示されます
- 開発サーバーは `data/` 配下の教材 JSON をそのまま配信するため、教材ファイルを編集して保存すれば反映されます
- 新しい教材ファイルを追加した場合は `npm run generate-index` を一度実行して `data/index.json` を更新してください

## ビルド時の前処理

ビルドプロセスでは、Vite の本ビルドの前に次を実行します。

- `data/` を走査して `data/index.json` を生成または更新する
- `lint-fix` を実行してソース整形と lint 修正を反映する
- `lint-fix` で解決できないエラーが残った場合は、その時点でビルドを停止する

その後に静的サイトを生成し、GitHub Pages へ配備します。

## 関連ドキュメント

- 要件: `Plan.md`
- 内部設計: `Architecture.md`
