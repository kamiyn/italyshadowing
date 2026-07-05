// 教材ごとの音声ファイル (MP3 Blob) を IndexedDB に保存・復元する
// 最小限の promise ベースラッパー。
//
// 設計メモ
// - 音声はリポジトリにコミットしない (講座音源など再配布できない素材を想定)。
//   ユーザーが端末ごとにアプリ内でファイルを読み込み、この store に保存する。
//   決定の背景: Documents/ADR-007-device-local-audio-and-cues.md
// - Blob は localStorage に置けないサイズ (数 MB〜) のため IndexedDB を使う。
// - ADR-005 に基づき永続化は best-effort。全関数は throw せず、失敗時は
//   null / false を返す。ただし音声の保存はユーザー投入データの中核機能の
//   ため、putAudioBlob の失敗 (false) は呼び出し側がユーザーへ通知する
//   (ADR-005 の例外条項)。

const DB_NAME = 'italyshadowing'
const DB_VERSION = 1
const STORE_NAME = 'audio'

// open は 1 回だけ実行し promise をキャッシュする。失敗した場合は次回
// 呼び出しで再試行できるようキャッシュを破棄する。
let dbPromise = null

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function openDb() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('IndexedDB open blocked'))
  })
  dbPromise.catch(() => {
    dbPromise = null
  })
  return dbPromise
}

function hasIndexedDb() {
  return typeof indexedDB !== 'undefined'
}

// 保存済み音声 Blob を返す。未保存・失敗時は null (呼び出し側は
// 「音声なし」として扱う)。
export async function getAudioBlob(filename) {
  if (!hasIndexedDb()) return null
  try {
    const db = await openDb()
    const store = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME)
    const value = await requestToPromise(store.get(filename))
    return value instanceof Blob ? value : null
  }
  catch {
    return null
  }
}

// 音声 Blob を保存する。成功で true / 失敗で false。false のとき呼び出し側は
// 「今回のセッション中のみ再生可能」である旨をユーザーへ通知すること。
export async function putAudioBlob(filename, blob) {
  if (!hasIndexedDb()) return false
  try {
    const db = await openDb()
    const store = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME)
    await requestToPromise(store.put(blob, filename))
    return true
  }
  catch {
    return false
  }
}

// 保存済み音声を削除する。成功で true / 失敗で false。
export async function deleteAudioBlob(filename) {
  if (!hasIndexedDb()) return false
  try {
    const db = await openDb()
    const store = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME)
    await requestToPromise(store.delete(filename))
    return true
  }
  catch {
    return false
  }
}
