<script setup>
/* global __COMMIT_HASH__ */
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { fetchIndex } from '../lib/dataClient.js'
import {
  KEY_ARROW_DOWN,
  KEY_ARROW_LEFT,
  KEY_ARROW_RIGHT,
  KEY_ARROW_UP,
  KEY_ENTER,
} from '../lib/keys.js'
import { useKeyboard } from '../composables/useKeyboard.js'
import {
  useFontScale,
  FONT_SCALE_MIN,
  FONT_SCALE_MAX,
  FONT_SCALE_STEP,
} from '../composables/useFontScale.js'
import { usePinchFontScale } from '../composables/usePinchFontScale.js'
import ReaderText from '../components/ReaderText.vue'

const commitHash = __COMMIT_HASH__

const router = useRouter()
const lessons = ref([])
const selectedIndex = ref(0)
const error = ref(null)
// 取得完了前は isLoading=true。これがないと初期 lessons=[] の状態で
// 空 state メッセージが一瞬表示されてしまう。
const isLoading = ref(true)

onMounted(async () => {
  try {
    const data = await fetchIndex()
    lessons.value = Array.isArray(data?.lessons) ? data.lessons : []
  }
  catch (e) {
    error.value = String(e)
  }
  finally {
    isLoading.value = false
  }
})

// 表示条件は CLAUDE.md の方針に従い template 側に直書きせず computed へ寄せる。
const hasLessons = computed(() => lessons.value.length > 0)
const isEmptyState = computed(() => !isLoading.value && !error.value && !hasLessons.value)
const showHint = computed(() => !error.value && !isLoading.value && hasLessons.value)

const { fontScale, setFontScale, persistFontScale } = useFontScale()

const previewBoxRef = ref(null)
const { bindPinchTarget } = usePinchFontScale({ setFontScale, persistFontScale, fontScale })
onMounted(() => {
  if (previewBoxRef.value) bindPinchTarget(previewBoxRef.value)
})
// スライダーの thumb-label に出すパーセント表記。テンプレート側に算術を
// 書かないため computed に寄せる。
const fontScalePercent = computed(() => `${Math.round(fontScale.value * 100)}%`)

// スライダードラッグ中フラグ。ドラッグ中は localStorage への永続化を抑制し、
// @end イベントでまとめて 1 回だけ persistFontScale() を呼ぶ。
// これにより同期 setItem がドラッグ中のメインスレッドをブロックして体感の
// 引っかかりを起こすのを防ぐ。
const isDraggingFontScale = ref(false)

function onFontScaleSliderUpdate(event) {
  setFontScale(Number(event.target.value))
  // キーボードでの slider 操作 (フォーカス時の ←/→) は pointerdown/pointerup を
  // 伴わないため isDraggingFontScale が false のまま input イベントだけが届く。
  // この場合は 1 操作 = 1 keystroke なのでその場で永続化してよい。
  // ドラッグ中 (= isDraggingFontScale=true) はここでは保存せず pointerup に委ねる。
  if (!isDraggingFontScale.value) persistFontScale()
}

function onFontScaleSliderStart() {
  isDraggingFontScale.value = true
}

function onFontScaleSliderEnd() {
  isDraggingFontScale.value = false
  persistFontScale()
}

function openSelected() {
  const lesson = lessons.value[selectedIndex.value]
  if (!lesson) return
  router.push({ name: 'reader', params: { filename: lesson.filename } })
}

function selectAndOpen(index) {
  selectedIndex.value = index
  openSelected()
}

// フォントサイズ調整 (←/→)。スライダーがフォーカスされている場合は
// useKeyboard 側が text-entry 要素に対する keydown ハンドラ実行を skip するため
// ネイティブのスライダー操作が働き、本関数は呼ばれない (= 二重発火しない)。
//
// 値の clamp / 量子化は useFontScale.js の setFontScale が集約処理する。
// 1 keystroke = 1 完結操作なので、その場で永続化までまとめて行う。
function adjustFontScale(delta) {
  setFontScale(fontScale.value + delta)
  persistFontScale()
}

useKeyboard((event) => {
  switch (event.key) {
    case KEY_ARROW_LEFT:
      event.preventDefault()
      adjustFontScale(-FONT_SCALE_STEP)
      return
    case KEY_ARROW_RIGHT:
      event.preventDefault()
      adjustFontScale(FONT_SCALE_STEP)
      return
  }
  // 教材リスト操作系は教材が無いと意味が無いのでここで早期 return。
  // フォントサイズ操作はリスト有無に依存しないので上のブロックで先に処理する。
  if (lessons.value.length === 0) return
  switch (event.key) {
    case KEY_ARROW_UP:
      event.preventDefault()
      selectedIndex.value = Math.max(0, selectedIndex.value - 1)
      break
    case KEY_ARROW_DOWN:
      event.preventDefault()
      selectedIndex.value = Math.min(lessons.value.length - 1, selectedIndex.value + 1)
      break
    case KEY_ENTER:
      event.preventDefault()
      openSelected()
      break
  }
})
</script>

<template>
  <main>
    <div class="home-container">
      <h1 class="home-title">
        <span>Italy Shadowing</span>
        <small class="home-title-hash">
          {{ commitHash }}
        </small>
      </h1>
      <p
        v-if="error"
        class="home-error"
      >
        {{ error }}
      </p>
      <p
        v-else-if="isLoading"
        class="home-loading"
      >
        Loading...
      </p>
      <p
        v-else-if="isEmptyState"
        class="home-empty"
      >
        教材がまだ登録されていません。
      </p>
      <ul
        v-else
        class="lesson-list"
      >
        <li
          v-for="(lesson, i) in lessons"
          :key="lesson.filename"
          :class="['lesson-item', { active: i === selectedIndex }]"
          @click="selectAndOpen(i)"
        >
          <div class="lesson-item-title">
            {{ lesson.title }}
          </div>
          <div class="lesson-item-subtitle">
            {{ lesson.description }}
          </div>
        </li>
      </ul>
      <p
        v-if="showHint"
        class="home-hint"
      >
        ↑ ↓ で選択 / Enter で開く
      </p>
      <section
        class="font-size-section"
        aria-labelledby="font-size-section-heading"
      >
        <h2
          id="font-size-section-heading"
          class="font-size-heading"
        >
          表示フォントサイズ
        </h2>
        <!--
          slider はプレビューより上に置く。モバイル OS (iPhone のホーム
          インジケータ等) が画面最下部に割り当てているシステムジェスチャーと
          slider の thumb ドラッグが干渉するのを避けるため、最下段は非対話
          要素である preview-box が担当する。
          aria-labelledby で h2 見出しと slider を紐付ける。これにより
          スクリーンリーダーで slider にフォーカスした際「表示フォントサイズ
          スライダー 現在値 …」のように読み上げられ、何を調整するスライダー
          か分かるようになる。
        -->
        <div class="slider-wrapper">
          <input
            type="range"
            class="font-scale-slider"
            :value="fontScale"
            :min="FONT_SCALE_MIN"
            :max="FONT_SCALE_MAX"
            :step="FONT_SCALE_STEP"
            aria-labelledby="font-size-section-heading"
            @input="onFontScaleSliderUpdate"
            @pointerdown="onFontScaleSliderStart"
            @pointerup="onFontScaleSliderEnd"
          >
          <output class="slider-thumb-label">
            {{ fontScalePercent }}
          </output>
        </div>
      </section>
    </div>
    <div
      ref="previewBoxRef"
      class="font-size-preview-box"
    >
      <ReaderText html="Lorem Ipsum" />
    </div>
  </main>
</template>

<style scoped>
.home-container {
  max-width: 720px;
  margin: 0 auto;
  padding: 16px;
}

.home-title {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
  font-size: 1.75rem;
  margin-bottom: 1rem;
}

.home-title-hash {
  color: rgba(var(--v-theme-on-background), 0.55);
  font-size: 0.75rem;
  font-weight: 400;
  letter-spacing: 0.04em;
}

.lesson-list {
  background: transparent;
}

.lesson-item {
  border-radius: 8px;
  margin-bottom: 4px;
  padding: 12px 16px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.lesson-item:hover {
  background-color: rgba(var(--v-theme-on-background), 0.08);
}

.lesson-item.active {
  background-color: rgba(var(--v-theme-on-background), 0.12);
}

.lesson-item-title {
  font-size: 1rem;
  line-height: 1.5;
}

.lesson-item-subtitle {
  font-size: 0.875rem;
  line-height: 1.4;
  color: rgba(var(--v-theme-on-background), 0.6);
  margin-top: 2px;
}

.home-hint {
  margin-top: 1.5rem;
  color: rgba(var(--v-theme-on-background), 0.6);
  font-size: 0.875rem;
}

.home-error {
  color: rgb(var(--v-theme-error));
}

.home-empty {
  color: rgba(var(--v-theme-on-background), 0.6);
}

.home-loading {
  color: rgba(var(--v-theme-on-background), 0.6);
}

.font-size-section {
  margin-top: 2.5rem;
}

.font-size-heading {
  font-size: 1rem;
  font-weight: 500;
  color: rgba(var(--v-theme-on-background), 0.7);
  margin: 0 0 0.75rem;
}

/* ── Range slider styling ──────────────────────────── */
.slider-wrapper {
  position: relative;
  padding-top: 1.75rem;
}

.font-scale-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 20px;
  background: transparent;
  outline: none;
}

.font-scale-slider::-webkit-slider-runnable-track {
  height: 4px;
  border-radius: 2px;
  background: rgba(var(--v-theme-on-background), 0.24);
}

.font-scale-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: rgb(var(--v-theme-on-background));
  cursor: pointer;
  border: none;
  margin-top: -8px;
}

.font-scale-slider::-moz-range-track {
  height: 4px;
  border-radius: 2px;
  background: rgba(var(--v-theme-on-background), 0.24);
}

.font-scale-slider::-moz-range-thumb {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: rgb(var(--v-theme-on-background));
  cursor: pointer;
  border: none;
}

.slider-thumb-label {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.75rem;
  color: rgba(var(--v-theme-on-background), 0.7);
  pointer-events: none;
  white-space: nowrap;
}

/*
 * プレビューは ReaderText コンポーネントを使い、ReaderPage 本文と
 * 全く同じ font-size 計算式・font-family・色を共有する (重複定義しない)。
 * こうすることで HomePage で見ているサイズがそのまま教材表示時のサイズになる。
 *
 * home-container の外に置いているため自然に画面幅全体を使う。
 * padding: 0 10% で ReaderPage の .reader-shell と同じテキスト幅になる。
 */
.font-size-preview-box {
  text-align: center;
  margin-top: 0.5rem;
  padding: 0 10%;
}
</style>
