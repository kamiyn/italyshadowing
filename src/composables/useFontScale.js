import { ref, watch } from 'vue'

// Reader 本文 (.reader-line) のフォントサイズ倍率を保持する。
//
// 設計メモ
// - localStorage に保存して次回アクセス時に復元する。
// - CSS カスタムプロパティ `--reader-font-scale` を documentElement に適用し、
//   `.reader-line` の `clamp(...)` 各値に乗算する形でスケールする。
//   こうすると ReaderPage 側は CSS 変数を読むだけでよく、Vue の reactivity を
//   毎フレーム評価せずに済む。
// - HomePage のスライダーと ReaderPage の表示が同じ値を共有する必要があるため、
//   ref はモジュールスコープの singleton として 1 つだけ保持する。
//   composable 関数を呼ぶたびに新しい ref を作る素朴な形にすると、HomePage で
//   いじっても ReaderPage には届かない。

const STORAGE_KEY = 'italyshadowing.fontScale'

export const FONT_SCALE_MIN = 0.5
export const FONT_SCALE_MAX = 2.0
export const FONT_SCALE_STEP = 0.05
export const FONT_SCALE_DEFAULT = 1.0

function clampScale(value) {
  if (!Number.isFinite(value)) return FONT_SCALE_DEFAULT
  return Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, value))
}

function loadInitial() {
  if (typeof window === 'undefined') return FONT_SCALE_DEFAULT
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw == null) return FONT_SCALE_DEFAULT
    return clampScale(Number.parseFloat(raw))
  } catch {
    return FONT_SCALE_DEFAULT
  }
}

function applyToDom(value) {
  if (typeof document === 'undefined') return
  document.documentElement.style.setProperty('--reader-font-scale', String(value))
}

const fontScale = ref(loadInitial())

// 起動直後の適用。main.js でこのモジュールを import した時点で実行される。
applyToDom(fontScale.value)

watch(fontScale, (value) => {
  // スライダーは min/max を設定済みだが、外部から不正な値が入る可能性に備えて
  // 念のため clamp してから永続化する。
  const clamped = clampScale(value)
  if (clamped !== value) {
    fontScale.value = clamped
    return
  }
  applyToDom(clamped)
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, String(clamped))
})

export function useFontScale() {
  return { fontScale }
}
