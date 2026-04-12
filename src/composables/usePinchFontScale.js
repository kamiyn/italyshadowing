import { onUnmounted, ref } from 'vue'

// 2 本指ピンチジェスチャーで fontScale を調整する composable。
//
// Pointer Events を使い、2 本の pointerId を追跡する。
// ピンチ中は setFontScale() で DOM 反映のみ、ジェスチャー終了時に
// persistFontScale() を 1 回だけ呼ぶ。
//
// 呼び出し側は bindPinchTarget(el) で対象要素を接続し、
// consumeRecentPinch() で直後の誤タップ抑止に使える。

export function usePinchFontScale({ setFontScale, persistFontScale, fontScale }) {
  const isPinching = ref(false)

  // ピンチが成立したか (距離変化が閾値を超えた) のフラグ。
  // ジェスチャー終了後に consumeRecentPinch() で 1 回だけ消費される。
  let didPinch = false
  // didPinch を自動リセットするタイマー ID
  let resetTimer = null

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

      // 距離変化が閾値を超えたら「実際にピンチした」とみなす
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

      if (didPinch) {
        // 短時間後に自動リセット (consumeRecentPinch が呼ばれなかった場合の安全弁)
        clearTimeout(resetTimer)
        resetTimer = setTimeout(() => {
          didPinch = false
        }, 400)
      }
    }

    // 残りの pointer もクリアする (片方だけ残ると中途半端な状態になる)
    pointers.clear()
  }

  function onPointerCancel(e) {
    onPointerEnd(e)
  }

  /**
   * ピンチ直後の誤タップ抑止用。didPinch が true なら true を返し、
   * フラグを消費 (false に戻す)。呼び出し側は click ハンドラの先頭で
   * これを呼び、true なら early return する。
   */
  function consumeRecentPinch() {
    if (!didPinch) return false
    didPinch = false
    clearTimeout(resetTimer)
    return true
  }

  function bindPinchTarget(el) {
    if (!el) return
    boundEl = el
    // touch-action は CSS で付けるが、念のため JS からも設定する
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
    clearTimeout(resetTimer)
  })

  return {
    bindPinchTarget,
    isPinching,
    consumeRecentPinch,
  }
}
