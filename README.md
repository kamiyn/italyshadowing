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
- `data/*.json` は Vite の `import.meta.glob` でビルド時に JS バンドルへ取り込まれます。教材ファイルを追加・編集・削除した後は `npm run build` を再実行するだけで反映されます (一覧用の `index.json` は不要です)

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

この制約は次の 3 箇所で運用上の前提となっています。

- `src/router/index.js` のルート定義 (`/:filename([A-Za-z0-9_-]+)`) が、URL パスからこのパターンに一致しない文字列を受け付けない。合致しない URL は catch-all ルートでトップページへリダイレクトされる。これにより `%2F` などのデコード結果や予期しない文字列が `fetchLesson()` に到達する経路を遮断する。
- `scripts/validate-lessons.mjs` (`npm run build` の最初のステップ) が `data/` 配下の教材ファイル名・JSON 構造 (`title` / `description` / `lines` の型) を fail-loud 検証する。違反があれば即座に非ゼロ終了して `lint-fix` / `vite build` に進まない。これにより不正な教材ファイルを含む commit は CI / ローカル build の段階で必ず検出される。
- `src/lib/dataClient.js` がアプリ起動時にも同じ regex 検証を行い、validate-lessons を経由しない `vite dev` 直接起動や、何らかの経路でバンドルが browser にロードされた場合の defense in depth として動作する。

## 教材で使える HTML 要素

`lines` 内の文字列は v-html で描画されます。技術的にはほぼ任意の HTML が書けますが、教材表現として推奨し、`ReaderText` コンポーネント側でスタイルを定義しているのは次の要素です。

| 要素 | 用途 | スタイル定義箇所 |
|------|------|------------------|
| `<b>` | 太字での強調 | `src/components/ReaderText.vue` の `.reader-text :deep(b)` |
| `<u>` | 下線での強調 | `src/components/ReaderText.vue` の `.reader-text :deep(u)` |

例:

```json
{
  "lines": [
    "<b>Vediamo...</b> In Europa ci sono circa duecentoventicinque lingue autoctone.",
    "Il <u>basco</u> è la lingua indigena più antica d'Europa."
  ]
}
```

新しい装飾要素を追加する場合は、`src/components/ReaderText.vue` の `<style scoped>` 内に `:deep()` セレクタを追記し、本表にも追加してください。

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
- `Escape`
  - 教材ページでトップページへ戻る (`ArrowUp` と同じ動作)
- タップ / クリック
  - 教材ページで本文や余白をタップすると次のページへ移動
  - ページ番号表示をタップするとトップページへ戻る

## iPhone Safari 表示

- 通常の iPhone Safari タブ表示では、Web ページ側から初期表示の時点でアドレスバーやツールバーを確実に隠すことはできません
- 教材ページ (`ReaderPage`) は `100dvh` を使って、ブラウザ UI の有無で表示が崩れにくいように調整しています
- より全画面に近い表示を期待する場合は、iPhone の「ホーム画面に追加」から起動してください
- ホーム画面追加後の standalone 表示では、Safari のアドレスバーなしに近い表示になりますが、通常タブ表示と完全に同一ではありません

## 関連ドキュメント

開発・運用に関するドキュメントは `Documents/` 配下に分離してあります。

- [`Documents/Architecture.md`](Documents/Architecture.md) — 現状の内部設計 (画面構成・データ設計・処理フロー・責務分割)
- [`Documents/Plan.md`](Documents/Plan.md) — 初期プランニングメモ (実装着手前の要件スケッチ。アーカイブ用途)
- [`Documents/mobile-pinch-font-scale.md`](Documents/mobile-pinch-font-scale.md) — モバイル向けピンチフォントサイズ調整の実装方針
- [`Documents/pwa-standalone.md`](Documents/pwa-standalone.md) — PWA standalone モードと iOS Safari 全画面表示の設計
- [`Documents/Development.md`](Documents/Development.md) — 開発手順 (技術構成・npm スクリプト・デバッグ起動・ビルド前処理)
- [`Documents/Deployment.md`](Documents/Deployment.md) — GitHub Pages デプロイ手順 (初回セットアップ・自動デプロイ・手動デプロイ)
- [`Documents/branch-protection.md`](Documents/branch-protection.md) — main ブランチ保護ルール (GitHub Rulesets)
- `Documents/ADR-*.md` — Architecture Decision Records (個別の実装判断と背景)
