<script setup>
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchLesson } from '../lib/dataClient.js'
import {
  KEY_ARROW_LEFT,
  KEY_ARROW_RIGHT,
  KEY_ARROW_UP,
  KEY_ESCAPE,
  KEY_SPACE,
} from '../lib/keys.js'
import { useKeyboard } from '../composables/useKeyboard.js'
import ReaderText from '../components/ReaderText.vue'

const props = defineProps({
  filename: {
    type: String,
    required: true,
  },
})

const route = useRoute()
const router = useRouter()
const lesson = ref(null)
const error = ref(null)

// Tracks the in-flight fetchLesson() so a rapid filename change can cancel
// the previous request and discard any stale result. Without this, an older
// fetch resolving after a newer one would overwrite `lesson` with stale data.
let currentController = null

async function load(name) {
  if (currentController) {
    currentController.abort()
  }
  const controller = new AbortController()
  currentController = controller

  lesson.value = null
  error.value = null
  try {
    const data = await fetchLesson(name, { signal: controller.signal })
    // Bail if a newer load() has superseded this one. Covers the narrow race
    // where the fetch resolved successfully *just* before abort() was called.
    if (controller.signal.aborted) return
    lesson.value = data
  }
  catch (e) {
    if (controller.signal.aborted || e.name === 'AbortError') return
    error.value = String(e)
  }
  finally {
    if (currentController === controller) {
      currentController = null
    }
  }
}

onMounted(() => load(props.filename))
watch(() => props.filename, name => load(name))
onUnmounted(() => {
  if (currentController) {
    currentController.abort()
  }
})

const lines = computed(() => (Array.isArray(lesson.value?.lines) ? lesson.value.lines : []))

const effectivePage = computed(() => {
  if (lines.value.length === 0) return 0
  const raw = Number.parseInt(route.query.page, 10)
  const n = Number.isFinite(raw) ? raw : 0
  return Math.min(Math.max(n, 0), lines.value.length - 1)
})

const currentLine = computed(() => lines.value[effectivePage.value] ?? '')

// 表示条件・派生文字列は CLAUDE.md の方針に従い template 側に直書きせず
// computed へ寄せる。
const isLoading = computed(() => lesson.value === null)
const isEmptyLesson = computed(() => !isLoading.value && lines.value.length === 0)
const hasLines = computed(() => !isLoading.value && lines.value.length > 0)
const showProgress = computed(() => hasLines.value)
const progressLabel = computed(() => `${effectivePage.value + 1} / ${lines.value.length}`)

// URL を状態の正本として扱うため、?page= がクランプ対象になる値
// (範囲外・負数・非数値・ゼロの冗長表記・先頭ゼロ付きなど) だった場合に
// アドレスバーを正規形へ書き換える。そうしないと共有リンクの ?page=999 が
// 最終行を表示しているのにアドレスバーは 999 のままという不整合になる。
watch(
  [lesson, () => route.query.page],
  () => {
    if (lesson.value === null) return
    if (lines.value.length === 0) return

    const canonical = effectivePage.value
    const expectedQueryValue = canonical === 0 ? undefined : String(canonical)
    if (route.query.page === expectedQueryValue) return

    router.replace({
      name: 'reader',
      params: { filename: props.filename },
      query: canonical === 0 ? {} : { page: String(canonical) },
    })
  },
  { immediate: true },
)

function goToPage(next) {
  if (lines.value.length === 0) return
  const clamped = Math.min(Math.max(next, 0), lines.value.length - 1)
  if (clamped === effectivePage.value) return
  router.replace({
    name: 'reader',
    params: { filename: props.filename },
    query: clamped === 0 ? {} : { page: String(clamped) },
  })
}

// 「次へ」操作の共通エントリ。最終ページから更に次へ進もうとした場合は
// HomePage に戻す。キー操作 (Space / →) と画面タップの両方から呼ばれる。
function advanceOrExit() {
  if (lines.value.length === 0 || effectivePage.value >= lines.value.length - 1) {
    goHome()
    return
  }
  goToPage(effectivePage.value + 1)
}

// 本文以外の余白 (.reader-shell の地の部分) をタップ/クリックしたときだけ
// 次へ進める。本文 ReaderText やページ番号 .reader-progress、エラー表示
// などを誤タップしても発火しないよう currentTarget と一致するときに限定する。
function handleShellClick(event) {
  if (event.target !== event.currentTarget) return
  advanceOrExit()
}

// HomePage に戻る共通エントリ。キー操作 (ArrowUp / Escape) と
// progressLabel クリックの両方から呼ばれる。
function goHome() {
  router.push('/')
}

useKeyboard((event) => {
  switch (event.key) {
    case KEY_ARROW_LEFT:
      event.preventDefault()
      goToPage(effectivePage.value - 1)
      break
    case KEY_ARROW_RIGHT:
    case KEY_SPACE:
      // Right Arrow and Space both advance. Prevent default behavior
      // (including Space page scroll) in this shared handler.
      event.preventDefault()
      advanceOrExit()
      break
    case KEY_ARROW_UP:
    case KEY_ESCAPE:
      event.preventDefault()
      goHome()
      break
  }
})
</script>

<template>
  <v-main>
    <div
      class="reader-shell"
      @click="handleShellClick"
    >
      <p
        v-if="error"
        class="reader-error"
      >
        {{ error }}
      </p>
      <div
        v-else-if="isLoading"
        class="reader-loading"
      >
        Loading...
      </div>
      <p
        v-else-if="isEmptyLesson"
        class="reader-empty"
      >
        この教材には表示できる行がありません。
      </p>
      <ReaderText
        v-else
        :html="currentLine"
      />
      <p
        v-if="showProgress"
        class="reader-progress"
        role="button"
        tabindex="0"
        @click.stop="goHome"
        @keydown.enter.stop.prevent="goHome"
        @keyup.space.stop.prevent="goHome"
      >
        {{ progressLabel }}
      </p>
    </div>
  </v-main>
</template>

<style scoped>
.reader-shell {
  min-height: calc(100vh - var(--v-layout-top, 0px));
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  /* 上下は 2rem、左右は画面幅の 10% を余白として確保する */
  padding: 2rem 10%;
  text-align: center;
  /* .reader-progress を画面上端に絶対配置するための基準 */
  position: relative;
}

.reader-progress {
  /*
   * 本文 (ReaderText) から視覚的に最大限離すため画面上端へ絶対配置する。
   * フレックスフロー外に出すことで、ReaderText は .reader-shell の
   * 中央配置 (justify-content: center) を維持する。
   * 文字サイズは従来通り 0.875rem を維持。
   *
   * クリック/タップで HomePage に戻る (Escape キーと同じ動作) ため、
   * クリック可能であることを示す cursor: pointer を付ける。
   */
  position: absolute;
  top: 1rem;
  left: 50%;
  transform: translateX(-50%);
  margin: 0;
  color: rgba(var(--v-theme-on-background), 0.6);
  font-size: 0.875rem;
  cursor: pointer;
}

.reader-error {
  color: rgb(var(--v-theme-error));
}

.reader-loading {
  color: rgba(var(--v-theme-on-background), 0.6);
}

.reader-empty {
  color: rgba(var(--v-theme-on-background), 0.6);
  font-size: 1.25rem;
}
</style>
