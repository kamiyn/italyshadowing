# モバイル向けピンチフォントサイズ調整 実装方針

`HomePage.vue` と `ReaderPage.vue` において、スマートフォンでも本文フォントサイズを素早く調整できるようにするための実装方針をまとめる。目標 UX は Google Maps のような **2 本指ピンチイン / ピンチアウトでの直接調整** だが、本アプリでは地図の pan / zoom ではなく、既存の `--reader-font-scale` を更新する形で実現する。

本ドキュメントは **実装方針（実装済みの設計背景）** を扱う。現状仕様は `README.md`、内部設計は `Architecture.md`、既存のフォントスケール管理は `src/composables/useFontScale.js` を参照。

## 背景

現状のフォントサイズ調整は次の 2 系統で提供されている。

- `HomePage.vue` の `v-slider`
- キーボードの `ArrowLeft` / `ArrowRight`

`useFontScale()` はすでに共通状態を提供しており、`setFontScale()` が DOM 反映、`persistFontScale()` が `localStorage` 永続化を担当する。したがってモバイル対応の主課題は、**新しい入力方法 (ピンチジェスチャー) をどう追加するか** であり、フォントサイズ状態管理そのものを作り直す必要はない。

一方で `ReaderPage.vue` には次の既存操作がある。

- 1 本指タップ (本文・余白どちらでも) で次ページへ進む
- `reader-progress` タップで HomePage に戻る

このため、ピンチ操作を追加する際は **単指タップと競合させないこと** が重要になる。

## 目標

- スマートフォンで 2 本指ピンチによりフォントサイズを直感的に変更できる
- `HomePage` と `ReaderPage` のどちらでも同じ倍率が反映される
- 既存の `useFontScale()` をそのまま状態の正本として使う
- ドラッグ中は高頻度に DOM 反映し、操作完了時だけ永続化する
- 既存のキーボード操作と `HomePage` のスライダーを残し、フォールバック経路を維持する

## 非目標

- Reader 本文の pan (平行移動) や任意位置ズームを実装すること
- PC トラックパッドの 2 本指ピンチを今回の主対象にすること
- `ReaderPage` に常時表示のスライダー UI を追加すること

## UX 方針

### 1. ジェスチャーは 2 本指のみで発火する

- 1 本指タップ / クリックは既存挙動を維持する
- 2 本指が同時に対象領域へ入ったときだけ「フォントサイズ調整モード」に入る
- フォント倍率は「ピンチ開始時の倍率」を基準に相対変化で求める

計算イメージ:

```text
nextScale = startScale * (currentDistance / startDistance)
```

最終的な clamp / 量子化は既存の `setFontScale()` に委譲する。

### 2. HomePage と ReaderPage でジェスチャー領域を分ける

#### HomePage

- 対象は `font-size-preview-box` のみ
- 教材一覧やページ全体のスクロール領域では発火させない
- 1 本指スクロールを壊さないため、ピンチ検出の適用範囲を広げすぎない
- スライダーは残し、細かい調整や非対応環境のフォールバックとする

#### ReaderPage

- 対象は `reader-shell` 全体
- 学習中は本文自体を見ながら拡大縮小したいので、本文付近のどこでも 2 本指ピンチを受け付ける
- ただし 1 本指タップによるページ送りは維持する

### 3. ピンチ後の誤タップ遷移を抑止する

`ReaderPage` では、ピンチ後にブラウザが合成 click を発火すると、意図せず次ページへ進む (`.reader-shell` 背景) または HomePage に戻る (`.reader-progress`) 恐れがある。これを避けるため、ジェスチャー終了直後の click を **1 回だけ** 無視する。

方針:

- pinch 中に `setFontScale()` 適用後の `fontScale` 実変化、または 2 本指距離の閾値超過のどちらかで `didPinch = true` を記録する。前者は 0.05 刻み量子化により高倍率側で 5% 未満の小さなピンチでも実際の 1 step 更新が起こり得るためその取りこぼしを防ぎ、後者は `fontScale` が min/max に到達済みで clamp により値が変わらない場合でも直後の合成 click ガードを有効に保つために必要
- ジェスチャー終了 (`pointerup` / `pointercancel`) 時に `didPinch` が true なら `pinchSeq` をインクリメントし、`didPinch` をリセットする。これにより 400ms のガード期間が必ず「指を離した瞬間」から始まる
- `persistFontScale()` は `didPinch` ではなく `fontScale` の最終値が `startScale` から変わったときだけ呼ぶ。これにより min/max 張り付きの明確なピンチでは click ガードだけを有効にし、不要な `localStorage.setItem()` は避ける
- `consumeRecentPinch()` は `pinchSeq !== pinchSeqSettled` (= 最近ピンチした) なら true を返し、即座に両者を一致させてガードを解除する (1 回消費)
- 誰も消費しなかった場合は 400ms 後に `refDebounced` が追いついて自動解除される (安全弁)
- `handleShellClick()` と `handleProgressClick()` の両方で `consumeRecentPinch()` を呼び、合成 click がどちらの要素に落ちても抑止する

### 4. 永続化はジェスチャー終了時に 1 回だけ行う

既存スライダー実装と同じく、ピンチ中は `setFontScale()` のみ呼ぶ。`persistFontScale()` は gesture end で、かつ最終的に `fontScale` が変わっていた場合にだけ 1 回呼ぶ。これにより `localStorage.setItem()` の高頻度実行と不要な書き込みの両方を避ける。

## 技術方針

### 1. 新しい composable に入力責務を分離する

ピンチ処理はページコンポーネントへ直書きせず、新しい composable に分離する。

候補:

- `src/composables/usePinchFontScale.js`

責務:

- 対象要素への gesture listener 登録 / 解除
- 2 点間距離の計算
- pinch 開始 / 更新 / 終了の状態管理
- `setFontScale()` / `persistFontScale()` 呼び出し
- 「直近で pinch が成立したか」の 1 回消費型ガード関数の提供

公開 API のイメージ:

```js
const {
  bindPinchTarget,
  isPinching,
  consumeRecentPinch,
} = usePinchFontScale({
  setFontScale,
  persistFontScale,
  fontScale,
})
```

`ReaderPage` 側は `consumeRecentPinch()` を click ハンドラのガードに使う。true を返したら即座にフラグを消費するため、直後の意図的タップは通る。

```js
function handleShellClick(event) {
  if (event.target !== event.currentTarget) return
  if (consumeRecentPinch()) return
  advanceOrExit()
}

function handleProgressClick() {
  if (consumeRecentPinch()) return
  goHome()
}
```

### 2. Pointer Events を第一候補にする

実装は `touchstart` / `touchmove` よりも `pointerdown` / `pointermove` / `pointerup` を第一候補にする。

理由:

- 1 本化されたイベントモデルで管理しやすい
- `pointerId` で 2 本指の追跡がしやすい
- HomePage / ReaderPage の両方で同じ composable を使いやすい

ただし、実機検証で iOS Safari が期待どおりに扱えない場合のみ、限定的に Touch Events フォールバックを検討する。最初から二重実装はしない。

### 3. `touch-action` は必要最小限の領域にだけ付ける

カスタムピンチとブラウザ既定のページズームが競合するため、対象領域では `touch-action: pan-x pan-y` を設定してネイティブ pinch-zoom を抑止する。これはトレードオフとして許容する — 対象領域上ではブラウザのアクセシビリティズーム (ピンチによるページ拡大) が効かなくなるが、本アプリ自体がフォントサイズ調整機能を提供しているため代替手段があると判断した。

方針:

- `HomePage` では `font-size-preview-box` のみ対象にする
- `ReaderPage` では `reader-shell` を対象にする
- グローバル (`body`, `html`) には適用しない
- `meta viewport` に `user-scalable=no` は入れない (ブラウザ UI からのズームは残す)

### 4. watch を増やさず、明示的なイベント入口から更新する

`CLAUDE.md` の方針どおり、ピンチ結果の反映は watch 連鎖ではなく、gesture handler から `setFontScale()` / `persistFontScale()` を直接呼ぶ。入力と副作用の入口を 1 箇所に保つ。

## 画面別の実装方針

### HomePage

実装方針:

- `font-size-preview-box` に `ref` を付ける
- `onMounted()` で pinch composable を接続する
- `v-slider` は現状維持
- ピンチ中の見た目補助が必要なら、将来的に `%` オーバーレイを追加できる構造にする

期待効果:

- ユーザーはプレビュー文字列を見ながら 2 本指でざっくり調整
- 必要ならスライダーで微調整

### ReaderPage

実装方針:

- `reader-shell` に `ref` を付ける
- pinch composable を接続する
- `handleShellClick()` と `handleProgressClick()` の先頭で `consumeRecentPinch()` を呼び、直後の合成 click を 1 回だけ無視する
- 既存の `advanceOrExit()`、`goHome()`、キーボード操作は変更しない

期待効果:

- 学習中に本文を見たまま直接拡大縮小できる
- 1 本指タップのページ送り文化を壊さない

## 実装ステップ

1. `usePinchFontScale.js` を追加する
2. `HomePage.vue` の `font-size-preview-box` に接続する
3. `ReaderPage.vue` の `reader-shell` に接続する
4. `ReaderPage.vue` に pinch 後 click 抑止を追加する
5. 必要に応じて対象領域へ `touch-action` を付与する
6. 実機検証で Safari / Chrome の挙動差を確認する

## 手動確認項目

- HomePage で 2 本指ピンチによりプレビュー文字が拡大 / 縮小する
- HomePage で一覧の 1 本指スクロールが壊れていない
- HomePage のスライダー操作とピンチ操作が同じ `fontScale` を共有する
- ReaderPage で 2 本指ピンチにより本文サイズが変わる
- ReaderPage で 1 本指タップは従来どおり次ページへ進む
- ReaderPage でピンチ直後に誤って次ページへ進まない
- ReaderPage から HomePage に戻っても直前の倍率が維持される
- `localStorage` が使えない環境でもクラッシュしない

## 判断メモ

今回の方針では、スマホ向け UX の主導線を次のように整理する。

- HomePage: `ピンチ = ざっくり調整`, `スライダー = 微調整`
- ReaderPage: `ピンチ = 学習中の直接調整`

これにより、既存設計 (`useFontScale` の singleton 状態、永続化分離、ReaderPage の単指タップ遷移) を壊さずに、スマホでの操作性だけを追加できる。
