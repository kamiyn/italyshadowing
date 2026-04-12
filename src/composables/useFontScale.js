import { readonly, ref } from 'vue'

// Reader 本文 (ReaderText コンポーネント) のフォントサイズ倍率を保持する。
//
// 設計メモ
// - localStorage に保存して次回アクセス時に復元する。
// - CSS カスタムプロパティ `--reader-font-scale` を documentElement に適用し、
//   ReaderText の `.reader-text` クラスが持つ `clamp(...)` 各値に乗算する形で
//   スケールする。こうすると ReaderText 側は CSS 変数を読むだけでよく、Vue の
//   reactivity を毎フレーム評価せずに済む。
// - HomePage のスライダーと ReaderPage の表示が同じ値を共有する必要があるため、
//   ref はモジュールスコープの singleton として 1 つだけ保持する。
//   composable 関数を呼ぶたびに新しい ref を作る素朴な形にすると、HomePage で
//   いじっても ReaderPage には届かない。
// - 書き換えは setFontScale() / 永続化は persistFontScale() の 2 つの明示 API
//   に分離し、watch を排除している。スライダードラッグ中は setFontScale だけが
//   高頻度で呼ばれて DOM 反映だけ走り、操作終了時に persistFontScale を 1 度
//   呼ぶ運用。これにより同期 setItem がドラッグ中のメインスレッドをブロック
//   しない。watch を避けた背景は CLAUDE.md の「watch を避ける」セクション参照。

const STORAGE_KEY = 'italyshadowing.fontScale'

export const FONT_SCALE_MIN = 0.5
export const FONT_SCALE_MAX = 2.0
export const FONT_SCALE_STEP = 0.05
export const FONT_SCALE_DEFAULT = 1.0

// FONT_SCALE_STEP (=0.05) を整数の刻み数に変換した値。1 / 0.05 = 20。
// quantizeScale はこれを使って value を STEP の格子点へ量子化する。
// STEP を 0.025 などに変えると 40 などになる。
const STEPS_PER_UNIT = Math.round(1 / FONT_SCALE_STEP)

function clampScale(value) {
  if (!Number.isFinite(value)) return FONT_SCALE_DEFAULT
  return Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, value))
}

// 浮動小数誤差で 1.15 が 1.1500000000000001 のように汚れるのを防ぐため、
// 整数刻みで丸めてから割り戻す。`Math.round(v * 20) / 20` の形は除算の
// 分母 20 が IEEE 754 で厳密表現できる整数なので、結果が 1.15 の最近傍
// double に収束する。`Math.round(v / 0.05) * 0.05` だと最終ステップの
// `* 0.05` で誤差が再混入し、String(value) や CSS 変数 / localStorage の
// 文字列化が "1.1500000000000001" のように汚れる。
function quantizeScale(value) {
  return Math.round(value * STEPS_PER_UNIT) / STEPS_PER_UNIT
}

function loadInitial() {
  if (typeof window === 'undefined') return FONT_SCALE_DEFAULT
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw == null) return FONT_SCALE_DEFAULT
    return quantizeScale(clampScale(Number.parseFloat(raw)))
  }
  catch {
    return FONT_SCALE_DEFAULT
  }
}

function applyToDom(value) {
  if (typeof document === 'undefined') return
  document.documentElement.style.setProperty('--reader-font-scale', String(value))
}

const fontScale = ref(loadInitial())

// 起動直後の DOM 反映。main.js でこのモジュールを import した時点で実行される。
applyToDom(fontScale.value)

// 値を更新する公式 API。clamp + 量子化 + ref 更新 + CSS 変数反映を 1 ヶ所に
// 集約する。**永続化はしない** — 高頻度で呼ばれる可能性があるため
// localStorage への書き込みは別 API persistFontScale() に分離した。
//
// 同値書き込みは早期 return して reactivity 連鎖を抑える。
function setFontScale(value) {
  const normalized = quantizeScale(clampScale(value))
  if (normalized === fontScale.value) return
  fontScale.value = normalized
  applyToDom(normalized)
}

// 現在の fontScale を localStorage に保存する。スライダードラッグ中のような
// 高頻度更新では呼ばずに、操作終了時 (slider の @end / キー入力完了) に
// まとめて呼ぶこと。同期 setItem がメインスレッドをブロックして体感の
// 引っかかりを起こすため、ドラッグごとに毎フレーム呼ぶことは避ける。
//
// 失敗時の握りつぶしは ADR-005 (localStorage はオプショナル動作) に基づく。
function persistFontScale() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, String(fontScale.value))
  }
  catch {
    // ignore — ADR-005 参照
  }
}

export function useFontScale() {
  // fontScale は readonly で公開し、書き換えは setFontScale 経由のみに強制する。
  // テンプレートで `:model-value="fontScale"` は問題なく動く (read のみ)。
  // `v-model="fontScale"` のような直接代入は意図的に弾く設計。
  return {
    fontScale: readonly(fontScale),
    setFontScale,
    persistFontScale,
  }
}
