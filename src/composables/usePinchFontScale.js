import { onUnmounted, ref } from 'vue'
import { refDebounced } from '@vueuse/core'

// 2 本指ピンチジェスチャーで fontScale を調整する composable。
//
// Pointer Events を使い、2 本の pointerId を追跡する。
// ピンチ中は setFontScale() で DOM 反映のみ、ジェスチャー終了時に
// persistFontScale() を 1 回だけ呼ぶ。
//
// 呼び出し側は bindPinchTarget(el) で対象要素を接続し、
// consumeRecentPinch() で直後の誤タップを 1 回だけ抑止できる。

export function usePinchFontScale({ setFontScale, persistFontScale, fontScale }) {
  const isPinching = ref(false)

  // ピンチ成立フラグ。pointermove 中に距離変化が閾値を超えたら true にし、
  // ジェスチャー終了 (pointerup/pointercancel) 時に pinchSeq をインクリメント
  // してからリセットする。こうすることで、ピンチ後に指を止めて 400ms 以上保持
  // してから離した場合でも、ガード期間が必ず「指を離した瞬間」から始まる。
  let didPinch = false

  // ジェスチャー終了ごとにインクリメントするカウンター。refDebounced で
  // 400ms 遅延の追随版を作り、両者が不一致の間 = 「最近ピンチが完了した」期間。
  // consumeRecentPinch() で 1 回消費すると即座に一致させてガードを解除する。
  // 誰も消費しなかった場合は 400ms 後に refDebounced が追いついて自動解除される。
  const pinchSeq = ref(0)
  const pinchSeqSettled = refDebounced(pinchSeq, 400)

  // 追跡中の 2 本の pointer
  const pointers = new Map()
  // ピンチ開始時の 2 点間距離と fontScale
  let startDistance = 0
  let startScale = 0

  let boundEl = null

  function getDistance() {
    if (pointers.size < 2) return 0
    const pts = [...pointers.values()]
    const dx = pts[1].x - pts[0].x
    const dy = pts[1].y - pts[0].y
    return Math.sqrt(dx * dx + dy * dy)
  }

  function onPointerDown(e) {
    // 2 本まで追跡する
    if (pointers.size >= 2) return
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointers.size === 2) {
      // ピンチ開始
      isPinching.value = true
      startDistance = getDistance()
      startScale = fontScale.value
      // pointer を要素にキャプチャしてドラッグ中に外れても追跡を続ける
      if (boundEl) {
        for (const id of pointers.keys()) {
          try {
            boundEl.setPointerCapture(id)
          }
          catch { /* ignore */ }
        }
      }
    }
  }

  function onPointerMove(e) {
    if (!pointers.has(e.pointerId)) return
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointers.size === 2 && startDistance > 0) {
      const currentDistance = getDistance()
      const ratio = currentDistance / startDistance
      const nextScale = startScale * ratio
      setFontScale(nextScale)

      // 距離変化が閾値を超えたら「実際にピンチした」とみなす。
      // ここではフラグだけ立て、pinchSeq の更新は pointerEnd に委ねる。
      if (Math.abs(ratio - 1) > 0.05) {
        didPinch = true
      }
    }
  }

  function onPointerEnd(e) {
    pointers.delete(e.pointerId)

    if (isPinching.value) {
      isPinching.value = false
      startDistance = 0
      startScale = 0
      persistFontScale()

      // ピンチが成立していた場合、ここでカウンターを更新する。
      // 400ms のガード期間が「指を離した瞬間」から始まる。
      if (didPinch) {
        pinchSeq.value++
        didPinch = false
      }
    }

    // 残りの pointer もクリアする (片方だけ残ると中途半端な状態になる)
    pointers.clear()
  }

  function onPointerCancel(e) {
    onPointerEnd(e)
  }

  /**
   * ピンチ直後の誤タップ抑止用。pinchSeq と pinchSeqSettled が不一致
   * (= 最近ピンチが完了した) なら true を返し、pinchSeq を settled に
   * 合わせて即座にガードを解除する (1 回消費)。
   * 誰も消費しなかった場合は 400ms 後に refDebounced が追いついて自動解除。
   */
  function consumeRecentPinch() {
    if (pinchSeq.value === pinchSeqSettled.value) return false
    pinchSeq.value = pinchSeqSettled.value
    return true
  }

  function bindPinchTarget(el) {
    if (!el) return
    boundEl = el
    // Pointer Events の挙動を安定させるため、この composable で touch-action を明示設定する
    el.style.touchAction = 'pan-x pan-y'
    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', onPointerEnd)
    el.addEventListener('pointercancel', onPointerCancel)
  }

  function unbindPinchTarget() {
    if (!boundEl) return
    boundEl.removeEventListener('pointerdown', onPointerDown)
    boundEl.removeEventListener('pointermove', onPointerMove)
    boundEl.removeEventListener('pointerup', onPointerEnd)
    boundEl.removeEventListener('pointercancel', onPointerCancel)
    boundEl = null
  }

  onUnmounted(() => {
    unbindPinchTarget()
  })

  return {
    bindPinchTarget,
    isPinching,
    consumeRecentPinch,
  }
}
