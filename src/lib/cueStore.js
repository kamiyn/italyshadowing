// 教材ごとの「各行が音声の何秒から始まるか」(キュー) を localStorage に
// 保存・復元する。自動ページめくりの同期データ。
//
// 設計メモ
// - 音声ファイル自体が端末ローカル (src/lib/audioStore.js) なので、その音声に
//   対して記録したキューも端末ローカルで一貫する。
//   決定の背景: Documents/ADR-007-device-local-audio-and-cues.md
// - ADR-005 に基づき best-effort。全関数は throw しない。
// - キューは「行 i の開始秒」の昇順配列で、長さは教材の行数と一致する。
//   教材が後から編集されて行数が変わった場合は loadCues の検証で弾かれ、
//   「キュー未記録」状態に戻る (再記録を促す)。

const STORAGE_KEY_PREFIX = 'italyshadowing.cues.'

function storageKey(filename) {
  return STORAGE_KEY_PREFIX + filename
}

function isValidCueArray(value, lineCount) {
  if (!Array.isArray(value)) return false
  if (value.length !== lineCount) return false
  for (let i = 0; i < value.length; i++) {
    const cue = value[i]
    if (!Number.isFinite(cue) || cue < 0) return false
    if (i > 0 && cue <= value[i - 1]) return false
  }
  return true
}

// 保存済みキューを返す。未保存・破損・行数不一致・失敗時は null
// (呼び出し側は「キュー未記録」として扱う)。
export function loadCues(filename, lineCount) {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(storageKey(filename))
    if (raw == null) return null
    const parsed = JSON.parse(raw)
    return isValidCueArray(parsed, lineCount) ? parsed : null
  }
  catch {
    return null
  }
}

// キューを保存する。各値は小数 2 桁 (10ms 精度) に丸める — 自動ページめくり
// には十分な精度で、localStorage の文字列を短く保つ。
// 失敗時の握りつぶしは ADR-005 参照。
export function saveCues(filename, cues) {
  if (typeof window === 'undefined') return
  try {
    const rounded = cues.map(cue => Math.round(cue * 100) / 100)
    window.localStorage.setItem(storageKey(filename), JSON.stringify(rounded))
  }
  catch {
    // ignore — ADR-005 参照
  }
}

// 保存済みキューを削除する。
export function deleteCues(filename) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(storageKey(filename))
  }
  catch {
    // ignore — ADR-005 参照
  }
}
