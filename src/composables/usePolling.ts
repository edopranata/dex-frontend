import { onBeforeUnmount, onMounted } from 'vue'

/**
 * Run a callback now and every `intervalMs`, pausing while the tab is hidden.
 */
export function usePolling(callback: () => Promise<unknown> | unknown, intervalMs: number) {
  let timer: ReturnType<typeof setInterval> | undefined

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
  })

  onBeforeUnmount(() => {
    clearInterval(timer)
    document.removeEventListener('visibilitychange', onVisibility)
  })
}
