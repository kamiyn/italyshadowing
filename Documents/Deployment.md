# GitHub Pages へのデプロイ

本リポジトリの `.github/workflows/deploy.yml` は、`actions/upload-pages-artifact` と `actions/deploy-pages` を使ったカスタムワークフローでデプロイを行います。GitHub の公式ガイドは [カスタムワークフローでの GitHub Pages の使用](https://docs.github.com/ja/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) を参照してください。

開発・ビルドに関するドキュメントは [`Documents/Development.md`](Development.md) を参照してください。

## 初回セットアップ (リポジトリ設定)

GitHub Pages の配信元をカスタムワークフローに切り替えるため、次の一度だけの設定が必要です。

1. `https://github.com/<user>/<repository>/settings/pages` を開きます
2. 「Build and deployment」セクションの「Source」で **`GitHub Actions`** を選択します (デフォルトの `Deploy from a branch` では本ワークフローが動きません)
3. 保存操作は不要です (選択した時点で反映されます)

ワークフロー側では既に `permissions: { pages: write, id-token: write }` を宣言しているため、リポジトリ全体の Actions 権限を変更する必要はありません。もし「Settings → Actions → General → Workflow permissions」が `Read repository contents permission` のままでも問題ありません (ワークフロー側の `permissions` ブロックが優先されます)。

## 通常の自動デプロイ

`main` ブランチへの push が走ると、GitHub Actions が自動で次を実行します。

1. `npm ci`
2. `npm run build` (`lint-fix → vite build`。教材 JSON は `import.meta.glob` により JS バンドルへ inline されます)
3. `dist/` を Pages アーティファクトとしてアップロード
4. `github-pages` 環境へデプロイ

成功後、`https://<user>.github.io/<repository>/` (本リポジトリの場合 `https://<user>.github.io/italyshadowing/`) で公開されます。

## ブランチ状態での手動デプロイ (main にマージする前に試す)

`main` にマージする前に、作業ブランチの内容をそのまま Pages で動作確認したい場合は、`workflow_dispatch` を使った手動起動が使えます (`deploy.yml` は `on: workflow_dispatch` を宣言済みです)。

**GitHub Web UI から起動する場合:**

1. `https://github.com/<user>/<repository>/actions` を開きます
2. 左サイドバーから `Build and Deploy` ワークフローを選択します
3. 右上の **`Run workflow`** ドロップダウンを開きます
4. `Branch` プルダウンで対象の作業ブランチを選択します
5. `Run workflow` ボタンで実行します

**`gh` CLI から起動する場合:**

```sh
gh workflow run deploy.yml --ref <branch-name>
```

手動起動の注意点:

- `workflow_dispatch` の `Run workflow` ドロップダウンに目的のワークフローが現れるのは、ワークフローファイル自体がデフォルトブランチ (通常 `main`) にも存在する場合です。最初の `deploy.yml` 追加コミットは先に `main` に入れておく (最小構成で merge しておく) と、以後の作業ブランチからも起動できるようになります
- `main` 以外のブランチから実行した場合でも、デプロイ先は同じ GitHub Pages サイトです。作業ブランチ由来のビルドで一時的に上書きされるため、検証後は `main` を再デプロイして元に戻すか、別リポジトリ/別環境で検証することを推奨します
- `concurrency: { group: pages, cancel-in-progress: false }` を設定しているため、直前のデプロイが実行中の場合は完走を待ってから次が走ります (公式 GitHub Pages starter workflow に準拠)。本番デプロイが途中で殺されて Pages が中途半端な状態で固まる事故を防ぐための設定です。連続起動した場合、in-progress と最新キュー以外の中間 run はスキップされます
