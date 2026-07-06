import { readonly, ref } from 'vue'

// 音声再生速度 (playbackRate) の倍率を保持する。
//
// 設計メモ
// - useFontScale.js と同じパターン: モジュールスコープ singleton ref、
//   readonly 公開、高頻度 setter / 低頻度 persist の分離、量子化。
// - このモジュールは**純粋な状態と永続化のみ**を持つ。実際の
//   `audio.playbackRate` への反映は useAudioPlayer.js の setSpeed() が
//   一元的に行う (DOM 副作用の所有者を 1 箇所にするため)。
// - localStorage 失敗の握りつぶしは ADR-005 参照。

const STORAGE_KEY = 'italyshadowing.playbackSpeed'

export const PLAYBACK_SPEED_MIN = 0.6
export const PLAYBACK_SPEED_MAX = 1.0
export const PLAYBACK_SPEED_STEP = 0.05
export const PLAYBACK_SPEED_DEFAULT = 1.0

// 浮動小数誤差対策の量子化。詳細な理由は useFontScale.js の quantizeScale
// のコメント参照 (STEP の逆数 20 は IEEE 754 で厳密表現できる整数)。
const STEPS_PER_UNIT = Math.round(1 / PLAYBACK_SPEED_STEP)

function clampSpeed(value) {
  if (!Number.isFinite(value)) return PLAYBACK_SPEED_DEFAULT
  return Math.min(PLAYBACK_SPEED_MAX, Math.max(PLAYBACK_SPEED_MIN, value))
}

function quantizeSpeed(value) {
  return Math.round(value * STEPS_PER_UNIT) / STEPS_PER_UNIT
}

function loadInitial() {
  if (typeof window === 'undefined') return PLAYBACK_SPEED_DEFAULT
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw == null) return PLAYBACK_SPEED_DEFAULT
    return quantizeSpeed(clampSpeed(Number.parseFloat(raw)))
  }
  catch {
    return PLAYBACK_SPEED_DEFAULT
  }
}

const playbackSpeed = ref(loadInitial())

// 値を更新する公式 API。clamp + 量子化 + ref 更新を集約する。
// **永続化はしない** — スライダードラッグ中に高頻度で呼ばれるため、
// localStorage への書き込みは persistPlaybackSpeed() に分離した。
function setPlaybackSpeed(value) {
  const normalized = quantizeSpeed(clampSpeed(value))
  if (normalized === playbackSpeed.value) return
  playbackSpeed.value = normalized
}

// 現在の速度を localStorage に保存する。スライダー操作終了時にだけ呼ぶこと。
// 失敗時の握りつぶしは ADR-005 参照。
function persistPlaybackSpeed() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, String(playbackSpeed.value))
  }
  catch {
    // ignore — ADR-005 参照
  }
}

export function usePlaybackSpeed() {
  // playbackSpeed は readonly で公開し、書き換えは setPlaybackSpeed 経由のみ。
  return {
    playbackSpeed: readonly(playbackSpeed),
    setPlaybackSpeed,
    persistPlaybackSpeed,
  }
}
