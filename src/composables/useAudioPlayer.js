import { computed, onUnmounted, readonly, ref } from 'vue'
import { useRafFn } from '@vueuse/core'
import { deleteAudioBlob, getAudioBlob, putAudioBlob } from '../lib/audioStore.js'
import { loadCues, saveCues } from '../lib/cueStore.js'
import { usePlaybackSpeed } from './usePlaybackSpeed.js'

// 教材音声の再生・速度調整・キュー記録・再生位置に同期した自動ページめくりを
// 担う composable。ReaderPage ごとに 1 インスタンス生成する (singleton ではない)。
//
// 設計メモ
// - 副作用は全て明示的なメソッド呼び出しか audio 要素の DOM イベントで駆動し、
//   Vue の watch は使わない (CLAUDE.md「watch は最終手段」参照)。
// - 再生位置 → ページ番号の同期は VueUse useRafFn (ADR-006) で行う。
//   `timeupdate` イベントは ~250ms 間隔でしか発火せず、0.1 秒先行の
//   ページめくりには粒度が足りないため使わない。
// - ページ番号は audio.currentTime の純関数 (lineIndexForTime) として毎
//   フレーム計算する。onAutoPage (= ReaderPage の goToPage) は同値なら
//   早期 return する冪等な関数なので、毎フレーム呼んでも安全。
//   バックグラウンドで rAF が間引かれても復帰後の最初の tick で正しい
//   ページへ自己修復する。
// - audio.play() は iOS のユーザージェスチャ要件のため、必ず click /
//   keydown ハンドラから呼ばれるメソッド内でのみ実行する (例外はループ
//   再生継続のための ended からの再 play で、これは Safari が許容する)。
// - 状態の不変条件: isRecording ⇒ isPlaying ∧ ¬isLooping / isLooping ⇒ hasCues

// ページめくりを音声より先行させる秒数。行頭ちょうどでめくると視線移動が
// 発話に遅れるため、少しだけ早くめくる。
export const PAGE_TURN_LEAD_SECONDS = 0.1

// putAudioBlob 失敗時にユーザーへ表示する通知 (ADR-005 の例外条項)。
const STORAGE_FAILED_NOTICE
  = 'この端末への保存に失敗しました。今回のセッション中のみ再生できます。'

export function useAudioPlayer({ filename, lineCount, onAutoPage }) {
  const { playbackSpeed, setPlaybackSpeed, persistPlaybackSpeed } = usePlaybackSpeed()

  const hasAudio = ref(false)
  const isPlaying = ref(false)
  const isLooping = ref(false)
  const isRecording = ref(false)
  const currentTime = ref(0)
  const duration = ref(0)
  const recordedCount = ref(0)
  const storageNotice = ref('')
  // 現在教材のキュー (行 i の開始秒の昇順配列)。未記録・行数不一致は null。
  const cues = ref(null)
  const hasCues = computed(() => cues.value !== null)

  let currentFilename = filename
  let objectUrl = null
  let recordedCues = []
  let loopIndex = 0

  const audio = new Audio()
  audio.preload = 'auto'

  function clampIndex(index) {
    return Math.min(Math.max(index, 0), lineCount.value - 1)
  }

  // 再生位置 t が属する行番号。cues[0] より前は 0、最終キュー以降は最終行。
  function lineIndexForTime(t) {
    const list = cues.value
    let i = 0
    while (i + 1 < list.length && list[i + 1] <= t) i++
    return i
  }

  function tick() {
    const t = audio.currentTime
    currentTime.value = t

    if (isLooping.value) {
      const list = cues.value
      const end = loopIndex + 1 < list.length ? list[loopIndex + 1] : duration.value
      // 最終行ループで duration が NaN の間は ended イベント側が巻き戻す。
      if (Number.isFinite(end) && t >= end) {
        audio.currentTime = list[loopIndex]
      }
      // ループ中は自動めくりを抑止する (0.1 秒先行が次ページを一瞬
      // 見せてしまうのを防ぐ意味もある)。
      return
    }

    if (isRecording.value) return // 記録中のページはタップが駆動する

    if (cues.value) {
      onAutoPage(lineIndexForTime(t + PAGE_TURN_LEAD_SECONDS))
    }
  }

  const { resume: resumeTick, pause: pauseTick } = useRafFn(tick, { immediate: false })

  // ── audio 要素の DOM イベント ──────────────────────────
  // iOS のコントロールセンター・電話着信など、アプリ外からの再生/停止でも
  // isPlaying が真実を映すよう、フラグは play/pause イベントでのみ更新する。

  function onPlayEvent() {
    isPlaying.value = true
    resumeTick()
  }

  function onPauseEvent() {
    isPlaying.value = false
    pauseTick()
    currentTime.value = audio.currentTime
  }

  function onLoadedMetadata() {
    duration.value = audio.duration
    // Safari はソース差し替えで playbackRate を 1 に戻すことがあるため
    // メタデータ取得のたびに再適用する。
    audio.playbackRate = playbackSpeed.value
  }

  function onEnded() {
    if (isRecording.value) {
      // 全行を記録する前に音声が尽きた。部分キューは保存できないので破棄。
      cancelRecording()
      return
    }
    if (isLooping.value) {
      // 最終行ループは ended で巻き戻して再生継続する (duration 比較は
      // ended とのレースに負けることがあるため、こちらが本線)。
      audio.currentTime = cues.value[loopIndex]
      audio.play().catch(() => {})
      return
    }
    // 自動めくりは最終ページで止まる。HomePage へは戻らずユーザーに委ねる。
  }

  audio.addEventListener('play', onPlayEvent)
  audio.addEventListener('pause', onPauseEvent)
  audio.addEventListener('loadedmetadata', onLoadedMetadata)
  audio.addEventListener('ended', onEnded)

  // ── 音声ソース管理 ──────────────────────────────────

  function revokeObjectUrl() {
    if (objectUrl === null) return
    URL.revokeObjectURL(objectUrl)
    objectUrl = null
  }

  function resetPlaybackState() {
    audio.pause()
    isLooping.value = false
    isRecording.value = false
    recordedCues = []
    recordedCount.value = 0
    currentTime.value = 0
    duration.value = 0
  }

  function attachBlob(blob) {
    revokeObjectUrl()
    objectUrl = URL.createObjectURL(blob)
    audio.src = objectUrl
    hasAudio.value = true
  }

  function detachAudio() {
    revokeObjectUrl()
    audio.removeAttribute('src')
    audio.load()
    hasAudio.value = false
  }

  // 教材の切り替え時 (および初回ロード完了時) に ReaderPage の load() から
  // 呼ばれる。lesson データ取得後 = lineCount 確定後に呼ぶこと (キューの
  // 行数検証に必要)。
  async function reloadForLesson(name) {
    currentFilename = name
    resetPlaybackState()
    detachAudio()
    storageNotice.value = ''
    cues.value = loadCues(name, lineCount.value)
    const blob = await getAudioBlob(name)
    // 取得中にさらに教材が切り替わっていたら古い結果は捨てる。
    if (name !== currentFilename) return
    if (blob) attachBlob(blob)
  }

  // ユーザーが選択した MP3 を読み込む。メモリ上の再生は保存の成否に
  // かかわらず即座に有効化し、IndexedDB への保存失敗は通知だけ出す
  // (ADR-005 の例外条項)。既存キューは残す — 同じ音源の再読み込みなら
  // そのまま使えるため。別音源で行数やタイミングが合わない場合は
  // キュー再記録で上書きすればよい。
  async function importFile(file) {
    if (!(file instanceof Blob)) return
    resetPlaybackState()
    attachBlob(file)
    storageNotice.value = ''
    const saved = await putAudioBlob(currentFilename, file)
    if (!saved) storageNotice.value = STORAGE_FAILED_NOTICE
  }

  // 音声を端末から削除して初期状態へ戻す。キューは localStorage に残す
  // (同じ音源を再読み込みすれば再利用できる)。
  async function removeAudio() {
    resetPlaybackState()
    detachAudio()
    storageNotice.value = ''
    await deleteAudioBlob(currentFilename)
  }

  // ── 再生操作 ────────────────────────────────────────

  // 再生/一時停止。停止中から再生する場合、キューがあれば現在ページの
  // 行頭に合わせてから開始する (ページと音声の食い違いを防ぐ)。既に
  // 現在ページの行の中にいる場合はその位置から続きを再生する。
  function togglePlay(pageIndex) {
    if (!hasAudio.value || isRecording.value) return
    if (isPlaying.value) {
      audio.pause()
      return
    }
    if (cues.value) {
      const target = clampIndex(pageIndex)
      if (audio.ended || lineIndexForTime(audio.currentTime + PAGE_TURN_LEAD_SECONDS) !== target) {
        audio.currentTime = cues.value[target]
      }
    }
    else if (audio.ended) {
      audio.currentTime = 0
    }
    audio.play().catch(() => {})
  }

  // シークバーからの移動。ループは解除する (ループ区間外へ動かした直後に
  // 巻き戻ると混乱するため)。停止中でもページ表示を追従させ、その後の
  // togglePlay がシーク位置の行から自然に始まるようにする。
  function seekTo(seconds) {
    if (!hasAudio.value || isRecording.value) return
    isLooping.value = false
    const end = Number.isFinite(duration.value) ? duration.value : seconds
    const clamped = Math.min(Math.max(seconds, 0), end)
    audio.currentTime = clamped
    currentTime.value = clamped
    if (cues.value) {
      onAutoPage(lineIndexForTime(clamped + PAGE_TURN_LEAD_SECONDS))
    }
  }

  // 再生速度の反映。usePlaybackSpeed は純粋な状態のみ持ち、
  // audio.playbackRate への DOM 反映はここが唯一の所有者。
  function setSpeed(value) {
    setPlaybackSpeed(value)
    audio.playbackRate = playbackSpeed.value
  }

  function persistSpeed() {
    persistPlaybackSpeed()
  }

  // 現在ページの行リピートをトグルする。開始時は行頭へシークし、停止中なら
  // 再生も開始する (ボタン/キーハンドラ起点なのでユーザージェスチャ要件を
  // 満たす)。
  function toggleLoop(pageIndex) {
    if (!cues.value || isRecording.value) return
    if (isLooping.value) {
      isLooping.value = false
      return
    }
    loopIndex = clampIndex(pageIndex)
    isLooping.value = true
    audio.currentTime = cues.value[loopIndex]
    if (!isPlaying.value) audio.play().catch(() => {})
  }

  // ユーザーの手動ページ移動 (タップ / ←→ / Space) の後に ReaderPage から
  // 呼ばれる。再生中は音声をその行の頭へシークし「ページ移動 = 行頭から
  // 聴き直す」操作にする。ループ中はループ対象を付け替える。停止中は
  // 何もしない (従来どおりの静かなページ移動)。
  function onManualNavigate(index) {
    if (!hasAudio.value || !cues.value || isRecording.value) return
    const target = clampIndex(index)
    if (isLooping.value) {
      loopIndex = target
      audio.currentTime = cues.value[target]
      return
    }
    if (!isPlaying.value) return
    audio.currentTime = cues.value[target]
  }

  // ── キュー記録 ──────────────────────────────────────

  // 記録開始: 先頭から再生し、ユーザーが各行の頭でタップ/Space を押す。
  // 低速再生での記録も可 (currentTime はメディア時間なので playbackRate に
  // 依存しない。ゆっくり再生した方がタップは正確になる)。
  function startRecording() {
    if (!hasAudio.value || lineCount.value === 0 || isRecording.value) return
    isLooping.value = false
    recordedCues = []
    recordedCount.value = 0
    isRecording.value = true
    audio.currentTime = 0
    onAutoPage(0)
    audio.play().catch(() => {})
  }

  // タップ 1 回 = 「いま行 (recordedCues.length) の頭が読まれ始めた」。
  // k 回目のタップ後は行 k-1 を表示する。全行ぶん記録したら保存して終了。
  function recordCueTap() {
    if (!isRecording.value) return
    let cue = audio.currentTime
    // 同一フレーム内の連打などで直前と同時刻になった場合も、キューの
    // 昇順不変条件 (cueStore の検証条件) を保つよう僅かにずらす。
    const last = recordedCues[recordedCues.length - 1]
    if (last !== undefined && cue <= last) cue = last + 0.01
    recordedCues.push(cue)
    recordedCount.value = recordedCues.length
    if (recordedCues.length >= lineCount.value) {
      finishRecording()
      return
    }
    onAutoPage(recordedCues.length - 1)
  }

  function finishRecording() {
    isRecording.value = false
    audio.pause()
    cues.value = recordedCues
    saveCues(currentFilename, recordedCues)
    recordedCues = []
  }

  // 記録を中断する。記録途中の値は破棄し、保存済みの既存キューは残す
  // (上書きは完走時のみ)。
  function cancelRecording() {
    if (!isRecording.value) return
    isRecording.value = false
    audio.pause()
    recordedCues = []
    recordedCount.value = 0
  }

  onUnmounted(() => {
    audio.pause()
    revokeObjectUrl()
  })

  return {
    // 状態 (読み取り専用)
    hasAudio: readonly(hasAudio),
    isPlaying: readonly(isPlaying),
    isLooping: readonly(isLooping),
    isRecording: readonly(isRecording),
    currentTime: readonly(currentTime),
    duration: readonly(duration),
    hasCues,
    recordedCount: readonly(recordedCount),
    storageNotice: readonly(storageNotice),
    playbackSpeed,
    lineCount,
    // 音声ソース管理
    reloadForLesson,
    importFile,
    removeAudio,
    // 再生操作
    togglePlay,
    seekTo,
    setSpeed,
    persistSpeed,
    toggleLoop,
    onManualNavigate,
    // キュー記録
    startRecording,
    recordCueTap,
    cancelRecording,
  }
}
