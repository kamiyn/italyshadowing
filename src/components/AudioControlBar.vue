<script setup>
import { computed, ref } from 'vue'
import {
  PLAYBACK_SPEED_MAX,
  PLAYBACK_SPEED_MIN,
  PLAYBACK_SPEED_STEP,
} from '../composables/usePlaybackSpeed.js'
import { REPEAT_ALL, REPEAT_NONE, REPEAT_ONE } from '../composables/useAudioPlayer.js'

// ReaderPage 下端の音声操作バー。useAudioPlayer が返すオブジェクトを
// `player` prop としてまるごと受け取る (状態は readonly ref なのでここから
// 書き換えられない)。ページ番号を要する操作 (再生開始行・ループ対象行) の
// ために現在ページ `pageIndex` も受け取る。
const props = defineProps({
  player: {
    type: Object,
    required: true,
  },
  pageIndex: {
    type: Number,
    required: true,
  },
})

const {
  hasAudio,
  isPlaying,
  repeatMode,
  isRecording,
  currentTime,
  duration,
  hasCues,
  recordedCount,
  storageNotice,
  playbackSpeed,
  lineCount,
  importFile,
  removeAudio,
  togglePlay,
  seekTo,
  setSpeed,
  persistSpeed,
  cycleRepeatMode,
  startRecording,
  cancelRecording,
} = props.player

const fileInputRef = ref(null)
// 「⋯」で開閉する管理行 (MP3 差し替え / 音声を削除)。
const showManageRow = ref(false)

const showImport = computed(() => !hasAudio.value)
const showControls = computed(() => hasAudio.value && !isRecording.value)
const showCueHint = computed(() => showControls.value && !hasCues.value)
const showManage = computed(() => showControls.value && showManageRow.value)

const playButtonLabel = computed(() => (isPlaying.value ? '⏸' : '▶'))
const speedLabel = computed(() => `×${playbackSpeed.value.toFixed(2)}`)
const recordingLabel = computed(
  () => `記録中 ${recordedCount.value} / ${lineCount.value} — タップ / Space で行頭を記録`,
)

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const total = Math.floor(seconds)
  const m = Math.floor(total / 60)
  const s = String(total % 60).padStart(2, '0')
  return `${m}:${s}`
}

const timeLabel = computed(
  () => `${formatTime(currentTime.value)} / ${formatTime(duration.value)}`,
)

const seekMax = computed(
  () => (Number.isFinite(duration.value) && duration.value > 0 ? duration.value : 0),
)
const isSeekDisabled = computed(() => seekMax.value === 0)

function openFilePicker() {
  fileInputRef.value?.click()
}

function onFileChange(event) {
  const file = event.target.files?.[0]
  if (file) importFile(file)
  // 同じファイルを選び直しても change が発火するよう値をクリアする。
  event.target.value = ''
  showManageRow.value = false
}

function onPlayClick() {
  togglePlay(props.pageIndex)
}

function onRepeatClick() {
  cycleRepeatMode(props.pageIndex)
}

// リピートは 1 ボタンで オフ → 全体 → 現在ページ → オフ と循環する。
// 現在ページリピートは 🔂 (1 曲リピート記号)、それ以外は 🔁 を表示し、
// オフ以外のときだけ active スタイルを付ける。
const isRepeatActive = computed(() => repeatMode.value !== REPEAT_NONE)
const repeatIcon = computed(() => (repeatMode.value === REPEAT_ONE ? '🔂' : '🔁'))
const repeatLabel = computed(() => {
  switch (repeatMode.value) {
    case REPEAT_ALL:
      return 'リピート: 全体'
    case REPEAT_ONE:
      return 'リピート: 現在ページ'
    default:
      return 'リピート: オフ'
  }
})

function onSeekInput(event) {
  seekTo(Number(event.target.value))
}

// 速度スライダーは HomePage のフォントサイズスライダーと同じ方針:
// ドラッグ中は setSpeed だけを高頻度で呼び、永続化 (同期 setItem) は
// 操作終了時に 1 回だけ行う。キーボード操作 (フォーカス時の ←/→) は
// pointer イベントを伴わないため input 時に即永続化する。
const isDraggingSpeed = ref(false)

function onSpeedSliderUpdate(event) {
  setSpeed(Number(event.target.value))
  if (!isDraggingSpeed.value) persistSpeed()
}

function onSpeedSliderStart(event) {
  event.target?.setPointerCapture?.(event.pointerId)
  isDraggingSpeed.value = true
}

function onSpeedSliderEnd() {
  isDraggingSpeed.value = false
  persistSpeed()
}

function toggleManageRow() {
  showManageRow.value = !showManageRow.value
}

function onRemoveClick() {
  if (!window.confirm('この教材の音声を端末から削除しますか?')) return
  showManageRow.value = false
  removeAudio()
}
</script>

<template>
  <!--
    click / pointerdown の stop: バー内の操作が .reader-shell のページ送り
    タップやピンチ追跡に化けるのを防ぐ。
    keydown.enter / keydown.space の stop: バー内のボタンにフォーカスが
    残った状態の Space / Enter は button のネイティブ活性化 (click) が担う
    ため、window レベルのショートカット (useKeyboard) との二重発火を防ぐ
    (input 要素は useKeyboard 側が skip するが button は skip されない)。
    矢印キーや Escape は stop せず、フォーカスがバー内にあってもページ移動
    などのグローバルショートカットが効くようにする。
  -->
  <div
    class="audio-bar"
    @click.stop
    @pointerdown.stop
    @keydown.enter.stop
    @keydown.space.stop
  >
    <!--
      教材音声は MP3 のみを受け付ける (accept="audio/mpeg,.mp3")。
      対応形式を MP3 に限定するのは意図した設計で、他形式 (wav/ogg 等) は
      選択させない。教材配布フォーマットを 1 つに揃え、端末保存する Blob の
      形式差異を持ち込まないため。
    -->
    <input
      ref="fileInputRef"
      type="file"
      accept="audio/mpeg,.mp3"
      class="audio-file-input"
      @change="onFileChange"
    >
    <button
      v-if="showImport"
      type="button"
      class="audio-button audio-import-button"
      @click="openFilePicker"
    >
      MP3 を読み込む
    </button>
    <div
      v-if="showControls"
      class="audio-controls"
    >
      <button
        type="button"
        class="audio-button audio-play-button"
        :aria-label="isPlaying ? '一時停止' : '再生'"
        @click="onPlayClick"
      >
        {{ playButtonLabel }}
      </button>
      <input
        type="range"
        class="audio-slider audio-seek-slider"
        :value="currentTime"
        :max="seekMax"
        :disabled="isSeekDisabled"
        min="0"
        step="0.01"
        aria-label="再生位置"
        @input="onSeekInput"
      >
      <span class="audio-time-label">{{ timeLabel }}</span>
      <input
        type="range"
        class="audio-slider audio-speed-slider"
        :value="playbackSpeed"
        :min="PLAYBACK_SPEED_MIN"
        :max="PLAYBACK_SPEED_MAX"
        :step="PLAYBACK_SPEED_STEP"
        aria-label="再生速度"
        @input="onSpeedSliderUpdate"
        @pointerdown="onSpeedSliderStart"
        @pointerup="onSpeedSliderEnd"
        @pointercancel="onSpeedSliderEnd"
        @lostpointercapture="onSpeedSliderEnd"
        @blur="onSpeedSliderEnd"
      >
      <span class="audio-speed-label">{{ speedLabel }}</span>
      <button
        type="button"
        :class="['audio-button', { active: isRepeatActive }]"
        :aria-label="repeatLabel"
        @click="onRepeatClick"
      >
        {{ repeatIcon }}
      </button>
      <button
        type="button"
        class="audio-button"
        aria-label="キューを記録"
        @click="startRecording"
      >
        ●
      </button>
      <button
        type="button"
        class="audio-button"
        aria-label="音声の管理"
        @click="toggleManageRow"
      >
        ⋯
      </button>
    </div>
    <div
      v-if="isRecording"
      class="audio-recording-row"
    >
      <span class="audio-recording-label">{{ recordingLabel }}</span>
      <button
        type="button"
        class="audio-button"
        @click="cancelRecording"
      >
        中止
      </button>
    </div>
    <div
      v-if="showManage"
      class="audio-manage-row"
    >
      <button
        type="button"
        class="audio-button"
        @click="openFilePicker"
      >
        MP3 差し替え
      </button>
      <button
        type="button"
        class="audio-button audio-remove-button"
        @click="onRemoveClick"
      >
        音声を削除
      </button>
    </div>
    <p
      v-if="showCueHint"
      class="audio-hint"
    >
      キュー未記録 — ● で行頭タイミングを記録すると自動ページ送りされます
    </p>
    <p
      v-if="storageNotice"
      class="audio-notice"
    >
      {{ storageNotice }}
    </p>
  </div>
</template>

<style scoped>
/*
 * .reader-shell 内の下端に絶対配置する (上端の .reader-progress と対になる)。
 * フレックスフロー外に出すことで本文 (ReaderText) の中央配置を崩さない。
 */
.audio-bar {
  position: absolute;
  /*
   * 最下端に置くと iPhone のホームインジケータ (画面下からのスワイプ) と
   * バー内のボタン/スライダー操作が干渉するため、ツールバー領域の高さ分
   * (約 3rem) と端末の下部セーフエリアぶんだけ上へ持ち上げる。
   */
  bottom: calc(0.75rem + 3rem + env(safe-area-inset-bottom, 0px));
  left: 50%;
  transform: translateX(-50%);
  width: min(92%, 640px);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.8125rem;
  color: rgba(var(--v-theme-on-background), 0.7);
}

.audio-file-input {
  display: none;
}

.audio-controls,
.audio-recording-row,
.audio-manage-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
}

.audio-button {
  background: transparent;
  border: 1px solid rgba(var(--v-theme-on-background), 0.3);
  border-radius: 6px;
  color: rgba(var(--v-theme-on-background), 0.85);
  font-size: 0.8125rem;
  line-height: 1;
  padding: 0.375rem 0.5rem;
  cursor: pointer;
}

.audio-button:disabled {
  opacity: 0.35;
  cursor: default;
}

.audio-button.active {
  background: rgba(var(--v-theme-on-background), 0.25);
}

.audio-play-button {
  min-width: 2.25rem;
}

.audio-time-label,
.audio-speed-label {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.audio-recording-label {
  color: rgba(var(--v-theme-on-background), 0.85);
}

.audio-remove-button {
  color: rgb(var(--v-theme-error));
  border-color: rgba(var(--v-theme-error), 0.5);
}

.audio-hint,
.audio-notice {
  margin: 0;
  font-size: 0.75rem;
  color: rgba(var(--v-theme-on-background), 0.55);
}

.audio-notice {
  color: rgb(var(--v-theme-error));
}

/* ── Range slider (HomePage の .font-scale-slider と同系の見た目) ── */
.audio-slider {
  -webkit-appearance: none;
  appearance: none;
  height: 20px;
  background: transparent;
  outline: none;
}

.audio-seek-slider {
  flex: 1 1 8rem;
  min-width: 4rem;
}

.audio-speed-slider {
  flex: 0 1 6rem;
  min-width: 3.5rem;
}

.audio-slider:focus-visible {
  outline: 2px solid rgba(var(--v-theme-on-background), 0.9);
  outline-offset: 4px;
}

.audio-slider::-webkit-slider-runnable-track {
  height: 4px;
  border-radius: 2px;
  background: rgba(var(--v-theme-on-background), 0.24);
}

.audio-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: rgb(var(--v-theme-on-background));
  cursor: pointer;
  border: none;
  margin-top: -6px;
}

.audio-slider::-moz-range-track {
  height: 4px;
  border-radius: 2px;
  background: rgba(var(--v-theme-on-background), 0.24);
}

.audio-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: rgb(var(--v-theme-on-background));
  cursor: pointer;
  border: none;
}
</style>
