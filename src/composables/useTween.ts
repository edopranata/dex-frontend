import { onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'

const reducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * Smoothly animate a number towards its source value (ease-out cubic).
 * With `fromZero`, the first value also animates up from 0 on mount.
 */
export function useTween(source: Ref<number | null | undefined>, duration = 700, options: { fromZero?: boolean } = {}) {
  const value = ref<number | null>(options.fromZero ? 0 : (source.value ?? null))
  let frame = 0

  function animateTo(target: number | null | undefined) {
    cancelAnimationFrame(frame)
    if (target === null || target === undefined) {
      value.value = null
      return
    }
    const from = value.value ?? 0
    if (reducedMotion || from === target) {
      value.value = target
      return
    }
    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      value.value = from + (target - from) * (1 - (1 - t) ** 3)
      if (t < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
  }

  watch(source, animateTo)
  onMounted(() => {
    if (options.fromZero) animateTo(source.value)
  })
  onBeforeUnmount(() => cancelAnimationFrame(frame))

  return value
}
