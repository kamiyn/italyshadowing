<script setup>
import { computed, ref, onMounted } from 'vue'
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
import ReaderText from '../components/ReaderText.vue'

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
// スライダーの thumb-label に出すパーセント表記。テンプレート側に算術を
// 書かないため computed に寄せる。
const fontScalePercent = computed(() => `${Math.round(fontScale.value * 100)}%`)

// スライダードラッグ中フラグ。ドラッグ中は localStorage への永続化を抑制し、
// @end イベントでまとめて 1 回だけ persistFontScale() を呼ぶ。
// これにより同期 setItem がドラッグ中のメインスレッドをブロックして体感の
// 引っかかりを起こすのを防ぐ。
const isDraggingFontScale = ref(false)

function onFontScaleSliderUpdate(value) {
  setFontScale(value)
  // キーボードでの slider 操作 (フォーカス時の ←/→) は @start/@end を伴わない
  // ため isDraggingFontScale が false のまま @update:model-value だけが届く。
  // この場合は 1 操作 = 1 keystroke なのでその場で永続化してよい。
  // ドラッグ中 (= isDraggingFontScale=true) はここでは保存せず @end に委ねる。
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
// Vuetify ネイティブのスライダー操作が働き、本関数は呼ばれない (= 二重発火しない)。
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
  <v-main>
    <v-container class="home-container">
      <h1 class="home-title">
        Italy Shadowing
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
      <v-list
        v-else
        lines="two"
        class="lesson-list"
      >
        <v-list-item
          v-for="(lesson, i) in lessons"
          :key="lesson.filename"
          :active="i === selectedIndex"
          class="lesson-item"
          @click="selectAndOpen(i)"
        >
          <v-list-item-title>{{ lesson.title }}</v-list-item-title>
          <v-list-item-subtitle>{{ lesson.description }}</v-list-item-subtitle>
        </v-list-item>
      </v-list>
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
        <div class="font-size-preview-box">
          <ReaderText nowrap>
            Lorem Ipsum
          </ReaderText>
        </div>
        <!--
          aria-labelledby で h2 見出しと slider を紐付ける。これにより
          スクリーンリーダーで slider にフォーカスした際「表示フォントサイズ
          スライダー 現在値 …」のように読み上げられ、何を調整するスライダー
          か分かるようになる。Vuetify v-slider は内部 input role="slider"
          要素に aria-* 属性を pass-through する。
        -->
        <v-slider
          :model-value="fontScale"
          :min="FONT_SCALE_MIN"
          :max="FONT_SCALE_MAX"
          :step="FONT_SCALE_STEP"
          aria-labelledby="font-size-section-heading"
          thumb-label
          hide-details
          @update:model-value="onFontScaleSliderUpdate"
          @start="onFontScaleSliderStart"
          @end="onFontScaleSliderEnd"
        >
          <template #thumb-label>
            {{ fontScalePercent }}
          </template>
        </v-slider>
      </section>
    </v-container>
  </v-main>
</template>

<style scoped>
.home-container {
  max-width: 720px;
}

.home-title {
  font-size: 1.75rem;
  margin-bottom: 1rem;
}

.lesson-list {
  background: transparent;
}

.lesson-item {
  border-radius: 8px;
  margin-bottom: 4px;
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

/*
 * プレビューは ReaderText コンポーネントを使い、ReaderPage 本文と
 * 全く同じ font-size 計算式・font-family・色を共有する (重複定義しない)。
 * こうすることで HomePage で見ているサイズがそのまま教材表示時のサイズになる。
 *
 * このボックスは flex で中央寄せし、overflow: hidden を併用することで、
 * 高 font-scale 時に内側 ReaderText の幅が画面幅を超えても左右対称に
 * 切り落とされる (text-align ではなく flex を使う理由は、子要素 ReaderText
 * がブロック相当の width:auto + flex-shrink:0 になっているため)。
 */
.font-size-preview-box {
  width: 100%;
  overflow: hidden;
  display: flex;
  justify-content: center;
  margin-bottom: 0.5rem;
}
</style>
