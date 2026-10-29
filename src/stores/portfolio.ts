import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/lib/api'
import type { PortfolioSummary } from '@/lib/types'

/**
 * Equity and P&L for the sidebar. Polled while the app layout is mounted; views that trade call refresh().
 */
export const usePortfolioStore = defineStore('portfolio', () => {
  const summary = ref<PortfolioSummary | null>(null)
  let timer: ReturnType<typeof setInterval> | undefined

  async function refresh(): Promise<void> {
    try {
      const { data } = await api.get<PortfolioSummary>('/portfolio/summary')
      summary.value = data
    } catch {
      // Keep the last figures; the next poll tries again.
    }
  }

  function start(intervalMs = 20_000): void {
    stop()
    refresh()
    timer = setInterval(refresh, intervalMs)
  }

  function stop(): void {
    if (timer) clearInterval(timer)
    timer = undefined
  }

  return { summary, refresh, start, stop }
})
