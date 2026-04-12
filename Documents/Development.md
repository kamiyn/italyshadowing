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
- `data/*.json` は Vite の `import.meta.glob` を経由して JS バンドルへ取り込まれており、ファイルを編集すると Vite の HMR で自動的にアプリへ反映されます
- 新しい教材ファイルを追加・削除した場合も同様に HMR で反映されます (一覧用の `index.json` は不要で、`src/lib/dataClient.js` が動的に組み立てます)

## iPhone Safari に関する前提

- 通常の iPhone Safari タブ表示では、ページ遷移直後から Web 側だけでアドレスバー / ツールバーを確実に隠すことはできません
- `ReaderPage` で追加している `viewport-fit=cover` と `100dvh` は「表示崩れを減らす」「standalone 表示時に画面を広く使う」ための調整であり、通常タブ表示の Safari UI を消す機能ではありません
- Safari のブラウザ UI を抑えた表示を求める場合は、「ホーム画面に追加」からの standalone 起動を前提に検証してください
- iOS Safari の通常タブ表示と standalone 表示では viewport の効き方が異なるため、実機確認時は両方を分けて観察してください

## ビルド時の前処理

ビルドプロセスでは、Vite の本ビルドの前に次を実行します (ADR-003 参照)。

- `validate-lessons` を実行し、`data/` 配下の各教材 JSON のファイル名 (ADR-001 の regex) と JSON 構造 (`title` / `description` / `lines` の型) を検証する。違反があれば即座にビルド全体を停止する
- `lint-fix` を実行してソース整形と lint 修正を反映する
- `lint-fix` で解決できないエラーが残った場合は、その時点でビルドを停止する

その後に静的サイトを生成し、GitHub Pages へ配備します。教材 JSON は Vite が `import.meta.glob` で JS バンドルに焼き込むため `dist/data/` は生成されません (バンドルの content hash がそのままキャッシュバスティング機構として働きます)。
