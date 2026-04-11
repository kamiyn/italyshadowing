<script setup>
import { computed, ref, watch, onMounted } from 'vue'
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

async function load(name) {
  lesson.value = null
  error.value = null
  try {
    lesson.value = await fetchLesson(name)
  }
  catch (e) {
    error.value = String(e)
  }
}

onMounted(() => load(props.filename))
watch(() => props.filename, name => load(name))

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
        v-else-if="lines.length === 0"
        class="reader-loading"
      >
        Loading...
      </div>
      <div
        v-else
        class="reader-line"
        v-html="currentLine"
      />
      <p
        v-if="lines.length > 0"
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
  padding: 2rem;
  text-align: center;
}

.reader-line {
  font-size: clamp(1.5rem, 4vw, 2.75rem);
  line-height: 1.5;
  max-width: 960px;
}

.reader-line :deep(b) {
  font-weight: 700;
}

.reader-progress {
  margin-top: 2rem;
  color: rgba(0, 0, 0, 0.6);
  font-size: 0.875rem;
}

.reader-error {
  color: #b00020;
}

.reader-loading {
  color: rgba(0, 0, 0, 0.6);
}
</style>
