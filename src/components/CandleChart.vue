<script setup lang="ts">
import {
  CandlestickSeries,
  ColorType,
  createChart,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { price as formatPrice } from '@/lib/format'
import type { Candle, Levels } from '@/lib/types'
import { themeColor, useThemeStore } from '@/stores/theme'

const theme = useThemeStore()

const props = defineProps<{ candles: Candle[]; levels?: Levels | null; livePrice?: number | null }>()

const container = ref<HTMLDivElement>()
let chart: IChartApi | undefined
let candleSeries: ISeriesApi<'Candlestick'> | undefined
let volumeSeries: ISeriesApi<'Histogram'> | undefined
let ema20Series: ISeriesApi<'Line'> | undefined
let ema50Series: ISeriesApi<'Line'> | undefined
let priceLines: IPriceLine[] = []
let lastCandle: Candle | undefined

function ema(values: number[], period: number): (number | null)[] {
  const result: (number | null)[] = values.map(() => null)
  if (values.length < period) return result
  const k = 2 / (period + 1)
  let previous = values.slice(0, period).reduce((a, b) => a + b, 0) / period
  result[period - 1] = previous
  for (let i = period; i < values.length; i++) {
    previous = (values[i] - previous) * k + previous
    result[i] = previous
  }
  return result
}

function minMove(sample: number): number {
  if (!sample || sample >= 1) return 0.0001
  const decimals = Math.min(15, Math.ceil(-Math.log10(sample)) + 4)
  return Number((10 ** -decimals).toFixed(decimals))
}

function render() {
  if (!chart || !candleSeries || !volumeSeries || !ema20Series || !ema50Series) return

  const candles = props.candles
  const sample = candles.at(-1)?.close ?? props.livePrice ?? 1
  const priceFormat = { type: 'custom' as const, formatter: (p: number) => formatPrice(p), minMove: minMove(sample) }
  candleSeries.applyOptions({ priceFormat })
  ema20Series.applyOptions({ priceFormat })
  ema50Series.applyOptions({ priceFormat })

  candleSeries.setData(candles.map((c) => ({ time: c.open_time as UTCTimestamp, open: c.open, high: c.high, low: c.low, close: c.close })))
  volumeSeries.setData(
    candles.map((c) => ({ time: c.open_time as UTCTimestamp, value: c.volume, color: c.close >= c.open ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)' })),
  )

  const closes = candles.map((c) => c.close)
  const toLine = (series: (number | null)[]) =>
    series.flatMap((value, i) => (value === null ? [] : [{ time: candles[i].open_time as UTCTimestamp, value }]))
  ema20Series.setData(toLine(ema(closes, 20)))
  ema50Series.setData(toLine(ema(closes, 50)))

  lastCandle = candles.at(-1) ? { ...candles.at(-1)! } : undefined
  drawLevels()
  chart.timeScale().fitContent()
}

function drawLevels() {
  if (!candleSeries) return
  priceLines.forEach((line) => candleSeries!.removePriceLine(line))
  priceLines = []
  const levels = props.levels
  if (!levels) return

  const lines: [number, string, string, LineStyle][] = [
    [levels.entry_high, '#3b82f6', 'Entry atas', LineStyle.Dashed],
    [levels.entry_low, '#3b82f6', 'Entry bawah', LineStyle.Dashed],
    [levels.stop_loss, '#ef4444', 'SL', LineStyle.Solid],
    [levels.take_profit_1, '#22c55e', 'TP1', LineStyle.Dotted],
    [levels.take_profit_2, '#22c55e', 'TP2', LineStyle.Dotted],
    [levels.take_profit_3, '#22c55e', 'TP3', LineStyle.Dotted],
  ]
  for (const [p, color, title, lineStyle] of lines) {
    priceLines.push(candleSeries.createPriceLine({ price: p, color, title, lineStyle, lineWidth: 1, axisLabelVisible: true }))
  }
}

/** Canvas colors from the current theme's tokens; re-applied when the theme changes. */
function themeOptions() {
  const line = themeColor('line')
  return {
    layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: themeColor('muted'), fontSize: 11 },
    grid: { vertLines: { color: `${line}80` }, horzLines: { color: `${line}80` } },
    rightPriceScale: { borderColor: line },
    timeScale: { borderColor: line, timeVisible: true, secondsVisible: false },
  }
}

function candleColors() {
  const up = themeColor('up')
  const down = themeColor('down')
  return { upColor: up, downColor: down, wickUpColor: up, wickDownColor: down }
}

onMounted(() => {
  chart = createChart(container.value!, { autoSize: true, crosshair: { mode: CrosshairMode.Normal }, ...themeOptions() })

  candleSeries = chart.addSeries(CandlestickSeries, { borderVisible: false, ...candleColors() })
  volumeSeries = chart.addSeries(HistogramSeries, { priceScaleId: 'volume', priceFormat: { type: 'volume' }, lastValueVisible: false, priceLineVisible: false })
  chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } })
  ema20Series = chart.addSeries(LineSeries, { color: '#f59e0b', lineWidth: 1, lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false })
  ema50Series = chart.addSeries(LineSeries, { color: '#a78bfa', lineWidth: 1, lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false })

  render()
})

onBeforeUnmount(() => chart?.remove())

watch(() => props.candles, render)
watch(
  () => theme.resolved,
  () => {
    chart?.applyOptions(themeOptions())
    candleSeries?.applyOptions(candleColors())
  },
)
watch(() => props.levels, drawLevels)

// Move the last candle with the live price between candle syncs.
watch(
  () => props.livePrice,
  (live) => {
    if (!live || !lastCandle || !candleSeries) return
    lastCandle.close = live
    lastCandle.high = Math.max(lastCandle.high, live)
    lastCandle.low = Math.min(lastCandle.low, live)
    candleSeries.update({ time: lastCandle.open_time as UTCTimestamp, open: lastCandle.open, high: lastCandle.high, low: lastCandle.low, close: lastCandle.close })
  },
)
</script>

<template>
  <div class="relative h-full w-full">
    <div ref="container" class="h-full w-full" />
    <div class="pointer-events-none absolute top-2 left-3 flex gap-3 text-[11px]">
      <span class="text-amber-600 dark:text-amber-400">EMA20</span>
      <span class="text-violet-700 dark:text-violet-400">EMA50</span>
    </div>
  </div>
</template>
