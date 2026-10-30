import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * The thin bar at the top of the page. It runs while something the user started is loading:
 * a page change (and the API calls the new page makes) or the refresh button. Background
 * polling never shows it.
 */
export const useProgressStore = defineStore('progress', () => {
  const visible = ref(false)
  const value = ref(0)

  let holds = 0
  let requests = 0
  let trickle: ReturnType<typeof setInterval> | undefined
  let hide: ReturnType<typeof setTimeout> | undefined

  /** True while API calls should be counted as part of the current load. */
  function tracking(): boolean {
    return holds > 0
  }

  function start() {
    holds++
    clearTimeout(hide)
    if (!visible.value) {
      visible.value = true
      value.value = 8
    }
    clearInterval(trickle)
    // Creep towards 90% so a slow load still shows movement.
    trickle = setInterval(() => (value.value += (90 - value.value) * 0.08), 200)
  }

  function done() {
    holds = Math.max(0, holds - 1)
    finishIfIdle()
  }

  function requestStarted() {
    requests++
  }

  function requestFinished() {
    requests = Math.max(0, requests - 1)
    finishIfIdle()
  }

  function finishIfIdle() {
    if (holds > 0 || requests > 0 || !visible.value) return
    clearInterval(trickle)
    value.value = 100
    hide = setTimeout(() => {
      visible.value = false
      value.value = 0
    }, 280)
  }

  return { visible, value, tracking, start, done, requestStarted, requestFinished }
})
