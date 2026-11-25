export interface WillyBar {
  high: number
  low: number
  close: number
}

export interface WillyPoint {
  wr?: number
  ema?: number
}

/**
 * "The Willy" as on TradingView (owner, 25 Nov 2026): Williams %R over `period` candles, -100 (close at the lowest low)
 * to 0 (at the highest high), with an EMA of it over `smooth` candles seeded with its first value. Checked against
 * TradingView on ETHUSDT 4h on 25 Nov: WR21 -75.14 and EMA13 -48.29 against -75.85 and -48.12 on a live candle.
 */
export function willy(bars: WillyBar[], period = 21, smooth = 13): WillyPoint[] {
  const k = 2 / (smooth + 1)
  let ema: number | undefined
  return bars.map((bar, i) => {
    if (i < period - 1) return {}
    let highest = -Infinity
    let lowest = Infinity
    for (let j = i - period + 1; j <= i; j++) {
      highest = Math.max(highest, bars[j].high)
      lowest = Math.min(lowest, bars[j].low)
    }
    const wr = highest === lowest ? 0 : ((bar.close - highest) / (highest - lowest)) * 100
    ema = ema === undefined ? wr : ema + k * (wr - ema)
    return { wr, ema }
  })
}
