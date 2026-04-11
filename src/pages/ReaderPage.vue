<script setup>
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchLesson } from '../lib/dataClient.js'
import { useKeyboard } from '../composables/useKeyboard.js'

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

useKeyboard((event) => {
  switch (event.key) {
    case 'ArrowLeft':
      event.preventDefault()
      goToPage(effectivePage.value - 1)
      break
    case 'ArrowRight':
      event.preventDefault()
      goToPage(effectivePage.value + 1)
      break
    case ' ':
      // Space also advances. Prevent the default page scroll.
      event.preventDefault()
      goToPage(effectivePage.value + 1)
      break
    case 'ArrowUp':
      event.preventDefault()
      router.push('/')
      break
  }
})
</script>

<template>
  <v-main>
    <div class="reader-shell">
      <p
        v-if="error"
        class="reader-error"
      >
        {{ error }}
      </p>
      <div
        v-else-if="lesson === null"
        class="reader-loading"
      >
        Loading...
      </div>
      <p
        v-else-if="lines.length === 0"
        class="reader-empty"
      >
        この教材には表示できる行がありません。
      </p>
      <div
        v-else
        class="reader-line"
        v-html="currentLine"
      />
      <p
        v-if="lesson !== null && lines.length > 0"
        class="reader-progress"
      >
        {{ effectivePage + 1 }} / {{ lines.length }}
      </p>
    </div>
  </v-main>
</template>

<style scoped>
.reader-shell {
  min-height: calc(100vh - 64px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  /* 上下は 2rem、左右は画面幅の 10% を余白として確保する */
  padding: 2rem 10%;
  text-align: center;
}

.reader-line {
  /*
   * フォントサイズ調整手順
   * - clamp(最小値, 可変値, 最大値) で指定しています。
   * - 全体的に文字を大きく/小さくしたい場合は 3 つの値をすべて同じ比率で増減してください。
   * - 画面幅への追従の強さを変えたい場合は中央 (vw 単位) の値だけを変更してください。
   * - 例: 元のサイズに戻す → clamp(1.5rem, 4vw, 2.75rem)
   */
  font-size: clamp(3rem, 8vw, 5.5rem);
  line-height: 1.5;
  width: 100%;
}

/* 教材コンテンツ中の <b> 要素に対するスタイル */
.reader-line :deep(b) {
  font-weight: 700;
}

/* 教材コンテンツ中の <u> 要素に対するスタイル */
.reader-line :deep(u) {
  text-decoration: underline;
}

.reader-progress {
  margin-top: 2rem;
  color: rgba(var(--v-theme-on-background), 0.6);
  font-size: 0.875rem;
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
