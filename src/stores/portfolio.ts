import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/lib/api'
import type { PortfolioSummary } from '@/lib/types'

/**
 * Equity and P&L for the sidebar and the portfolio page. Polled while the app layout is mounted; views
 * that trade call refresh(), and views that fetch the same figures pass them to apply(), so every place
 * shows one snapshot instead of two polls taken at different moments.
 */
export const usePortfolioStore = defineStore('portfolio', () => {
  const summary = ref<PortfolioSummary | null>(null)
  let timer: ReturnType<typeof setInterval> | undefined

  async function refresh(): Promise<void> {
    try {
      const { data } = await api.get<PortfolioSummary>('/portfolio/summary')
      apply(data)
    } catch {
      // Keep the last figures; the next poll tries again.
    }
  }

  /** Figures from any endpoint that returns them, such as GET /portfolio. */
  function apply(figures: PortfolioSummary): void {
    summary.value = {
      balance_usd: figures.balance_usd,
      holdings_value_usd: figures.holdings_value_usd,
      equity_usd: figures.equity_usd,
      starting_balance: figures.starting_balance,
      total_pnl: figures.total_pnl,
      total_pnl_pct: figures.total_pnl_pct,
      unrealized_pnl: figures.unrealized_pnl,
      realized_pnl: figures.realized_pnl,
      fees_paid: figures.fees_paid,
      trades: figures.trades,
      open_positions: figures.open_positions,
      pending_orders: figures.pending_orders,
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

  return { summary, refresh, apply, start, stop }
})
