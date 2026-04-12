# Reader タイポグラフィ調整ガイド

`src/components/ReaderText.vue` の `.reader-text` (シャドーイング教材本文 +
HomePage フォントサイズプレビュー) における
フォント・配色・装飾の設計根拠と、見え方の調整方法をまとめる。

このコンポーネントは ReaderPage 本文と HomePage プレビューで共通利用される
ことを前提に設計されており、両画面で同じ font-family / font-weight /
clamp 計算式 / 色を共有する。レイアウト差異の有無にかかわらず、
タイポグラフィそのものは同一である。

## 設計の前提

- 黒背景 (`#000000`) のダークテーマ
- 教材本文は非常に大きいフォントサイズ (`clamp(3rem, 8vw, 5.5rem)`) で 1 行表示
- 教材データ内の HTML 装飾:
  - `<b>` … アクセントを置く母音 (1 文字単位)
  - `<u>` … 句のまとまりを示すグルーピング線
- 長時間 (数十分〜) のシャドーイングセッションを想定するため、視覚疲労を最小化する

## フォント供給方法

Roboto Serif は `@fontsource-variable/roboto-serif` を `package.json` の依存に
追加し、`src/main.js` で

```js
import './assets/fonts/roboto-serif-latin.css'
```

としてインポートする。`roboto-serif-latin.css` は本リポジトリ内のカスタム CSS
で、`@fontsource-variable/roboto-serif/standard.css` の **latin subset の
`@font-face` ブロックだけを cherry-pick** したもの。Vite が `url()` を解決し、
`woff2` ファイルを `dist/assets/` にハッシュ付きでバンドルする。
**Google Fonts CDN への外部読み込みは行わない** ため、外部 CDN への依存を避けられる。
フォントファイルはアプリのビルド成果物に含まれるため、オフラインや閉域環境でも表示しやすい。

CSS の `font-family` は `'Roboto Serif Variable'` で参照する (`Variable` サフィックスは fontsource の慣例)。
ローカルにシステムインストールされた `Roboto Serif` を優先したい場合に備えて、
`'Roboto Serif Variable', 'Roboto Serif', serif` のように 2 段フォールバックする。

### 軸の選択 (`standard` 軸変種を使う理由)

`@fontsource-variable/roboto-serif` には軸セット別の CSS が用意されている:

| ファイル | 含む軸 | latin subset 単体ファイルサイズ |
|---|---|---|
| `wght.css` | wght (weight) | 66 KB |
| `opsz.css` | opsz (optical size) | 147 KB |
| **`standard.css`** | **wght + wdth + opsz** | **379 KB** |
| `full.css` | wght + wdth + opsz + grad | 574 KB |

`.reader-text` では `font-weight: 500/700` (wght) と `font-optical-sizing: auto`
(opsz) の両方を使うため、両軸を含む **standard 軸変種** が必要。`wdth` は使って
いないが標準セットに含まれるためそのまま受け入れる。

本リポジトリでは `standard.css` を直接 import せず、その latin block だけを
`src/assets/fonts/roboto-serif-latin.css` にコピーして使う運用にしている (理由は
次節)。

### subset の絞り込み (latin のみ)

`@fontsource-variable/roboto-serif/standard.css` を直接 import すると、
cyrillic / cyrillic-ext / vietnamese / latin-ext / latin の **5 subset 全ての
`@font-face` 宣言** が読み込まれる。各 `@font-face` は `unicode-range` で振り分けて
あるためブラウザは未使用 subset の `woff2` をダウンロードしないが、Vite はビルド
時に CSS の `url()` を走査して **参照されている `woff2` を全て `dist/` にコピー
する**。結果として `dist/assets/` に約 1 MB 分の使われない非 latin フォントが
残ってしまう。

本アプリの目的はイタリア語のシャドーイングであり、Italian の発音記号
(à è é ì í ò ó ù ú など、U+00E0-U+00FA) は **latin subset の `unicode-range`
`U+0000-00FF` に完全に含まれる**。cyrillic / latin-ext / vietnamese は表示に使われ
ない。

このため `src/assets/fonts/roboto-serif-latin.css` を以下の方針で作成している:

- パッケージ標準 `standard.css` の **latin ブロック (約 1 つの `@font-face`) だけ
  を cherry-pick** して写し取る
- `unicode-range` / weight / stretch / `font-display` 等は upstream と完全一致
  させる
- `woff2` への参照は bare specifier
  (`@fontsource-variable/roboto-serif/files/roboto-serif-latin-standard-normal.woff2`)
  で書く。Vite が package exports 経由で resolve し、`dist/assets/` にハッシュ付き
  でコピーする

これにより `dist/assets/` に出力される woff2 は latin の 1 ファイル (約 379 KB)
だけになる (削減量: 約 688 KB / 65%)。

**パッケージ更新時の注意**: `@fontsource-variable/roboto-serif` を更新した際は
上流の `standard.css` の latin block と
`src/assets/fonts/roboto-serif-latin.css` の差分を確認し、`unicode-range` 等が
変わっていれば追従する。

## 結論 (推奨初期値)

| 要素 | プロパティ | 値 | 役割 |
|---|---|---|---|
| 本文 | `font-family` | `'Roboto Serif Variable', 'Roboto Serif', serif` | UD ではないがスクリーン最適化された serif。Roboto 系で `I` と `l` が判別可能 |
| 本文 | `font-weight` | `500` (medium) | 黒背景で 400 だと骨格が弱く見えるため 1 段太め |
| 本文 | `color` | `rgb(var(--v-theme-readerBody))` (`#F2F0EA`) | 純白だとコントラスト過剰。暖色寄りオフホワイト |
| 本文 | `font-optical-sizing` | `auto` | variable font の opsz 軸を使い、大サイズで線が痩せないようにする |
| `<b>` | `color` | `rgb(var(--v-theme-readerAccent))` (`#FFC766`) | アンバー。赤系の「エラー」感を避けつつ黒背景で見つけやすい |
| `<b>` | `font-weight` | `700` | 本文 500 に対して 2 段太く、母音を前景化 |
| `<u>` | `color` | `inherit` | 文字色は本文のまま (`<b>` と競合させない) |
| `<u>` | `text-decoration-color` | `rgba(var(--v-theme-readerUnderline), 0.9)` (`#B4DCFF` α0.9) | 淡い水色で「グルーピング」を意味的に分離 |
| `<u>` | `text-decoration-thickness` | `0.1em` | 細すぎず、太すぎず |
| `<u>` | `text-underline-offset` | `0.14em` | 文字直下より少し下げて、字形と干渉しないように |
| `<u>` | `text-decoration-skip-ink` | `none` | 字形を避けて線が途切れないようにし、「まとまり」の印を安定させる |

## 設計上の判断と理由

### 1. なぜ純白ではなく `#F2F0EA` か

黒背景に `#FFFFFF` だと輝度差が最大 (コントラスト比 21:1) になり、長時間視聴で眼が疲れる。
わずかに暖色 (`#F2F0EA` / `#ECE9E2`) に振ることで、紙の本に近い穏やかさになる。

### 2. なぜ `<b>` を赤ではなくアンバー (`#FFC766`) にするか

| 色 | 印象 | シャドーイング用途での適合 |
|---|---|---|
| 純赤 (`#FF0000`) | エラー / 危険 / 警告 | × 否定感が強い |
| 黄色 (`#FFFF00`) | 注意喚起 | △ 明るすぎて黒背景でにじむ |
| **アンバー (`#FFC766`)** | 注目 / ハイライト | ◎ 否定感なく、黒背景でも視認しやすい |

母音アクセントは「ここを強く発音する」という **行動指示** であって、エラー指摘ではない。
赤を避けることでこの意味論を尊重する。

### 3. なぜ `<u>` の文字色は変えないか

`<u>` は「ここはひとまとまりで発音する」という **構造の補助記号** であり、
強調ではない。文字色まで変えると `<b>` と意味が衝突し、視線が散る。
下線だけを淡い水色で示すことで、`<b>` の暖色 / 本文の暖色オフホワイトと
寒色 / 暖色の対比でグルーピングを直感的に表現できる。

### 4. なぜ `text-decoration-skip-ink: none` を入れるか

ブラウザの既定 (`auto`) は、`g` `p` `y` などディセンダの周辺で下線を切り抜く。
シャドーイングの「ひとまとまり」の印として下線を使いたい場合、線が途切れると
分断感が出てしまう。`none` を明示して連続線にする。

### 5. 色をテーマ変数に集約する理由

CLAUDE.md 規約「Vuetify 内では色をハードコードせずテーマ変数経由」に従うため。
`src/plugins/vuetify.js` で 3 つのカスタムカラーを定義し、Vuetify が
自動生成する `--v-theme-readerBody` 等の CSS 変数を `<style>` から参照する。

```js
// src/plugins/vuetify.js
colors: {
  background: '#000000',
  surface: '#000000',
  readerBody: '#F2F0EA',
  readerAccent: '#FFC766',
  readerUnderline: '#B4DCFF',
}
```

```css
/* src/components/ReaderText.vue */
.reader-text { color: rgb(var(--v-theme-readerBody)); }
.reader-text :deep(b) { color: rgb(var(--v-theme-readerAccent)); }
.reader-text :deep(u) {
  text-decoration-color: rgba(var(--v-theme-readerUnderline), 0.9);
}
```

将来テーマを切り替えた場合 (ライトモード追加等) も `vuetify.js` 一箇所で完結する。

## 見え方の調整指針

実際に使ってみて違和感があった場合の **調整候補**。値を変えるのは
基本的に `src/plugins/vuetify.js` (色) と `src/components/ReaderText.vue` (寸法) のみ。

### `<b>` が弱く感じる (母音が前景化されない)

| 試す変更 | ファイル | 値 |
|---|---|---|
| 色を一段濃いアンバーに | `vuetify.js` | `readerAccent: '#FFD27A'` |
| ウェイトを上げる | `ReaderText.vue` | `:deep(b) { font-weight: 750 }` ※variable font 利用時 |

### `<b>` がうるさく感じる (チラつく / 主張が強すぎる)

| 試す変更 | ファイル | 値 |
|---|---|---|
| 色はそのままウェイトだけ下げる | `ReaderText.vue` | `:deep(b) { font-weight: 650 }` |
| 色を本文寄りに | `vuetify.js` | `readerAccent: '#E8B05A'` 程度 |

### `<u>` が見えない

| 試す変更 | ファイル | 値 |
|---|---|---|
| 太くする | `ReaderText.vue` | `text-decoration-thickness: 0.12em` |
| 不透明度を上げる | `ReaderText.vue` | `rgba(..., 1.0)` |

### `<u>` が強すぎる

| 試す変更 | ファイル | 値 |
|---|---|---|
| 不透明度を下げる | `ReaderText.vue` | `rgba(..., 0.7)` |
| **文字色は絶対に変えない** | — | `color: inherit` を維持 |

### 目が疲れる / 眩しい

| 試す変更 | ファイル | 値 |
|---|---|---|
| 本文をさらに暖色寄りに | `vuetify.js` | `readerBody: '#ECE9E2'` |
| 本文ウェイトを下げる | `ReaderText.vue` | `font-weight: 450` (variable font 必須) |

### 文字が痩せて見える (黒背景で骨が細い)

| 試す変更 | ファイル | 値 |
|---|---|---|
| 本文ウェイトを上げる | `ReaderText.vue` | `font-weight: 550` |
| opsz を確認 | `ReaderText.vue` | `font-optical-sizing: auto` が効いているか確認 |

## 避けたい変更 (根拠付き)

| 変更 | なぜ避けるか |
|---|---|
| `<b>` を真っ赤 (`#FF0000`) にする | エラー連想で意味論が崩れる |
| `<b>` を `font-weight: 900` 等の極太にする | 字形が潰れて読みにくい |
| `<u>` の `color` を変える | `<b>` と意味が衝突し視線が散る |
| `<u>` の thickness を `0.05em` 以下にする | 大画面で見えなくなる |
| 本文を `font-weight: 400` にする | 黒背景で骨格が弱く読みにくい |
| 本文を `#FFFFFF` (純白) にする | コントラスト過剰で疲労が早い |
| 色を `.vue` ファイルに直書きする | CLAUDE.md 規約違反、テーマ追従不能 |

## 関連ファイル

- `src/plugins/vuetify.js` — テーマカラー定義 (色を変えるならここ)
- `src/components/ReaderText.vue` — `.reader-text` / `:deep(b)` / `:deep(u)` 寸法・ウェイト (本文・プレビュー共通)
- `src/pages/ReaderPage.vue` — 教材本文側の利用箇所 (`<ReaderText :html="currentLine" />`)
- `src/pages/HomePage.vue` — フォントサイズプレビュー側の利用箇所 (`<ReaderText nowrap>`)
- `src/main.js` — `./assets/fonts/roboto-serif-latin.css` のインポート
- `src/assets/fonts/roboto-serif-latin.css` — latin subset cherry-pick 済みカスタム CSS
- `package.json` — `@fontsource-variable/roboto-serif` の依存
- `CLAUDE.md` — 「Vuetify の色指定はテーマ変数を経由する」規約
