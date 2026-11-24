<script setup lang="ts">
import { dispose, init, registerLocale, registerOverlay, type Chart, type KLineData, type OverlayEvent } from 'klinecharts'
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { price as formatPrice } from '@/lib/format'
import { liveCandle } from '@/lib/liveCandle'
import type { Candle, ChartMarker, Levels } from '@/lib/types'
import { themeColor, useThemeStore } from '@/stores/theme'

const theme = useThemeStore()

/**
 * Candle chart on KLineChart (owner, 24 Nov 2026: indicators and drawings as on the exchanges' charts).
 *
 * seriesKey names what the candles are (instrument and timeframe). A new key loads the chart afresh; a refresh of the
 * same series only feeds the latest candles, so the user's zoom and scroll stay.
 *
 * The stored candles lag the live price. livePrice, with livePriceAt (when it was fetched) and intervalSeconds (the
 * candle size), keeps the candle of the current period moving until it is stored.
 *
 * drawingKey (the instrument) is where the user's drawings are kept in this browser; they show on every timeframe.
 * The indicators chosen are kept per browser for every chart.
 */
const props = defineProps<{
  candles: Candle[]
  seriesKey?: string
  intervalSeconds?: number
  levels?: Levels | null
  livePrice?: number | null
  livePriceAt?: string | null
  markers?: ChartMarker[]
  drawingKey?: string
}>()

const STORAGE_INDICATORS = 'chart:indicators:v1'
const STORAGE_DRAWINGS = 'chart:drawings:v1:'
const STORAGE_HEIGHT = 'chart:height:v1'
const MIN_HEIGHT = 300
const MAX_HEIGHT = 1600
const MAIN_PANE = 'candle_pane'
const MAIN_INDICATORS = ['MA', 'EMA', 'SMA', 'BOLL', 'SAR', 'BBI', 'AVP']
const SUB_INDICATORS = ['VOL', 'MACD', 'RSI', 'KDJ', 'OBV', 'CCI', 'DMI', 'WR', 'ROC', 'MTM', 'TRIX', 'AO', 'PSY', 'BIAS', 'BRAR', 'CR', 'DMA', 'EMV', 'PVT', 'VR']
const INDICATOR_NAMES: Record<string, string> = {
  MA: 'Moving average', EMA: 'Exponential MA', SMA: 'SMA (rata-rata berbobot)', BOLL: 'Bollinger Bands', SAR: 'Parabolic SAR', BBI: 'Bull and bear index', AVP: 'Harga rata-rata',
  VOL: 'Volume', MACD: 'MACD', RSI: 'RSI', KDJ: 'KDJ (stochastic)', OBV: 'On balance volume', CCI: 'Commodity channel index', DMI: 'DMI / ADX', WR: 'Williams %R',
  ROC: 'Rate of change', MTM: 'Momentum', TRIX: 'TRIX', AO: 'Awesome oscillator', PSY: 'Psychological line', BIAS: 'Bias', BRAR: 'BRAR', CR: 'CR', DMA: 'DMA', EMV: 'Ease of movement', PVT: 'Price volume trend', VR: 'Volume ratio',
}
const TOOLS: { name: string; label: string; icon: string; text?: boolean }[] = [
  { name: 'segment', label: 'Garis tren', icon: 'M4 20 20 4' },
  { name: 'rayLine', label: 'Ray', icon: 'M4 20 14 10M14 10l6-6' },
  { name: 'straightLine', label: 'Garis panjang', icon: 'M2 22 22 2' },
  { name: 'horizontalStraightLine', label: 'Garis horizontal', icon: 'M2 12h20' },
  { name: 'horizontalRayLine', label: 'Ray horizontal', icon: 'M6 12h16M6 9v6' },
  { name: 'verticalStraightLine', label: 'Garis vertikal', icon: 'M12 2v20' },
  { name: 'priceLine', label: 'Garis harga', icon: 'M4 14h16M4 14V9h6' },
  { name: 'parallelStraightLine', label: 'Channel paralel', icon: 'M3 17 17 3M7 21 21 7' },
  { name: 'priceChannelLine', label: 'Channel harga', icon: 'M3 15 15 3M3 21 21 9M9 21 21 15' },
  { name: 'fibonacciLine', label: 'Fibonacci retracement', icon: 'M3 4h18M3 9h18M3 13h18M3 20h18' },
  { name: 'rectBox', label: 'Kotak', icon: 'M4 6h16v12H4z' },
  { name: 'circleShape', label: 'Lingkaran', icon: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16' },
  { name: 'brush', label: 'Kuas (gambar bebas)', icon: 'M3 17c3-6 6 2 9-4s5-5 9-2' },
  { name: 'simpleAnnotation', label: 'Catatan berpanah', icon: 'M12 21V9M8 13l4-4 4 4M5 3h14v4H5z', text: true },
  { name: 'textNote', label: 'Teks', icon: 'M5 5h14M12 5v14', text: true },
]

registerLocale('id-ID', {
  time: 'Waktu: ', open: 'Buka: ', high: 'Tinggi: ', low: 'Rendah: ', close: 'Tutup: ', volume: 'Volume: ', change: 'Perubahan: ', turnover: 'Turnover: ',
  second: 'detik', minute: 'menit', hour: 'jam', day: 'hari', week: 'minggu', month: 'bulan', year: 'tahun',
})

const DRAW_BLUE = '#3b82f6'

/** A box between two points (KLineChart has the figure, not the drawing tool). */
registerOverlay({
  name: 'rectBox',
  totalStep: 3,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: true,
  needDefaultYAxisFigure: true,
  createPointFigures: ({ coordinates }) => {
    if (coordinates.length < 2) return []
    const [a, b] = coordinates
    return [{ type: 'rect', attrs: { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) }, styles: { style: 'stroke_fill', color: 'rgba(59,130,246,0.12)', borderColor: DRAW_BLUE, borderSize: 1 } }]
  },
})

/** A circle: the centre, then a point on its edge. */
registerOverlay({
  name: 'circleShape',
  totalStep: 3,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: true,
  needDefaultYAxisFigure: true,
  createPointFigures: ({ coordinates }) => {
    if (coordinates.length < 2) return []
    const [a, b] = coordinates
    return [{ type: 'circle', attrs: { x: a.x, y: a.y, r: Math.hypot(b.x - a.x, b.y - a.y) }, styles: { style: 'stroke_fill', color: 'rgba(59,130,246,0.12)', borderColor: DRAW_BLUE, borderSize: 1 } }]
  },
})

/** Free text at one point; the text is the overlay's extendData. */
registerOverlay<string>({
  name: 'textNote',
  totalStep: 2,
  needDefaultPointFigure: true,
  createPointFigures: ({ overlay, coordinates }) => [
    { type: 'text', attrs: { x: coordinates[0].x, y: coordinates[0].y, text: overlay.extendData ?? '', baseline: 'bottom' }, styles: { color: DRAW_BLUE, backgroundColor: 'transparent', size: 12, paddingLeft: 0, paddingRight: 0, paddingTop: 0, paddingBottom: 0 } },
  ],
})

/** Entry, stop and target lines across the chart, with the price on the axis. Not editable. */
registerOverlay<{ label: string; color: string; dashed: boolean }>({
  name: 'levelLine',
  totalStep: 2,
  lock: true,
  needDefaultPointFigure: false,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
  createPointFigures: ({ overlay, coordinates, bounding }) => {
    const y = coordinates[0].y
    const { label, color, dashed } = overlay.extendData
    return [
      { type: 'line', ignoreEvent: true, attrs: { coordinates: [{ x: 0, y }, { x: bounding.width, y }] }, styles: { style: dashed ? 'dashed' : 'solid', color, size: 1, dashedValue: [4, 3] } },
      { type: 'text', ignoreEvent: true, attrs: { x: 6, y: y - 2, text: label, baseline: 'bottom' }, styles: { color, backgroundColor: 'transparent', size: 11, paddingLeft: 0, paddingRight: 0, paddingTop: 0, paddingBottom: 0 } },
    ]
  },
  createYAxisFigures: ({ overlay, coordinates }) => [
    {
      type: 'text',
      ignoreEvent: true,
      attrs: { x: 0, y: coordinates[0].y, text: formatPrice(overlay.points[0].value ?? 0).replace('$', ''), align: 'left', baseline: 'middle' },
      styles: { color: '#ffffff', backgroundColor: overlay.extendData.color, size: 11, paddingLeft: 3, paddingRight: 3, paddingTop: 2, paddingBottom: 2, borderRadius: 2 },
    },
  ],
})

/** A fill: an arrow under the candle for a buy, over it for a sell, with its text. */
registerOverlay<{ side: 'buy' | 'sell'; text: string; color: string }>({
  name: 'tradeMarker',
  totalStep: 2,
  lock: true,
  needDefaultPointFigure: false,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
  createPointFigures: ({ overlay, coordinates }) => {
    const { x, y } = coordinates[0]
    const { side, text, color } = overlay.extendData
    const away = side === 'buy' ? 1 : -1
    const tip = y + away * 6
    const base = tip + away * 8
    return [
      { type: 'polygon', ignoreEvent: true, attrs: { coordinates: [{ x, y: tip }, { x: x - 5, y: base }, { x: x + 5, y: base }] }, styles: { style: 'fill', color } },
      { type: 'text', ignoreEvent: true, attrs: { x, y: base + away * 2, text, align: 'center', baseline: side === 'buy' ? 'top' : 'bottom' }, styles: { color, backgroundColor: 'transparent', size: 10, paddingLeft: 0, paddingRight: 0, paddingTop: 0, paddingBottom: 0 } },
    ]
  },
})

const container = ref<HTMLDivElement>()
let chart: Chart | null = null
let pushBar: ((bar: KLineData) => void) | null = null
let resizeObserver: ResizeObserver | undefined
/** The newest stored candle drawn. */
let storedLast: Candle | undefined
/** The candle the live price drew: on the newest stored candle's period or a later one. */
let liveBar: Candle | undefined
let renderedKey: string | undefined
let levelsKey = ''
/** Set while drawings are swapped or the chart is disposed, so their removal does not overwrite what is stored. */
let quiet = false

const menu = ref<'' | 'indicators'>('')

/** The card's height, dragged from the handle under the chart and kept in this browser (one height for every chart). */
function defaultHeight(): number {
  return window.innerWidth < 640 ? 400 : 520
}
function savedHeight(): number {
  try {
    const value = Number(localStorage.getItem(STORAGE_HEIGHT))
    if (value >= MIN_HEIGHT && value <= MAX_HEIGHT) return value
  } catch {
    // Blocked storage: the default height.
  }
  return defaultHeight()
}
const height = ref(savedHeight())
let dragFrom: { y: number; height: number } | null = null

function saveHeight() {
  try {
    localStorage.setItem(STORAGE_HEIGHT, String(height.value))
  } catch {
    // Not kept in this browser.
  }
}

function startResize(event: PointerEvent) {
  dragFrom = { y: event.clientY, height: height.value }
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

function moveResize(event: PointerEvent) {
  if (!dragFrom) return
  height.value = Math.round(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, dragFrom.height + event.clientY - dragFrom.y)))
}

function endResize() {
  if (!dragFrom) return
  dragFrom = null
  saveHeight()
}

function resetHeight() {
  height.value = defaultHeight()
  saveHeight()
}
/** The drawing picked by a click or tap, for the remove button (no right click on a phone). */
const selected = ref('')
/** Under 640px the OHLC legends show only while the chart is touched, so they do not cover the candles. */
let narrow = false
const magnet = ref(false)
const activeTool = ref('')

interface IndicatorChoice {
  name: string
  params: string
}
const chosen = reactive<{ main: IndicatorChoice[]; sub: IndicatorChoice[] }>(loadIndicators())

function loadIndicators(): { main: IndicatorChoice[]; sub: IndicatorChoice[] } {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_INDICATORS) ?? 'null')
    if (saved && Array.isArray(saved.main) && Array.isArray(saved.sub)) return saved
  } catch {
    // A private window or blocked storage: the default set.
  }
  return { main: [{ name: 'EMA', params: '20,50' }], sub: [{ name: 'VOL', params: '' }] }
}

function saveIndicators() {
  try {
    localStorage.setItem(STORAGE_INDICATORS, JSON.stringify(chosen))
  } catch {
    // Not kept in this browser; the chart still works.
  }
}

function parseParams(text: string): number[] | undefined {
  const values = text.split(/[,\s]+/).filter(Boolean).map(Number)
  return values.length && values.every((v) => Number.isFinite(v) && v > 0) ? values : undefined
}

function toBar(c: Candle): KLineData {
  return { timestamp: c.open_time * 1000, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume }
}

const SUBSCRIPT = '₀₁₂₃₄₅₆₇₈₉'

/** Long runs of zeros after the point as 0.0₄1234, the way the rest of the app writes small prices. */
function foldZeros(value: string | number): string {
  const text = String(value)
  const match = /^(-?)0\.(0{4,})(\d+)$/.exec(text)
  if (!match) return text
  const count = String(match[2].length).split('').map((d) => SUBSCRIPT[Number(d)]).join('')
  return `${match[1]}0.0${count}${match[3]}`
}

function precision(sample: number): number {
  if (!sample || sample >= 1000) return 2
  if (sample >= 1) return 4
  return Math.min(15, Math.ceil(-Math.log10(sample)) + 3)
}

function period(seconds: number) {
  if (seconds >= 86400) return { type: 'day' as const, span: Math.round(seconds / 86400) }
  if (seconds >= 3600) return { type: 'hour' as const, span: Math.round(seconds / 3600) }
  return { type: 'minute' as const, span: Math.max(1, Math.round(seconds / 60)) }
}

/** A new series (instrument or timeframe): the data loader is asked for it again. */
function render() {
  if (!chart) return
  const sample = props.candles.at(-1)?.close ?? props.livePrice ?? 1
  if (renderedKey !== undefined && renderedKey === props.seriesKey) {
    chart.resetData()
    return
  }
  renderedKey = props.seriesKey
  chart.setPeriod(period(props.intervalSeconds ?? 3600))
  chart.setSymbol({ ticker: props.seriesKey ?? 'chart', pricePrecision: precision(sample), volumePrecision: 2 })
}

/** Called by the chart once the series' candles are in. */
function loaded() {
  storedLast = props.candles.at(-1) ? { ...props.candles.at(-1)! } : undefined
  liveBar = undefined
  levelsKey = ''
  drawLevels()
  drawMarkers()
  restoreDrawings()
  applyLivePrice()
}

/**
 * A refresh of the same instrument and timeframe: feed the candles from the last one drawn onwards, which keeps the
 * zoom and scroll. A stored candle for a period before the live candle cannot be slotted in: reload the series.
 */
function refresh() {
  const candles = props.candles
  const from = storedLast?.open_time
  const newest = candles.at(-1)

  if (!chart || !pushBar || from === undefined || !newest || newest.open_time < from || props.seriesKey !== renderedKey) {
    render()
    return
  }

  const live = liveBar
  if (live && candles.some((c) => c.open_time > from && c.open_time < live.open_time)) {
    chart.resetData()
    return
  }

  for (const c of candles) {
    if (c.open_time >= from) pushBar(toBar(c))
  }
  storedLast = { ...newest }
  if (liveBar && liveBar.open_time <= newest.open_time) liveBar = undefined
  drawMarkers()
  applyLivePrice()
}

/** Draws the live price into the candle of the period it was fetched in. */
function applyLivePrice() {
  const live = props.livePrice
  const size = props.intervalSeconds
  if (!live || !size || !storedLast || !pushBar) return

  const fetchedAt = props.livePriceAt ? Date.parse(props.livePriceAt) / 1000 : Date.now() / 1000
  if (!Number.isFinite(fetchedAt)) return

  const next = liveCandle(storedLast, liveBar, live, fetchedAt, size)
  if (!next) return
  liveBar = next
  pushBar(toBar(next))
}

function drawLevels() {
  if (!chart || !storedLast) return
  const levels = props.levels
  // The page reloads every few seconds with the same levels: redraw only when they change.
  const key = levels ? [levels.entry_high, levels.entry_low, levels.stop_loss, levels.take_profit_1, levels.take_profit_2, levels.take_profit_3].join('|') : ''
  if (key === levelsKey) return
  levelsKey = key
  chart.removeOverlay({ groupId: 'levels' })
  if (!levels) return

  const blue = '#3b82f6'
  const green = '#22c55e'
  // One entry price (a filled position) is one line; a zone is two.
  const lines: [number, string, string, boolean][] = [
    ...(levels.entry_high === levels.entry_low
      ? ([[levels.entry_high, blue, 'Beli', true]] as [number, string, string, boolean][])
      : ([
          [levels.entry_high, blue, 'Entry atas', true],
          [levels.entry_low, blue, 'Entry bawah', true],
        ] as [number, string, string, boolean][])),
    [levels.stop_loss, '#ef4444', 'SL', false],
    [levels.take_profit_1, green, 'TP1', true],
    [levels.take_profit_2, green, 'TP2', true],
    [levels.take_profit_3, green, 'TP3', true],
  ]
  const at = storedLast.open_time * 1000
  chart.createOverlay(lines.map(([value, color, label, dashed]) => ({ name: 'levelLine', groupId: 'levels', lock: true, zLevel: -1, points: [{ timestamp: at, value }], extendData: { label, color, dashed } })))
}

/** Each fill sits on the candle it happened in, so it follows the chosen timeframe. */
function drawMarkers() {
  if (!chart) return
  chart.removeOverlay({ groupId: 'markers' })
  const candles = props.candles
  const overlays = []
  for (const m of props.markers ?? []) {
    let index = -1
    for (let i = candles.length - 1; i >= 0; i--) {
      if (candles[i].open_time <= m.time) {
        index = i
        break
      }
    }
    if (index < 0) continue
    const c = candles[index]
    overlays.push({
      name: 'tradeMarker',
      groupId: 'markers',
      lock: true,
      points: [{ timestamp: c.open_time * 1000, value: m.side === 'buy' ? c.low : c.high }],
      extendData: { side: m.side, text: m.text, color: m.side === 'buy' ? '#3b82f6' : m.tone === 'down' ? '#ef4444' : '#22c55e' },
    })
  }
  if (overlays.length) chart.createOverlay(overlays)
}

// --- Indicators ---

function applyIndicators() {
  if (!chart) return
  chart.removeIndicator()
  for (const i of chosen.main) {
    const calcParams = parseParams(i.params)
    chart.createIndicator({ name: i.name, paneId: MAIN_PANE, ...(calcParams ? { calcParams } : {}) }, true)
  }
  for (const i of chosen.sub) {
    const calcParams = parseParams(i.params)
    chart.createIndicator({ name: i.name, ...(calcParams ? { calcParams } : {}) })
  }
}

function defaultParams(name: string): string {
  // KLineChart's own RSI default is 6, 12, 24; the exchanges show 14.
  return ({ EMA: '20,50', RSI: '14' } as Record<string, string>)[name] ?? ''
}

function toggleIndicator(group: 'main' | 'sub', name: string) {
  const list = chosen[group]
  const at = list.findIndex((i) => i.name === name)
  if (at >= 0) list.splice(at, 1)
  else list.push({ name, params: defaultParams(name) })
  saveIndicators()
  applyIndicators()
}

function changeParams(group: 'main' | 'sub', choice: IndicatorChoice, text: string) {
  choice.params = text
  saveIndicators()
  if (!chart) return
  const calcParams = parseParams(text)
  if (calcParams) chart.overrideIndicator({ name: choice.name, ...(group === 'main' ? { paneId: MAIN_PANE } : {}), calcParams })
}

const activeNames = computed(() => new Set([...chosen.main, ...chosen.sub].map((i) => i.name)))

// --- Drawings ---

interface SavedDrawing {
  name: string
  points: { timestamp: number; value: number }[]
  extendData?: unknown
}

function drawingsStorage(): string | null {
  return props.drawingKey ? STORAGE_DRAWINGS + props.drawingKey : null
}

function saveDrawings() {
  const key = drawingsStorage()
  if (!chart || !key || quiet) return
  // Finished drawings only (currentStep -1); one still being drawn is saved when it ends.
  const drawings: SavedDrawing[] = chart
    .getOverlays({ groupId: 'drawings' })
    .filter((o) => o.currentStep === -1)
    .map((o) => ({ name: o.name, points: o.points.map((p) => ({ timestamp: p.timestamp ?? 0, value: p.value ?? 0 })), extendData: o.extendData }))
  try {
    localStorage.setItem(key, JSON.stringify(drawings))
  } catch {
    // Not kept in this browser.
  }
}

const drawingEvents = {
  onDrawEnd: () => {
    activeTool.value = ''
    saveDrawings()
  },
  onPressedMoveEnd: () => saveDrawings(),
  onSelected: (event: OverlayEvent<unknown>) => {
    selected.value = event.overlay.id
  },
  onDeselected: () => {
    selected.value = ''
  },
  // KLineChart calls onRemoved before taking the drawing out of its list (a right click removes one by default).
  onRemoved: () => {
    if (!quiet) setTimeout(saveDrawings, 0)
  },
}

function restoreDrawings() {
  if (!chart) return
  quiet = true
  chart.removeOverlay({ groupId: 'drawings' })
  quiet = false
  const key = drawingsStorage()
  if (!key) return
  let saved: SavedDrawing[] = []
  try {
    saved = JSON.parse(localStorage.getItem(key) ?? '[]')
  } catch {
    saved = []
  }
  if (!Array.isArray(saved) || !saved.length) return
  chart.createOverlay(saved.map((d) => ({ name: d.name, groupId: 'drawings', points: d.points, extendData: d.extendData, mode: magnet.value ? ('weak_magnet' as const) : ('normal' as const), ...drawingEvents })))
}

function startTool(tool: (typeof TOOLS)[number]) {
  if (!chart) return
  let extendData: string | undefined
  if (tool.text) {
    const text = window.prompt('Teks', '')
    if (!text) return
    extendData = text
  }
  activeTool.value = tool.name
  chart.createOverlay({ name: tool.name, groupId: 'drawings', extendData, mode: magnet.value ? 'weak_magnet' : 'normal', ...drawingEvents })
}

function removeSelected() {
  if (!chart || !selected.value) return
  chart.removeOverlay({ id: selected.value })
  selected.value = ''
}

function clearDrawings() {
  if (!chart || !chart.getOverlays({ groupId: 'drawings' }).length) return
  if (!window.confirm('Hapus semua gambar di grafik ini?')) return
  chart.removeOverlay({ groupId: 'drawings' })
  saveDrawings()
}

// --- Theme ---

function styles() {
  const up = themeColor('up')
  const down = themeColor('down')
  const line = themeColor('line')
  const muted = themeColor('muted')
  const text = themeColor('text')
  const panel = themeColor('panel')
  const axis = { axisLine: { color: line }, tickLine: { color: line }, tickText: { color: muted, size: 11 } }
  return {
    grid: { horizontal: { color: `${line}80` }, vertical: { color: `${line}80` } },
    candle: {
      bar: { upColor: up, downColor: down, noChangeColor: muted, upBorderColor: up, downBorderColor: down, noChangeBorderColor: muted, upWickColor: up, downWickColor: down, noChangeWickColor: muted },
      priceMark: { high: { color: muted }, low: { color: muted }, last: { upColor: up, downColor: down, noChangeColor: muted } },
      // The page names the instrument and timeframe already.
      tooltip: { showRule: narrow ? ('follow_cross' as const) : ('always' as const), title: { show: false }, legend: { color: muted } },
    },
    indicator: {
      ohlc: { upColor: up, downColor: down, noChangeColor: muted },
      bars: [{ upColor: `${up}99`, downColor: `${down}99`, noChangeColor: `${muted}99` }],
      tooltip: { showRule: narrow ? ('follow_cross' as const) : ('always' as const), title: { color: text }, legend: { color: muted } },
    },
    xAxis: axis,
    yAxis: axis,
    separator: { color: line },
    crosshair: {
      horizontal: { line: { color: muted }, text: { backgroundColor: panel, borderColor: line, color: text } },
      vertical: { line: { color: muted }, text: { backgroundColor: panel, borderColor: line, color: text } },
    },
  }
}

onMounted(() => {
  narrow = container.value!.clientWidth < 640
  chart = init(container.value!, { locale: 'id-ID', timezone: 'Asia/Jakarta', styles: styles(), decimalFold: { threshold: 4, format: foldZeros } })
  if (!chart) return
  chart.setDataLoader({
    getBars: ({ type, callback }) => {
      // Only the stored candles of this series: no older pages to scroll into.
      if (type !== 'init') {
        callback([], false)
        return
      }
      // The chart takes the candles in and subscribes (pushBar) inside the callback, so the overlays can follow.
      callback(props.candles.map(toBar), false)
      loaded()
    },
    subscribeBar: ({ callback }) => {
      pushBar = callback
    },
    unsubscribeBar: () => {
      pushBar = null
    },
  })
  applyIndicators()
  render()
  resizeObserver = new ResizeObserver(() => {
    chart?.resize()
    const now = (container.value?.clientWidth ?? 0) < 640
    if (now !== narrow) {
      narrow = now
      chart?.setStyles(styles())
    }
  })
  resizeObserver.observe(container.value!)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  quiet = true
  if (container.value) dispose(container.value)
  chart = null
})

watch(() => props.candles, refresh)
watch(
  () => theme.resolved,
  () => chart?.setStyles(styles()),
)
watch(() => props.levels, drawLevels)
watch(() => props.markers, drawMarkers)
watch(() => props.drawingKey, restoreDrawings)
// The time matters too: the same price fetched in a new period opens a new candle.
watch(() => [props.livePrice, props.livePriceAt], applyLivePrice)
</script>

<template>
  <div class="relative flex w-full flex-col" :style="{ height: `${height}px` }">
    <div class="relative flex items-center gap-1 overflow-x-auto border-b border-line pb-1.5 text-xs">
      <button class="shrink-0 rounded-lg px-2 py-1 text-muted hover:text-text" :class="menu === 'indicators' ? 'bg-brand/15 text-brand' : ''" @click="menu = menu === 'indicators' ? '' : 'indicators'">
        Indikator ({{ chosen.main.length + chosen.sub.length }})
      </button>
      <span class="mx-1 h-4 w-px shrink-0 bg-line" />
      <button
        v-for="tool in TOOLS"
        :key="tool.name"
        class="shrink-0 rounded-lg p-1.5 text-muted hover:text-text"
        :class="activeTool === tool.name ? 'bg-brand/15 text-brand' : ''"
        :title="tool.label"
        :aria-label="tool.label"
        @click="startTool(tool)"
      >
        <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path :d="tool.icon" /></svg>
      </button>
      <span class="mx-1 h-4 w-px shrink-0 bg-line" />
      <button class="shrink-0 rounded-lg px-2 py-1" :class="magnet ? 'bg-brand/15 text-brand' : 'text-muted hover:text-text'" title="Titik gambar menempel ke open, high, low, atau close candle" @click="magnet = !magnet">Magnet</button>
      <button v-if="selected" class="shrink-0 rounded-lg px-2 py-1 text-down" title="Hapus gambar yang dipilih" @click="removeSelected">Hapus terpilih</button>
      <button class="shrink-0 rounded-lg px-2 py-1 text-muted hover:text-down" title="Hapus semua gambar" @click="clearDrawings">Hapus semua</button>
    </div>

    <div v-if="menu === 'indicators'" class="card absolute z-20 mt-9 max-h-[360px] w-[min(520px,calc(100%-8px))] overflow-y-auto p-3 text-xs shadow-lg">
      <div class="mb-2 flex items-center justify-between">
        <span class="font-medium text-text">Indikator</span>
        <button class="text-muted hover:text-text" @click="menu = ''">Tutup</button>
      </div>
      <p class="mb-1 text-muted">Di grafik harga</p>
      <div class="mb-3 grid grid-cols-1 gap-1 sm:grid-cols-2">
        <label v-for="name in MAIN_INDICATORS" :key="name" class="flex items-center gap-2">
          <input type="checkbox" :checked="activeNames.has(name)" @change="toggleIndicator('main', name)" />
          <span class="w-12 font-medium text-text">{{ name }}</span>
          <span class="truncate text-muted">{{ INDICATOR_NAMES[name] }}</span>
        </label>
      </div>
      <p class="mb-1 text-muted">Di panel bawah</p>
      <div class="mb-3 grid grid-cols-1 gap-1 sm:grid-cols-2">
        <label v-for="name in SUB_INDICATORS" :key="name" class="flex items-center gap-2">
          <input type="checkbox" :checked="activeNames.has(name)" @change="toggleIndicator('sub', name)" />
          <span class="w-12 font-medium text-text">{{ name }}</span>
          <span class="truncate text-muted">{{ INDICATOR_NAMES[name] }}</span>
        </label>
      </div>
      <template v-if="chosen.main.length || chosen.sub.length">
        <p class="mb-1 text-muted">Parameter (pisahkan dengan koma, kosong = bawaan)</p>
        <div class="grid grid-cols-1 gap-1 sm:grid-cols-2">
          <label v-for="c in chosen.main" :key="`m-${c.name}`" class="flex items-center gap-2">
            <span class="w-12 font-medium text-text">{{ c.name }}</span>
            <input class="w-full rounded border border-line bg-transparent px-2 py-0.5" :value="c.params" placeholder="bawaan" @change="changeParams('main', c, ($event.target as HTMLInputElement).value)" />
          </label>
          <label v-for="c in chosen.sub" :key="`s-${c.name}`" class="flex items-center gap-2">
            <span class="w-12 font-medium text-text">{{ c.name }}</span>
            <input class="w-full rounded border border-line bg-transparent px-2 py-0.5" :value="c.params" placeholder="bawaan" @change="changeParams('sub', c, ($event.target as HTMLInputElement).value)" />
          </label>
        </div>
      </template>
    </div>

    <div ref="container" class="min-h-0 w-full flex-1" />
    <div
      class="group flex h-4 shrink-0 cursor-ns-resize touch-none items-center justify-center"
      title="Tarik untuk mengubah tinggi grafik; klik dua kali untuk kembali ke tinggi awal"
      role="separator"
      aria-orientation="horizontal"
      aria-label="Ubah tinggi grafik"
      @pointerdown="startResize"
      @pointermove="moveResize"
      @pointerup="endResize"
      @pointercancel="endResize"
      @dblclick="resetHeight"
    >
      <span class="h-1 w-12 rounded-full bg-line transition-colors group-hover:bg-brand/60" />
    </div>
    <p class="mt-1 text-[11px] text-muted">Pilih alat lalu klik titik di grafik. Gambar bisa digeser; klik kanan (atau pilih lalu Hapus terpilih) untuk menghapus satu gambar. Tarik garis di bawah grafik untuk mengubah tingginya. Gambar, indikator, dan tinggi tersimpan di browser ini.</p>
  </div>
</template>
