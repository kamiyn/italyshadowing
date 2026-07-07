<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchLesson } from '../lib/dataClient.js'
import {
  KEY_ARROW_DOWN,
  KEY_ARROW_LEFT,
  KEY_ARROW_RIGHT,
  KEY_ARROW_UP,
  KEY_ENTER,
  KEY_ESCAPE,
  KEY_SPACE,
} from '../lib/keys.js'
import { useKeyboard } from '../composables/useKeyboard.js'
import { useFontScale } from '../composables/useFontScale.js'
import { usePinchFontScale } from '../composables/usePinchFontScale.js'
import { useAudioPlayer } from '../composables/useAudioPlayer.js'
import ReaderText from '../components/ReaderText.vue'
import AudioControlBar from '../components/AudioControlBar.vue'

const props = defineProps({
  filename: {
    type: String,
    required: true,
  },
})

const route = useRoute()
const router = useRouter()

const { fontScale, setFontScale, persistFontScale } = useFontScale()
const readerShellRef = ref(null)
const { bindPinchTarget, consumeRecentPinch } = usePinchFontScale({
  setFontScale,
  persistFontScale,
  fontScale,
})
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
    // 教材確定後 (= lineCount 確定後) に、この教材用の保存済み音声とキューを
    // 復元する。キューの行数検証に lines.length が要るためこの位置で呼ぶ。
    player.reloadForLesson(name)
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

onMounted(() => {
  load(props.filename)
  if (readerShellRef.value) bindPinchTarget(readerShellRef.value)
})
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

// 音声プレイヤー。ページ位置の正本は URL (?page=) のままとし、再生位置に
// 同期した自動ページめくりは onAutoPage 経由で goToPage を呼ぶ形にする
// (goToPage は同値なら早期 return する冪等な関数なので毎フレーム呼ばれても
// 安全)。goToPage は関数宣言なので hoisting によりここから参照できる。
const player = useAudioPlayer({
  filename: props.filename,
  lineCount: computed(() => lines.value.length),
  onAutoPage: goToPage,
})

// ユーザー操作 (タップ / ←→ / Space) によるページ移動の共通エントリ。
// 自動めくり (goToPage 直呼び) と違い、再生中なら音声を移動先の行頭へ
// シークして「ページ移動 = その行を聴き直す」操作にする。
function manualGoToPage(next) {
  if (lines.value.length === 0) return
  const clamped = Math.min(Math.max(next, 0), lines.value.length - 1)
  // 再生中は tick() が古い currentTime で onAutoPage を呼ぶ競合があるため、
  // 音声シークを URL 更新より先に行う (onManualNavigate 内のガードと併用)。
  player.onManualNavigate(clamped)
  goToPage(clamped)
}

// 「次へ」操作の共通エントリ。最終ページまたは コンテンツ空 の状態から更に次へ進もうとした場合は
// HomePage に戻す。キー操作 (Space / →) と画面タップの両方から呼ばれる。
function advanceOrExit() {
  if (lines.value.length === 0 || effectivePage.value >= lines.value.length - 1) {
    goHome()
    return
  }
  manualGoToPage(effectivePage.value + 1)
}

// .reader-shell (本文含む) をタップ/クリックしたとき次へ進める。
// .reader-progress は @click.stop で伝播を止めるため、ここには届かない。
// 左マージン (padding-left) 内のタップは「前のページに戻る」として扱う。
// iPhone 等タッチ端末でキーボード ← 相当の操作を提供するため。
function handleShellClick(event) {
  // ピンチ直後にブラウザが合成 click を発火すると誤って次ページへ進む。
  // consumeRecentPinch() は直後の 1 回だけ true を返しガードを解除する。
  if (consumeRecentPinch()) return

  // キュー記録中は画面全体が「行頭タップ」の記録ボタンになる。
  if (player.isRecording.value) {
    player.recordCueTap()
    return
  }

  const shell = readerShellRef.value
  const paddingLeft = parseFloat(getComputedStyle(shell).paddingLeft)
  if (event.clientX - shell.getBoundingClientRect().left < paddingLeft) {
    manualGoToPage(effectivePage.value - 1)
    return
  }

  advanceOrExit()
}

// HomePage に戻る共通エントリ。キー操作 (ArrowUp / Escape) と
// handleProgressClick の両方から呼ばれる。
function goHome() {
  router.push('/')
}

// .reader-progress のクリック/タップ。ピンチ直後の合成 click が
// .reader-shell ではなくこの要素上に落ちた場合にも誤遷移を防ぐ。
function handleProgressClick() {
  if (consumeRecentPinch()) return
  goHome()
}

useKeyboard((event) => {
  // キュー記録中は Space = 行頭タップ / Escape = 中止 のみ受け付ける。
  // ページ移動や HomePage への離脱で記録が壊れるのを防ぐため他キーは無効。
  if (player.isRecording.value) {
    switch (event.key) {
      case KEY_SPACE:
        event.preventDefault()
        player.recordCueTap()
        break
      case KEY_ESCAPE:
        event.preventDefault()
        player.cancelRecording()
        break
    }
    return
  }
  switch (event.key) {
    case KEY_ARROW_LEFT:
      event.preventDefault()
      manualGoToPage(effectivePage.value - 1)
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
    case KEY_ENTER:
      // 再生 / 一時停止。keydown ハンドラ起点なので iOS のユーザー
      // ジェスチャ要件を満たす。
      event.preventDefault()
      player.togglePlay(effectivePage.value)
      break
    case KEY_ARROW_DOWN:
      // 現在行のリピート再生をトグルする。
      event.preventDefault()
      player.toggleLoop(effectivePage.value)
      break
  }
})
</script>

<template>
  <main>
    <div
      ref="readerShellRef"
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
        @click.stop="handleProgressClick"
        @keydown.enter.stop.prevent="goHome"
        @keyup.space.stop.prevent="goHome"
      >
        {{ progressLabel }}
      </p>
      <AudioControlBar
        v-if="hasLines"
        :player="player"
        :page-index="effectivePage"
      />
    </div>
  </main>
</template>

<style scoped>
.reader-shell {
  /* dvh 未対応ブラウザ向けフォールバック。100vh はアドレスバーの出入りに
     追従しないが、min-height が効かないよりは安全。 */
  min-height: 100vh;
  /* 100dvh はアドレスバーの出入りに連動する動的ビューポート高さ。
     対応ブラウザでは上の 100vh 宣言を上書きする。 */
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  /* 上下は 2rem、左右は画面幅の 10% を余白として確保する。
     notch / ステータスバーとの重なりは許容する方針のため、
     safe-area padding は掛けない。詳細: Documents/pwa-standalone.md */
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
