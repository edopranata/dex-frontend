<script setup lang="ts">
import {
  CandlestickSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { price as formatPrice } from '@/lib/format'
import { liveCandle } from '@/lib/liveCandle'
import type { Candle, ChartMarker, Levels } from '@/lib/types'
import { themeColor, useThemeStore } from '@/stores/theme'

const theme = useThemeStore()

/**
 * seriesKey names what the candles are (token and timeframe). A new key draws the chart afresh and fits it;
 * a refresh of the same series only updates the latest candles, so the user's zoom and scroll stay.
 *
 * The stored candles lag the 15-second price by up to about 15 minutes. livePrice, with livePriceAt (when it was
 * fetched) and intervalSeconds (the candle size), keeps the candle of the current period moving until it is stored.
 */
const props = defineProps<{
  candles: Candle[]
  seriesKey?: string
  intervalSeconds?: number
  levels?: Levels | null
  livePrice?: number | null
  livePriceAt?: string | null
  markers?: ChartMarker[]
}>()

const container = ref<HTMLDivElement>()
let chart: IChartApi | undefined
let candleSeries: ISeriesApi<'Candlestick'> | undefined
let volumeSeries: ISeriesApi<'Histogram'> | undefined
let ema20Series: ISeriesApi<'Line'> | undefined
let ema50Series: ISeriesApi<'Line'> | undefined
let priceLines: IPriceLine[] = []
let markerPlugin: ISeriesMarkersPluginApi<Time> | undefined
/** The newest stored candle drawn. */
let storedLast: Candle | undefined
/** The candle the live price drew: on the newest stored candle's period or a later one. */
let liveBar: Candle | undefined
let renderedKey: string | undefined
let levelsKey = ''

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

function bar(c: Candle) {
  return { time: c.open_time as UTCTimestamp, open: c.open, high: c.high, low: c.low, close: c.close }
}

function volumeBar(c: Candle) {
  return { time: c.open_time as UTCTimestamp, value: c.volume, color: c.close >= c.open ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)' }
}

/**
 * A refresh of the same token and timeframe: update the candles from the last one drawn onwards. Unlike
 * setData and fitContent, this keeps the zoom (both axes) and scroll the user chose.
 */
function refresh() {
  const candles = props.candles
  const from = storedLast?.open_time
  const newest = candles.at(-1)

  if (!candleSeries || !volumeSeries || !ema20Series || !ema50Series || from === undefined || !newest || newest.open_time < from || props.seriesKey !== renderedKey) {
    render()

    return
  }

  // A stored candle for a period before the live candle cannot be slotted in by an update: redraw, keeping the view.
  const live = liveBar
  if (live && candles.some((c) => c.open_time > from && c.open_time < live.open_time)) {
    render(true)

    return
  }

  const closes = candles.map((c) => c.close)
  const ema20 = ema(closes, 20)
  const ema50 = ema(closes, 50)

  candles.forEach((c, i) => {
    if (c.open_time < from) return
    // A stored candle before the live candle already drawn is a historical update (allowed only for existing points).
    candleSeries!.update(bar(c), live !== undefined && c.open_time < live.open_time)
    volumeSeries!.update(volumeBar(c))
    if (ema20[i] !== null) ema20Series!.update({ time: c.open_time as UTCTimestamp, value: ema20[i]! })
    if (ema50[i] !== null) ema50Series!.update({ time: c.open_time as UTCTimestamp, value: ema50[i]! })
  })

  storedLast = { ...newest }
  if (liveBar && liveBar.open_time <= newest.open_time) liveBar = undefined
  drawMarkers()
  applyLivePrice()
}

/** keepView redraws the same series after a gap was filled, without resetting the user's zoom and scroll. */
function render(keepView = false) {
  if (!chart || !candleSeries || !volumeSeries || !ema20Series || !ema50Series) return

  const visible = keepView ? chart.timeScale().getVisibleRange() : null
  const candles = props.candles
  const sample = candles.at(-1)?.close ?? props.livePrice ?? 1
  const priceFormat = { type: 'custom' as const, formatter: (p: number) => formatPrice(p), minMove: minMove(sample) }
  candleSeries.applyOptions({ priceFormat })
  ema20Series.applyOptions({ priceFormat })
  ema50Series.applyOptions({ priceFormat })

  candleSeries.setData(candles.map(bar))
  volumeSeries.setData(candles.map(volumeBar))

  const closes = candles.map((c) => c.close)
  const toLine = (series: (number | null)[]) =>
    series.flatMap((value, i) => (value === null ? [] : [{ time: candles[i].open_time as UTCTimestamp, value }]))
  ema20Series.setData(toLine(ema(closes, 20)))
  ema50Series.setData(toLine(ema(closes, 50)))

  storedLast = candles.at(-1) ? { ...candles.at(-1)! } : undefined
  liveBar = undefined
  renderedKey = props.seriesKey
  drawMarkers()
  applyLivePrice()

  if (keepView) {
    if (visible) chart.timeScale().setVisibleRange(visible)

    return
  }

  levelsKey = ''
  drawLevels()
  chart.timeScale().fitContent()
  // A new series starts with the price axis following the candles again.
  candleSeries.priceScale().setAutoScale(true)
}

/** Draws the live price into the candle of the period it was fetched in. */
function applyLivePrice() {
  const live = props.livePrice
  const size = props.intervalSeconds
  if (!live || !size || !storedLast || !candleSeries) return

  const fetchedAt = props.livePriceAt ? Date.parse(props.livePriceAt) / 1000 : Date.now() / 1000
  if (!Number.isFinite(fetchedAt)) return

  const next = liveCandle(storedLast, liveBar, live, fetchedAt, size)
  if (!next) return
  liveBar = next
  candleSeries.update(bar(next))
}

function drawLevels() {
  if (!candleSeries) return
  const levels = props.levels
  // The token reloads every few seconds with the same levels: redraw only when they change.
  const key = levels ? [levels.entry_high, levels.entry_low, levels.stop_loss, levels.take_profit_1, levels.take_profit_2, levels.take_profit_3].join('|') : ''
  if (key === levelsKey) return
  levelsKey = key
  priceLines.forEach((line) => candleSeries!.removePriceLine(line))
  priceLines = []
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

/** Each fill sits on the candle it happened in, so it follows the chosen timeframe. */
function drawMarkers() {
  if (!markerPlugin) return
  const times = props.candles.map((c) => c.open_time)
  const markers: SeriesMarker<Time>[] = []
  for (const m of props.markers ?? []) {
    let index = -1
    for (let i = times.length - 1; i >= 0; i--) {
      if (times[i] <= m.time) {
        index = i
        break
      }
    }
    if (index < 0) continue
    markers.push({
      time: times[index] as UTCTimestamp,
      position: m.side === 'buy' ? 'belowBar' : 'aboveBar',
      shape: m.side === 'buy' ? 'arrowUp' : 'arrowDown',
      color: m.side === 'buy' ? '#3b82f6' : m.tone === 'down' ? '#ef4444' : '#22c55e',
      text: m.text,
    })
  }
  markers.sort((a, b) => (a.time as number) - (b.time as number))
  markerPlugin.setMarkers(markers)
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
  markerPlugin = createSeriesMarkers(candleSeries, [])

  render()
})

onBeforeUnmount(() => chart?.remove())

watch(() => props.candles, refresh)
watch(
  () => theme.resolved,
  () => {
    chart?.applyOptions(themeOptions())
    candleSeries?.applyOptions(candleColors())
  },
)
watch(() => props.levels, drawLevels)
watch(() => props.markers, drawMarkers)

// The time matters too: the same price fetched in a new period opens a new candle.
watch(() => [props.livePrice, props.livePriceAt], applyLivePrice)
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
