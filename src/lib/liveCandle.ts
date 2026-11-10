import type { Candle } from './types'

/**
 * The candle the live price belongs in, between candle syncs. Periods are counted from 00:00 UTC, as the backend
 * builds them. The same period as the candle drawn last (live) or stored last extends that candle; a later period
 * opens a new candle at the previous close, with empty volume until it is stored. A price fetched before the
 * candles drawn returns null.
 *
 * @param fetchedAt seconds since the epoch
 * @param size the candle size in seconds
 */
export function liveCandle(stored: Candle, drawn: Candle | undefined, price: number, fetchedAt: number, size: number): Candle | null {
  const period = Math.floor(fetchedAt / size) * size
  if (period < stored.open_time || (drawn && period < drawn.open_time)) return null

  const base = drawn?.open_time === period ? drawn : period === stored.open_time ? stored : undefined
  const open = base?.open ?? (drawn ?? stored).close

  return {
    open_time: period,
    open,
    high: Math.max(base?.high ?? open, price),
    low: Math.min(base?.low ?? open, price),
    close: price,
    volume: base?.volume ?? 0,
  }
}
