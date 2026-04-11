# Project Conventions — italyshadowing

このファイルはコーディング上の約束事をまとめたものです。機能仕様・セットアップ
手順・ビルド方法は `README.md` / `Plan.md` / `Architecture.md` を参照してくだ
さい。ここにはそれらを読んでも分からない「書き方のルール」だけを載せます。

## `.vue` テンプレート内の式は短い参照だけに留める

`<template>` 内に JS 式を直書きすると構文ミスのリスクが高く、lint で拾えない
論理バグも混入しやすいです。本プロジェクトでは次の方針を守ります。

### `computed` 第一主義

表示条件・派生値は **`computed()` を第一候補** とします。関数 (`function`) は
引数が必要、キャッシュ不要、あるいは副作用を伴う場合にのみ使用します。

### `<script setup>` 側へ出すべきケース

- 条件式が 1 行で収まらない
- 同じ条件を 2 箇所以上で使う
- `&&` / `||` が 2 個以上重なる、または三項演算子が入る
- 算術計算や文字列生成が含まれる (例: `{{ effectivePage + 1 }} / {{ lines.length }}`)
- 名前を付けた方が意図が明確になる

### テンプレートに直書きしてよいケース

- 単一の ref / prop / 属性への参照 (`v-if="error"`, `{{ lesson.title }}`)
- 単一の短い比較 (`:active="i === selectedIndex"`)
- 1〜2 個の ref を補間した短い文字列 (`{{ lesson.title }}`)

### Before / After

悪い例:

```vue
<p v-if="!error && !isLoading && lessons.length > 0" class="home-hint">
  ↑ ↓ で選択 / Enter で開く
</p>
```

良い例:

```vue
<script setup>
const showHint = computed(
  () => !error.value && !isLoading.value && lessons.value.length > 0,
)
</script>

<template>
  <p v-if="showHint" class="home-hint">
    ↑ ↓ で選択 / Enter で開く
  </p>
</template>
```

### 命名規則

`computed` には「その値が何を意味するか」を表す名前を付けます。実装内容を
名前に漏らさないでください。

- 可視性トグル: `showHint`, `showProgress`
- 状態述語: `hasLessons`, `isEmptyState`, `isLoading`, `isEmptyLesson`
- アクションゲート: `canOpenSelected`
- 派生文字列: `progressLabel`

避けるべき名前: `xyzCheck`, `shouldXxx`, `errorAndLoadingAndEmpty` のように
条件式がそのまま名前に出ているもの。

### イベントハンドラで複文を書かない

`@click="a = i; openB()"` のような 2 文インラインはスメルです。`<script setup>`
側に 1 つのメソッドとして抽出してください。

```vue
<!-- 悪い例 -->
<v-list-item @click="selectedIndex = i; openSelected()" />

<!-- 良い例 -->
<script setup>
function selectAndOpen(index) {
  selectedIndex.value = index
  openSelected()
}
</script>

<template>
  <v-list-item @click="selectAndOpen(i)" />
</template>
```

### `class` と表示条件の分離

CSS クラスは見た目や意味 (semantic) のために付けるものです。条件ロジックを
`<script setup>` へ出す目的だけで空の `class` を増やす必要はありません。
`v-if="showHint"` だけで十分で、`class="conditional-show"` のような実装由来
のクラス名は不要です。

## `KeyboardEvent.key` は `src/lib/keys.js` の定数で参照する

`event.key === ' '` や `event.key === 'ArrowUp'` のような文字列リテラル直書きは
可読性が低く、全角スペース・NBSP などの不可視文字混入を lint で拾えません。
`src/lib/keys.js` で定義した定数を import して使ってください。

```js
import { KEY_SPACE, KEY_ARROW_RIGHT } from '../lib/keys.js'

switch (event.key) {
  case KEY_ARROW_RIGHT:
  case KEY_SPACE:
    ...
}
```

定数値は W3C UI Events KeyboardEvent key Values ([仕様](https://www.w3.org/TR/uievents-key/)) に従います。新しいキーを参照する必要が出たら、同じファイルに `KEY_*` 形式で追加し、`export` 行の近くに出典 URL コメントを付けてください。

### なぜ TypeScript 型定義パッケージを使わないか

types-only の npm モジュールがあれば候補に挙がりますが、現時点で純粋な types-only として W3C キー値を提供するパッケージは見当たりません (`ts-key-enum` は TypeScript enum を runtime JS に展開するため条件を満たしません)。また本プロジェクトは JavaScript のみで構成され TypeScript コンパイラが build パイプラインにないため、仮に types-only パッケージを入れても型チェックが走らず実益がありません。そのためローカル定数で運用しています。

## 教材ファイル名の正規表現は 4 箇所で同期する

教材ファイル名の制約 `^[A-Za-z0-9_-]+$` は、共有モジュール化せず 4 箇所に
コピーで置かれています。パターンを変更するときは **同じコミット内で全 4 箇所
を必ず更新** してください。

- `src/router/index.js` — reader ルートの `FILENAME_PATTERN` 定数
- `src/lib/dataClient.js` — `encodeLessonFilename()` 内のバリデーション
- `scripts/generate-index.mjs` — `FILENAME_PATTERN` 定数
- `README.md` — 「教材ファイル名の制約」セクション (ユーザー向けドキュメント)

## 色指定は Vuetify テーマ変数を経由する

`<style scoped>` 内で色を指定するときは、ハードコード (`#000`, `rgba(0,0,0,.6)`)
ではなく Vuetify のテーマ変数を使います。ダークモード前提なので、固定色を
書くと背景と衝突する可能性があります。

```css
/* 悪い例 */
color: rgba(0, 0, 0, 0.6);

/* 良い例 */
color: rgba(var(--v-theme-on-background), 0.6);
color: rgb(var(--v-theme-error));
```

利用可能な主要変数: `--v-theme-background`, `--v-theme-on-background`,
`--v-theme-surface`, `--v-theme-on-surface`, `--v-theme-error`。

## URL とデータパスは常に `import.meta.env.BASE_URL` 起点で組み立てる

GitHub Pages のサブパス (`/italyshadowing/`) 配備のため、`/data/...` や
`/...` をリテラルで書くと dev では通っても prod で 404 になります。`fetch` や
router 周辺では必ず `import.meta.env.BASE_URL` を前置してください。
既存の実装は `src/lib/dataClient.js` の `dataUrl()` を参考にしてください。

## ビルドパイプラインの順序は変えない

`npm run build` は `generate-index → lint-fix → vite build` を `&&` で直列に
繋いでいます。この順序には意味があります (lint エラーが残っていれば
`vite build` に進まず中断する、など)。`package.json` の `build` スクリプトを
書き換えるときは `README.md` の「ビルド時の前処理」と整合するかを確認して
ください。
