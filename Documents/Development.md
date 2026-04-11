# 開発手順

本リポジトリの開発・ビルドに関するドキュメントです。プロジェクトの概要・データ形式・キーボード操作などのユーザー向け情報は [`README.md`](../README.md) を参照してください。デプロイ手順は [`Documents/Deployment.md`](Deployment.md) を参照してください。

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
