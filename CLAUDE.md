# Coding Conventions

本ファイルはアプリケーション仕様に依存しない一般コーディング規約をまとめたものです。プロジェクト固有の実装判断は `Documents/ADR-*.md` に分離しています。機能仕様・セットアップ手順は `README.md` / `Documents/Plan.md` / `Architecture.md` を参照してください。

## `.vue` テンプレート内の式は短い参照だけに留める

`<template>` 内に JS 式を直書きすると構文ミスのリスクが高く、lint で拾えない論理バグも混入しやすいです。

### `computed` 第一主義

表示条件・派生値は **`computed()` を第一候補** とします。関数 (`function`) は、引数が必要・キャッシュ不要・副作用を伴う場合にのみ使用します。

### `<script setup>` へ出すべきケース

- 条件式が 1 行で収まらない
- 同じ条件を 2 箇所以上で使う
- `&&` / `||` が 2 個以上重なる、または三項演算子が入る
- 算術計算や文字列生成が含まれる
- 名前を付けた方が意図が明確になる

### テンプレートに直書きしてよいケース

- 単一の ref / prop への参照 (`v-if="error"`, `{{ item.title }}`)
- 単一の短い比較 (`:active="i === selectedIndex"`)
- 1〜2 個の ref を補間した短い文字列

### Before / After

```vue
<!-- 避ける -->
<p v-if="!error && !isLoading && items.length > 0" class="hint">...</p>

<!-- 推奨 -->
<script setup>
const showHint = computed(
  () => !error.value && !isLoading.value && items.value.length > 0,
)
</script>
<template>
  <p v-if="showHint" class="hint">...</p>
</template>
```

### 命名規則

`computed` には「その値が何を意味するか」を表す名前を付けます。実装内容を名前に漏らさないでください。

- 可視性トグル: `showHint`, `showProgress`
- 状態述語: `hasItems`, `isEmptyState`, `isLoading`
- アクションゲート: `canOpenSelected`
- 派生文字列: `progressLabel`

避けるべき名前: `xyzCheck`, `shouldXxx`, `errorAndLoadingAndEmpty` のように条件式がそのまま名前に出ているもの。

### イベントハンドラに複文を書かない

```vue
<!-- 避ける -->
<li @click="selectedIndex = i; openSelected()" />

<!-- 推奨 -->
<script setup>
function selectAndOpen(index) {
  selectedIndex.value = index
  openSelected()
}
</script>
<template>
  <li @click="selectAndOpen(i)" />
</template>
```

### `class` を条件ロジックの出口にしない

CSS クラスは見た目や意味のために付けるものです。条件ロジックを `<script setup>` へ出す目的だけで空の `class` を増やす必要はありません。`v-if="showHint"` だけで十分で、`class="conditional-show"` のような実装由来のクラス名は不要です。

## `KeyboardEvent.key` は文字列リテラル直書きしない

`event.key === ' '` や `event.key === 'ArrowUp'` のような直書きは避け、プロジェクト内の定数モジュールから import して参照してください。全角スペース・NBSP 等の不可視文字混入は lint で拾えず、grep 性も悪くなります。本リポジトリでは `src/lib/keys.js` が該当モジュールです (詳細: `Documents/ADR-002-keyboard-key-local-constants.md`)。

```js
import { KEY_SPACE, KEY_ARROW_RIGHT } from '../lib/keys.js'

switch (event.key) {
  case KEY_ARROW_RIGHT:
  case KEY_SPACE:
    ...
}
```

## Vuetify の色指定はテーマ変数を経由する

`<style scoped>` 内で色を指定するときは、ハードコード (`#000`, `rgba(0,0,0,.6)`) ではなく Vuetify テーマ変数を使います。ダークモード / テーマ切り替え時に追従します。

```css
/* 避ける */
color: rgba(0, 0, 0, 0.6);

/* 推奨 */
color: rgba(var(--v-theme-on-background), 0.6);
color: rgb(var(--v-theme-error));
```

主要変数: `--v-theme-background`, `--v-theme-on-background`, `--v-theme-surface`, `--v-theme-on-surface`, `--v-theme-error`。

## サブパス配備の URL は `import.meta.env.BASE_URL` 起点で組み立てる

GitHub Pages のサブパス配備等では、`/data/...` や `/...` のリテラル指定は dev では通っても prod で 404 になります。`fetch` や router 周辺では必ず `import.meta.env.BASE_URL` を前置してください。本リポジトリの参照実装は `src/lib/dataClient.js` の `dataUrl()` です。

## Architecture Decision Records

アプリ固有の実装判断は以下の ADR に分離してあります。コードを変更する前に該当 ADR を確認してください (特に regex を 1 箇所変更するような場合)。

- `Documents/ADR-001-filename-pattern-duplication.md` — 教材ファイル名 regex `^[A-Za-z0-9_-]+$` を 4 箇所 (router / dataClient / generate-index / README) に重複管理する決定と**全箇所同時更新の義務**
- `Documents/ADR-002-keyboard-key-local-constants.md` — キー定数をローカル `src/lib/keys.js` に置く決定と、types-only パッケージ不採用の理由
- `Documents/ADR-003-build-pipeline-chaining.md` — `generate-index → lint-fix → vite build` を npm `&&` で直列化する決定と、`prebuild` フック / Vite プラグイン不採用の理由
- `Documents/ADR-004-dependency-update-workflow.md` — `npm outdated` を起点とした依存パッケージ定期更新フローと、`.nvmrc` / `engines.node` / Actions Node ランタイムの同期義務
- `Documents/ADR-005-localstorage-optional-persistence.md` — `localStorage` / `sessionStorage` 等のブラウザ永続化を best-effort なオプショナル動作として扱う方針と try/catch 義務
