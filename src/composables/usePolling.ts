import { onBeforeUnmount, onMounted } from 'vue'
import { useRefreshStore } from '@/stores/refresh'

/**
 * Run a callback now and every `intervalMs`, pausing while the tab is hidden. The callback also
 * runs when the toolbar's refresh button is pressed.
 */
export function usePolling(callback: () => Promise<unknown> | unknown, intervalMs: number) {
  const refresh = useRefreshStore()
  let timer: ReturnType<typeof setInterval> | undefined
  let unregister: (() => void) | undefined

  const tick = () => {
    if (document.visibilityState === 'visible') callback()
  }

  const onVisibility = () => {
    if (document.visibilityState === 'visible') callback()
  }

  onMounted(() => {
    callback()
    timer = setInterval(tick, intervalMs)
    document.addEventListener('visibilitychange', onVisibility)
    unregister = refresh.register(callback)
  })

  onBeforeUnmount(() => {
    clearInterval(timer)
    document.removeEventListener('visibilitychange', onVisibility)
    unregister?.()
  })
}

/**
 * Load once when the page opens, and again when the toolbar's refresh button is pressed.
 */
export function usePageData(callback: () => Promise<unknown> | unknown) {
  const refresh = useRefreshStore()
  let unregister: (() => void) | undefined

  onMounted(() => {
    callback()
    unregister = refresh.register(callback)
  })

  onBeforeUnmount(() => unregister?.())
}
