<script setup>
import { computed, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { fetchIndex } from '../lib/dataClient.js'
import {
  KEY_ARROW_DOWN,
  KEY_ARROW_UP,
  KEY_ENTER,
} from '../lib/keys.js'
import { useKeyboard } from '../composables/useKeyboard.js'

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

function openSelected() {
  const lesson = lessons.value[selectedIndex.value]
  if (!lesson) return
  router.push({ name: 'reader', params: { filename: lesson.filename } })
}

function selectAndOpen(index) {
  selectedIndex.value = index
  openSelected()
}

useKeyboard((event) => {
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
</style>
