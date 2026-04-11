import { onMounted, onUnmounted } from 'vue'

// Attaches a window keydown listener for the lifetime of the calling component.
// Skips the event when focus is on a text-entry element so future forms do
// not collide with the page-level shortcuts.
export function useKeyboard(handler) {
  function wrapped(event) {
    const target = event.target
    if (target instanceof HTMLElement) {
      const tag = target.tagName
      if (
        tag === 'INPUT'
        || tag === 'TEXTAREA'
        || tag === 'SELECT'
        || target.isContentEditable
      ) {
        return
      }
    }
    handler(event)
  }

  onMounted(() => {
    window.addEventListener('keydown', wrapped)
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', wrapped)
  })
}
