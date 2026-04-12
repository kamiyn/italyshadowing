# ADR-006: タイマー管理には VueUse の ref ユーティリティを優先する

## ステータス

承認済

## コンテキスト

`setTimeout` / `clearTimeout` を手動管理して「一定時間後にフラグをリセットする」パターンは、タイマー ID の保持・クリア・コンポーネント破棄時の後始末が必要になり、コードの見通しが悪くなる。

```js
// 避ける: タイマー ID の手動管理
let timer = null
function activate() {
  flag = true
  clearTimeout(timer)
  timer = setTimeout(() => { flag = false }, 400)
}
// onUnmounted で clearTimeout(timer) も必要
```

VueUse の `refDebounced` (および `refThrottled`) を使えば、同じ意図を **宣言的に** 表現でき、タイマーの生成・破棄は VueUse 内部に閉じる。

## 決定

タイムアウト付きフラグ・遅延追随・スロットルなど **ref の時間的な変換** には、`setTimeout` / `clearTimeout` の手動管理ではなく `@vueuse/core` の ref ユーティリティを第一候補とする。

### 推奨ユーティリティ

| ユーティリティ | 用途 |
|---|---|
| `refDebounced` | 値が安定してから一定時間後に反映 (入力のデバウンス、フラグの遅延リセット) |
| `refThrottled` | 一定間隔で値を反映 (スクロール位置、リサイズ) |

### パターン例: 一定時間後の自動リセット

```js
import { refDebounced } from '@vueuse/core'

// カウンターをインクリメント → debounced 版が 400ms 後に追随
// 不一致の間 = 「最近アクションがあった」期間
const seq = ref(0)
const seqSettled = refDebounced(seq, 400)

// アクション完了時にインクリメント
seq.value++

// 1 回消費型ガード: 不一致なら true を返し、即座に一致させて解除
function consumeRecent() {
  if (seq.value === seqSettled.value) return false
  seq.value = seqSettled.value
  return true
}
```

### `setTimeout` を使ってよいケース

- Vue の reactivity 外で動作する純粋な非同期制御 (ネットワークリトライのバックオフなど)
- VueUse を導入していないユーティリティモジュール

## 帰結

- `@vueuse/core` がプロジェクト依存に追加される (tree-shakable のためバンドルサイズ影響は最小)
- タイマー管理の実装パターンが統一され、レビュー時に `setTimeout` が出たら ref ユーティリティで置き換え可能か検討する習慣になる
