<script setup lang="ts">
import { computed, ref } from 'vue'
import EmptyState from '@/components/EmptyState.vue'
import Skeleton from '@/components/Skeleton.vue'
import { usePolling } from '@/composables/usePolling'
import { api } from '@/lib/api'
import { changeClass, compact, dateTime, pct, price } from '@/lib/format'

type Outcome = 'tp' | 'stop' | 'other' | 'open'

interface TpEvent {
  id: number
  token_id: number
  symbol: string
  slug: string
  chain: string
  version: string | null
  recommendation: string
  entered_at: string
  closed_at: string | null
  tp_at: string | null
  outcome: Outcome
  status: string
  max_tp_hit: number
  net_r: number | null
  score: number | null
  reasons: string[]
  candle_1h: string | null
  rsi: number | null
  trend_higher_tf: string | null
  macd_rising: boolean | null
  entry_price: number
  stop_pct: number | null
  rise_24h_pct: number | null
  below_high_24h_pct: number | null
  vs_ema50_pct: number | null
  age_days: number | null
  liquidity_usd: number | null
  top10_pct: number | null
  tp_pct: number | null
  tp_r: number | null
  minutes_to_tp: number | null
  minutes_held: number | null
  mae_pct: number | null
  mfe_pct: number | null
  btc_trend_4h: string | null
  btc_change_24h_pct: number | null
  btc_corr: number | null
  fear_greed: number | null
  breadth_up_pct: number | null
  volume_ratio: number | null
  turnover: number | null
  buy_ratio: number | null
  whale_net_usd: number | null
}

interface TpCoin {
  token_id: number
  symbol: string
  slug: string
  chain: string
  tp: number
  stop: number
  other: number
  open: number
  net_r: number
  avg_minutes_to_tp: number | null
  last_tp_at: string | null
}

interface Measure {
  group: string
  key: string
  label: string
  unit: '%' | '' | 'x' | 'share' | 'usd'
  hit: number | null
  missed: number | null
}

interface Page {
  coins: TpCoin[]
  events: TpEvent[]
  compare: Measure[]
  totals: { signals: number; tp: number; missed: number; open: number }
}

const page = ref<Page | null>(null)
const token = ref<number | null>(null)
const onlyTp = ref(false)

async function load() {
  const { data } = await api.get('/reports/tp-coins')
  page.value = data
}

usePolling(load, 120000)

const events = computed(() =>
  (page.value?.events ?? []).filter((e) => (token.value === null || e.token_id === token.value) && (!onlyTp.value || e.outcome === 'tp')),
)

const selected = computed(() => page.value?.coins.find((c) => c.token_id === token.value)?.symbol ?? null)

const groups = computed(() => {
  const out: Record<string, Measure[]> = {}
  for (const m of page.value?.compare ?? []) (out[m.group] ??= []).push(m)
  return out
})

const outcomeLabel: Record<Outcome, string> = { tp: 'Kena TP', stop: 'Stop', other: 'Keluar lain', open: 'Terbuka' }
const outcomeClass: Record<Outcome, string> = { tp: 'text-up', stop: 'text-down', other: 'text-muted', open: 'text-warn' }
const trendLabel: Record<string, string> = { bullish: 'naik', bearish: 'turun', neutral: 'datar' }

function duration(minutes: number | null): string {
  if (minutes === null) return '–'
  if (minutes < 60) return `${minutes} mnt`
  if (minutes < 2880) return `${(minutes / 60).toFixed(1).replace('.', ',')} jam`
  return `${Math.round(minutes / 1440)} hari`
}

function times(value: number | null): string {
  return value === null ? '–' : `${value.toFixed(2).replace('.', ',')}x`
}

function measure(m: Measure, value: number | null): string {
  if (value === null) return '–'
  if (m.unit === '%') return pct(value)
  if (m.unit === 'share') return `${value.toFixed(0)}% ya`
  if (m.unit === 'x') return times(value)
  if (m.unit === 'usd') return '$' + compact(value)
  return value.toFixed(value % 1 === 0 ? 0 : 2).replace('.', ',')
}

function r(value: number | null): string {
  return value === null ? '–' : `${value > 0 ? '+' : ''}${value.toFixed(2).replace('.', ',')}R`
}

function toggleToken(id: number) {
  token.value = token.value === id ? null : id
}
</script>

<template>
  <div class="stack-section">
    <Skeleton v-if="!page" :rows="6" />
    <template v-else>
      <section class="card p-4">
        <h2 class="card-title">Koin kena TP</h2>
        <p class="mt-2 text-sm text-muted">
          Token yang sinyalnya pernah mencapai TP1 (semua versi), dengan kondisi saat entry: pola, entry, jarak, kondisi BTC, dan volume. Sebagian besar ukuran
          diambil dari analisa yang melahirkan sinyal; waktu ke TP1 dan turun terdalam diperkirakan dari candle 15 menit. Sinyal yang masuk tapi tidak mencapai
          TP1 ditampilkan sebagai pembanding.
        </p>
        <p class="mt-2 text-xs text-warn">
          Cek 19 Nov 2026 pada 196 sinyal selesai: sinyal berikutnya pada token yang pernah TP rata-rata −0,23R, tetap rugi. Daftar ini bahan pengamatan, bukan
          filter, dan tidak mengubah trading v6.
        </p>
        <div class="mt-3 flex flex-wrap gap-4 text-sm">
          <span>Sinyal yang masuk: <b class="num">{{ page.totals.signals }}</b></span>
          <span class="text-up">Kena TP1: <b class="num">{{ page.totals.tp }}</b></span>
          <span class="text-down">Tidak kena: <b class="num">{{ page.totals.missed }}</b></span>
          <span class="text-muted">Masih terbuka: <b class="num">{{ page.totals.open }}</b></span>
        </div>
      </section>

      <EmptyState v-if="!page.coins.length" title="Belum ada token yang kena TP" description="Token muncul di sini setelah sinyalnya mencapai TP1." />

      <template v-else>
        <section class="card overflow-x-auto">
          <h2 class="card-title p-4 pb-2">Kena TP1 dibanding tidak kena (median)</h2>
          <table class="table">
            <thead>
              <tr><th>Ukuran</th><th class="text-right!">Kena TP1 ({{ page.totals.tp }})</th><th class="text-right!">Tidak kena ({{ page.totals.missed }})</th></tr>
            </thead>
            <tbody>
              <template v-for="(items, group) in groups" :key="group">
                <tr><td colspan="3" class="bg-panel-2 text-xs font-semibold text-muted">{{ group }}</td></tr>
                <tr v-for="m in items" :key="m.key">
                  <td class="text-sm">{{ m.label }}</td>
                  <td class="num text-right">{{ measure(m, m.hit) }}</td>
                  <td class="num text-right text-muted">{{ measure(m, m.missed) }}</td>
                </tr>
              </template>
            </tbody>
          </table>
          <p class="px-4 pb-3 text-[11px] text-muted">Semua versi digabung. Selisih kecil bisa kebetulan; uji dulu sebelum dijadikan aturan.</p>
        </section>

        <section class="card overflow-x-auto">
          <h2 class="card-title p-4 pb-2">Daftar token</h2>
          <table class="table">
            <thead>
              <tr>
                <th>Token</th><th>Jaringan</th><th class="text-right!">TP</th><th class="text-right!">Stop</th><th class="text-right!">Lain</th><th class="text-right!">Terbuka</th>
                <th class="text-right!">Total R</th><th class="text-right!">Rata-rata ke TP1</th><th>TP terakhir</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in page.coins" :key="c.token_id" class="cursor-pointer" :class="token === c.token_id ? 'bg-panel-2' : ''" @click="toggleToken(c.token_id)">
                <td class="font-medium">{{ c.symbol }}</td>
                <td class="text-xs text-muted">{{ c.chain }}</td>
                <td class="num text-right text-up">{{ c.tp }}</td>
                <td class="num text-right text-down">{{ c.stop }}</td>
                <td class="num text-right text-muted">{{ c.other }}</td>
                <td class="num text-right text-muted">{{ c.open }}</td>
                <td class="num text-right" :class="changeClass(c.net_r)">{{ r(c.net_r) }}</td>
                <td class="num text-right">{{ duration(c.avg_minutes_to_tp) }}</td>
                <td class="text-xs">{{ dateTime(c.last_tp_at) }}</td>
              </tr>
            </tbody>
          </table>
          <p class="px-4 pb-3 text-[11px] text-muted">Klik token untuk menyaring sinyal di bawah.</p>
        </section>

        <section class="card overflow-x-auto">
          <div class="flex flex-wrap items-center justify-between gap-2 p-4 pb-2">
            <h2 class="card-title">Sinyal {{ selected ?? 'semua token di daftar' }}</h2>
            <label class="flex items-center gap-2 text-xs text-muted">
              <input v-model="onlyTp" type="checkbox" /> Hanya yang kena TP
            </label>
          </div>
          <table class="table text-xs">
            <thead>
              <tr><th>Masuk</th><th>Token</th><th>Hasil</th><th>Pola</th><th>Entry</th><th>Jarak</th><th>Kondisi BTC</th><th>Volume</th></tr>
            </thead>
            <tbody>
              <tr v-for="e in events" :key="e.id" class="align-top">
                <td class="whitespace-nowrap">
                  {{ dateTime(e.entered_at) }}
                  <div class="text-muted">#{{ e.id }} · {{ e.version ?? '–' }}</div>
                </td>
                <td>
                  <RouterLink :to="`/tokens/${e.slug}`" class="font-medium hover:text-brand">{{ e.symbol }}</RouterLink>
                  <div class="text-muted">{{ e.chain }} · {{ e.recommendation === 'STRONG_BUY' ? 'Strong Buy' : 'Buy' }}</div>
                </td>
                <td class="whitespace-nowrap">
                  <div :class="outcomeClass[e.outcome]">{{ outcomeLabel[e.outcome] }}<span v-if="e.max_tp_hit"> (TP{{ e.max_tp_hit }})</span></div>
                  <div class="num" :class="changeClass(e.net_r)">{{ r(e.net_r) }}</div>
                </td>
                <td class="min-w-56">
                  <div>Skor {{ e.score ?? '–' }} · RSI {{ e.rsi ?? '–' }} · MACD {{ e.macd_rising === null ? '–' : e.macd_rising ? 'naik' : 'turun' }}</div>
                  <div class="text-muted">Candle 1 jam: {{ e.candle_1h ?? '–' }} · Tren TF besar: {{ e.trend_higher_tf ? trendLabel[e.trend_higher_tf] ?? e.trend_higher_tf : '–' }}</div>
                  <div v-for="reason in e.reasons" :key="reason" class="text-muted">{{ reason.replace('[Teknikal] ', '') }}</div>
                </td>
                <td class="whitespace-nowrap">
                  <div class="num">{{ price(e.entry_price) }}</div>
                  <div class="text-muted">Stop {{ pct(e.stop_pct ? -e.stop_pct : null) }}</div>
                  <div class="text-muted">Naik 24 jam <span :class="changeClass(e.rise_24h_pct)">{{ pct(e.rise_24h_pct) }}</span></div>
                  <div class="text-muted">Di bawah high 24 jam {{ pct(e.below_high_24h_pct) }}</div>
                  <div class="text-muted">vs EMA50 {{ pct(e.vs_ema50_pct) }}</div>
                  <div class="text-muted">Umur {{ e.age_days ?? '–' }} hari · Top 10 {{ e.top10_pct ?? '–' }}%</div>
                  <div class="text-muted">Likuiditas ${{ compact(e.liquidity_usd) }}</div>
                </td>
                <td class="whitespace-nowrap">
                  <div>TP1 {{ pct(e.tp_pct) }}<span v-if="e.tp_r" class="text-muted"> ({{ e.tp_r.toFixed(2).replace('.', ',') }}R)</span></div>
                  <div class="text-muted">Ke TP1 {{ duration(e.minutes_to_tp) }}</div>
                  <div class="text-muted">Lama sinyal {{ duration(e.minutes_held) }}</div>
                  <div class="text-muted">Turun terdalam <span class="text-down">{{ pct(e.mae_pct) }}</span></div>
                  <div class="text-muted">Naik tertinggi <span class="text-up">{{ pct(e.mfe_pct) }}</span></div>
                </td>
                <td class="whitespace-nowrap">
                  <div>Tren 4 jam: {{ e.btc_trend_4h ? trendLabel[e.btc_trend_4h] ?? e.btc_trend_4h : '–' }}</div>
                  <div class="text-muted">BTC 24 jam <span :class="changeClass(e.btc_change_24h_pct)">{{ pct(e.btc_change_24h_pct) }}</span></div>
                  <div class="text-muted">Korelasi {{ e.btc_corr ?? '–' }}</div>
                  <div class="text-muted">F&amp;G {{ e.fear_greed ?? '–' }} · Naik 24 jam {{ e.breadth_up_pct === null ? '–' : e.breadth_up_pct + '%' }}</div>
                </td>
                <td class="whitespace-nowrap">
                  <div>Rasio volume {{ times(e.volume_ratio) }}</div>
                  <div class="text-muted">Volume/likuiditas {{ times(e.turnover) }}</div>
                  <div class="text-muted">Porsi beli {{ e.buy_ratio === null ? '–' : e.buy_ratio + '%' }}</div>
                  <div class="text-muted">Whale bersih ${{ compact(e.whale_net_usd) }}</div>
                </td>
              </tr>
            </tbody>
          </table>
          <p class="px-4 pb-3 text-[11px] text-muted">
            Waktu ke TP1, turun terdalam, dan naik tertinggi diperkirakan dari candle 15 menit; tracker sinyal memakai cek harga, jadi bisa sedikit berbeda.
            "Naik 24 jam" pada kondisi BTC = porsi token pantauan yang naik dalam 24 jam saat analisa.
          </p>
        </section>
      </template>
    </template>
  </div>
</template>
