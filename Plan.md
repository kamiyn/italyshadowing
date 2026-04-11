外国語学習で、シャドーイングをするにあたり 画面上に1行表示しページ送りをすることで
学習支援するアプリケーションを作成したい

skit2026spring.json のような string 配列 JSONファイルを参照し
1行(配列に含まれる 1string 要素) を1ページとして表示する Vue アプリを作成

このデータ string はHTMLとして出力してください。<b>などで文字を就職することがあります。
CSS style については .vue ファイル内で記述します

- JSON ファイルは data/ フォルダに置く
  - ビルド時にフォルダを走査して ファイル名一覧を取得 data/index.json のファイル名一覧を更新するのが良いと思われる
  - data/index.json はリポジトリに含んでよい
- URL 構成
  - http://<host>/ にアクセスした時には ファイル名一覧 とタイトルが出る
  - http://<host>/<filename> にアクセスした時には 対象JSONの1行目が出る
  - http://<host>/<filename>?page=<page> にアクセスした時には 対象JSONの <page> 行目が出る
- キーボード操作
  - カーソル 左 で前のページに戻る
  - カーソル 右 または で次のページに進む
  - (トップページ以外) カーソル 上 でトップページに遷移
  - トップページ では カーソル 上/下 でファイルを選択し Enter でそのページに遷移
- ファイル構成
  - トップページと <filename> を参照するページは Vue 的には 別の コンポーネントファイルとして分離
  - i18n 対応は不要です
- ビルドとデプロイ
  - Vite Rolldown でのビルドが望ましい https://v7.vite.dev/guide/rolldown
  - static website として generate する
  - GitHub Pages としてデプロイする
  - GitHub Actions のワークフローを リポジトリ内に含む
- デザイン には Vuetify https://vuetifyjs.com/ を利用する
- 単機能アプリであるため Nuxt は使わない
