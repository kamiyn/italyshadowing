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
// - リピートは repeatMode の 1 状態で管理する ('none' | 'all' | 'one')。
//   一般的なミュージックアプリと同様、1 つのボタンで オフ → 全体 → 現在ページ
//   → オフ と循環する。'one' = 現在ページリピート (cues 必須)、'all' =
//   コンテンツ全体リピート (終端で先頭へ戻る。cues 不要)。cues 無しの教材では
//   'one' を飛ばし オフ → 全体 → オフ の 2 状態になる。
// - 状態の不変条件: isRecording ⇒ isPlaying ∧ repeatMode = 'none' /
//   repeatMode = 'one' ⇒ hasCues

// ページめくりを音声より先行させる秒数 (等速再生時)。行頭ちょうどでめくると
// 視線移動が発話に遅れるため、少しだけ早くめくる。視線移動の遅れは実時間
// (壁時計) で一定なので、実際にメディア時間へ加算する先行量は playbackRate に
// 比例させる (pageTurnLeadSeconds 参照)。この定数はあくまで等速時の値。
export const PAGE_TURN_LEAD_SECONDS = 0.1

// リピートモードの値。ミュージックアプリ準拠で 1 ボタン循環させるため、
// 独立した 2 boolean ではなく 1 つの状態として持つ。UI (AudioControlBar) も
// この定数を import してアイコン・ラベルを分岐する。
export const REPEAT_NONE = 'none'
export const REPEAT_ALL = 'all'
export const REPEAT_ONE = 'one'

// putAudioBlob 失敗時にユーザーへ表示する通知 (ADR-005 の例外条項)。
const STORAGE_FAILED_NOTICE
  = 'この端末への保存に失敗しました。今回のセッション中のみ再生できます。'

export function useAudioPlayer({ filename, lineCount, onAutoPage }) {
  const { playbackSpeed, setPlaybackSpeed, persistPlaybackSpeed } = usePlaybackSpeed()

  const hasAudio = ref(false)
  const isPlaying = ref(false)
  const repeatMode = ref(REPEAT_NONE)
  const isRecording = ref(false)
  const currentTime = ref(0)
  const duration = ref(0)
  const recordedCount = ref(0)
  const storageNotice = ref('')
  // 現在教材のキュー (行 i の開始秒の昇順配列)。未記録・行数不一致は null。
  const cues = ref(null)
  const hasCues = computed(() => cues.value !== null)

  // repeatMode の内部可読性のための派生述語。'one' = 現在ページリピート、
  // 'all' = コンテンツ全体リピート。
  const isLineRepeat = computed(() => repeatMode.value === REPEAT_ONE)
  const isAllRepeat = computed(() => repeatMode.value === REPEAT_ALL)

  // 実時間で一定の先行にするための、メディア時間での先行量。lineIndexForTime は
  // メディア時間 (audio.currentTime) で判定するため、実時間の先行を一定に保つには
  // 加算するメディア時間を playbackRate に比例させる必要がある。等速で
  // PAGE_TURN_LEAD_SECONDS、0.6 倍速なら 0.06 秒 (= 実時間 0.1 秒先行)。固定値の
  // まま低速再生すると実時間の先行が伸び (0.1 / 0.6 ≒ 0.167 秒)、自動めくりが
  // 早すぎたり、行頭ちょうどへシークする手動移動 (先行なし) との落差が出る。
  const pageTurnLeadSeconds = computed(() => PAGE_TURN_LEAD_SECONDS * playbackSpeed.value)

  let currentFilename = filename
  let objectUrl = null
  let recordedCues = []
  let loopIndex = 0
  // 手動ページ移動直後、ブラウザが currentTime のシークを反映するまで
  // tick() の自動めくりが古い位置でページを戻さないよう一時的に固定する。
  let manualNavTarget = null
  // reloadForLesson の非同期取得 (getAudioBlob) の世代トークン。教材切り替え
  // だけでなく、同一教材内で import / 削除が割り込んだ場合にも、進行中の
  // 古い取得結果で音声ソースを上書きしないためのガードに使う。
  let loadToken = 0

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

    if (isLineRepeat.value) {
      const list = cues.value
      const end = loopIndex + 1 < list.length ? list[loopIndex + 1] : duration.value
      // 最終行ループで duration が NaN の間は ended イベント側が巻き戻す。
      if (Number.isFinite(end) && t >= end) {
        audio.currentTime = list[loopIndex]
      }
      // スライドはループ対象行 (loopIndex) へ決め打ちで固定する。0.1 秒先行の
      // lineIndexForTime を使わないことで、音声の実位置と表示が常に一致し、
      // ループ末尾で次ページが一瞬見える現象も防ぐ。onAutoPage は同値なら
      // 早期 return する冪等関数なので毎フレーム呼んでよい。リピート開始時に
      // 音声をシークせず、この tick 経由で表示を実位置へ寄せる設計のため、
      // ここでの固定が音声とスライドのズレを解消する要になる。
      onAutoPage(loopIndex)
      return
    }

    if (isRecording.value) return // 記録中のページはタップが駆動する

    if (cues.value) {
      if (manualNavTarget !== null) {
        if (lineIndexForTime(t + pageTurnLeadSeconds.value) === manualNavTarget) {
          manualNavTarget = null
        }
        else {
          onAutoPage(manualNavTarget)
          return
        }
      }
      onAutoPage(lineIndexForTime(t + pageTurnLeadSeconds.value))
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
    manualNavTarget = null
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
    if (isLineRepeat.value) {
      // 最終行ループは ended で巻き戻して再生継続する (duration 比較は
      // ended とのレースに負けることがあるため、こちらが本線)。
      audio.currentTime = cues.value[loopIndex]
      audio.play().catch(() => {})
      return
    }
    if (isAllRepeat.value) {
      // コンテンツ全体リピート: 先頭へ戻して再生を続ける。次フレームの tick が
      // 自動めくりを再開するが、巻き戻りを即座に表示へ反映するため先頭ページも
      // ここで指定する。
      audio.currentTime = 0
      onAutoPage(0)
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
    repeatMode.value = REPEAT_NONE
    isRecording.value = false
    recordedCues = []
    recordedCount.value = 0
    manualNavTarget = null
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
    const token = ++loadToken
    currentFilename = name
    resetPlaybackState()
    detachAudio()
    storageNotice.value = ''
    cues.value = loadCues(name, lineCount.value)
    const blob = await getAudioBlob(name)
    // 取得中に別教材への切り替え、または同一教材内で import / 削除が
    // 割り込んでいたら (= トークンが進んでいたら)、この古い取得結果は
    // 捨てる。これがないと import 済みの新しい音声を古い Blob で上書きする。
    if (token !== loadToken) return
    if (blob) attachBlob(blob)
  }

  // ユーザーが選択した MP3 を読み込む。メモリ上の再生は保存の成否に
  // かかわらず即座に有効化し、IndexedDB への保存失敗は通知だけ出す
  // (ADR-005 の例外条項)。既存キューは残す — 同じ音源の再読み込みなら
  // そのまま使えるため。別音源で行数やタイミングが合わない場合は
  // キュー再記録で上書きすればよい。
  async function importFile(file) {
    if (!(file instanceof Blob)) return
    // 進行中の reloadForLesson の非同期取得結果を無効化する (下記 attachBlob で
    // 差し替えた新しい音声を、後から解決した古い Blob で上書きさせない)。
    loadToken++
    resetPlaybackState()
    attachBlob(file)
    storageNotice.value = ''
    const saved = await putAudioBlob(currentFilename, file)
    if (!saved) storageNotice.value = STORAGE_FAILED_NOTICE
  }

  // 音声を端末から削除して初期状態へ戻す。キューは localStorage に残す
  // (同じ音源を再読み込みすれば再利用できる)。
  async function removeAudio() {
    // import と同様、進行中の reloadForLesson の取得結果を無効化する。
    loadToken++
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
      if (audio.ended || lineIndexForTime(audio.currentTime + pageTurnLeadSeconds.value) !== target) {
        audio.currentTime = cues.value[target]
      }
    }
    else if (audio.ended) {
      audio.currentTime = 0
    }
    audio.play().catch(() => {})
  }

  // シークバーからの移動。現在ページリピート ('one') は解除する (ループ区間外へ
  // 動かした直後に巻き戻ると混乱するため)。全体リピート ('all') はグローバルな
  // モードなのでシークでは解除しない。停止中でもページ表示を追従させ、その後の
  // togglePlay がシーク位置の行から自然に始まるようにする。
  function seekTo(seconds) {
    if (!hasAudio.value || isRecording.value) return
    if (isLineRepeat.value) repeatMode.value = REPEAT_NONE
    manualNavTarget = null
    const end = Number.isFinite(duration.value) ? duration.value : seconds
    const clamped = Math.min(Math.max(seconds, 0), end)
    audio.currentTime = clamped
    currentTime.value = clamped
    if (cues.value) {
      onAutoPage(lineIndexForTime(clamped + pageTurnLeadSeconds.value))
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

  // リピートモードを 1 ボタンで循環させる (ミュージックアプリ準拠)。
  // オフ → 全体 → 現在ページ → オフ。現在ページリピート ('one') は自動ページ
  // 送りのキュー (cues) が前提なので、cues が無い教材では 'one' を飛ばし
  // オフ → 全体 → オフ の 2 状態にする。
  function cycleRepeatMode(pageIndex) {
    if (!hasAudio.value || isRecording.value) return
    setRepeatMode(nextRepeatMode(), pageIndex)
  }

  function nextRepeatMode() {
    switch (repeatMode.value) {
      case REPEAT_NONE:
        return REPEAT_ALL
      case REPEAT_ALL:
        return hasCues.value ? REPEAT_ONE : REPEAT_NONE
      default: // REPEAT_ONE
        return REPEAT_NONE
    }
  }

  // モードを適用し、必要な再生副作用を起こす。ボタン/キー起点で呼ばれるため
  // audio.play() のユーザージェスチャ要件を満たす。
  // - 'one': 現在ページをループ対象にする。ループ末尾での巻き戻しと表示の
  //   固定は tick に委ねる (下記の理由参照)。
  // - 'all': 停止中なら再生を開始する (終端で止まっていれば先頭へ巻き戻す)。
  //   これにより cues 無しの sound only (1 ページ) を文字なしでシャドーイング
  //   する際、押した瞬間からループ再生に入れる。終端で onEnded が発火済みでも
  //   ここで再生を再開できる。
  // - 'none': 再生状態は変えない (リピートを解除するだけ)。
  function setRepeatMode(mode, pageIndex) {
    repeatMode.value = mode
    if (mode === REPEAT_ONE) {
      if (!cues.value) return
      if (isPlaying.value) {
        // 再生中は audio.currentTime が音声の実位置で、表示ページは 0.1 秒
        // 先行しているだけ。ここで pageIndex (先行した表示) の行頭へシークすると
        // 境界付近で音声が次行へ飛び「音声とスライドがずれる」。シークはせず、
        // いま実際に鳴っている行をループ対象にし、行末で tick に巻き戻させる。
        // 表示は tick の onAutoPage(loopIndex) が実位置へ寄せる。
        loopIndex = lineIndexForTime(audio.currentTime)
      }
      else {
        // 停止中は停止中のページ移動が音声をシークしないため、audio.currentTime が
        // 表示ページと乖離していることがある。表示ページ (URL 正本) を信頼して
        // その行頭へ合わせてから再生を開始する。
        loopIndex = clampIndex(pageIndex)
        audio.currentTime = cues.value[loopIndex]
        audio.play().catch(() => {})
      }
    }
    else if (mode === REPEAT_ALL) {
      if (!isPlaying.value) {
        if (audio.ended) audio.currentTime = 0
        audio.play().catch(() => {})
      }
    }
  }

  // ユーザーの手動ページ移動 (タップ / ←→ / Space) の後に ReaderPage から
  // 呼ばれる。再生中は音声をその行の頭へシークし「ページ移動 = 行頭から
  // 聴き直す」操作にする。現在ページリピート中はリピート対象を付け替える。
  // 停止中は何もしない (従来どおりの静かなページ移動)。
  function onManualNavigate(index) {
    if (!hasAudio.value || !cues.value || isRecording.value) return
    const target = clampIndex(index)
    if (isLineRepeat.value) {
      loopIndex = target
      manualNavTarget = target
      audio.currentTime = cues.value[target]
      currentTime.value = audio.currentTime
      return
    }
    if (!isPlaying.value) return
    manualNavTarget = target
    audio.currentTime = cues.value[target]
    currentTime.value = audio.currentTime
  }

  // ── キュー記録 ──────────────────────────────────────

  // 記録開始: 先頭から再生し、ユーザーが各行の頭でタップ/Space を押す。
  // 低速再生での記録も可 (currentTime はメディア時間なので playbackRate に
  // 依存しない。ゆっくり再生した方がタップは正確になる)。
  function startRecording() {
    if (!hasAudio.value || lineCount.value === 0 || isRecording.value) return
    repeatMode.value = REPEAT_NONE
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
    // タップした行を先に表示へ反映してから記録を確定する。最終行 (N 回目の
    // タップ) でも onAutoPage を確実に通し、最終ページが表示されないまま
    // 記録が終わる問題を防ぐ。
    onAutoPage(recordedCues.length - 1)
    if (recordedCues.length >= lineCount.value) {
      finishRecording()
    }
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
    audio.removeEventListener('play', onPlayEvent)
    audio.removeEventListener('pause', onPauseEvent)
    audio.removeEventListener('loadedmetadata', onLoadedMetadata)
    audio.removeEventListener('ended', onEnded)
    revokeObjectUrl()
  })

  return {
    // 状態 (読み取り専用)
    hasAudio: readonly(hasAudio),
    isPlaying: readonly(isPlaying),
    repeatMode: readonly(repeatMode),
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
    cycleRepeatMode,
    onManualNavigate,
    // キュー記録
    startRecording,
    recordCueTap,
    cancelRecording,
  }
}
