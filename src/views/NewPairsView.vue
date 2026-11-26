<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AppSelect, { type SelectOption } from '@/components/AppSelect.vue'
import EmptyState from '@/components/EmptyState.vue'
import Skeleton from '@/components/Skeleton.vue'
import { usePolling } from '@/composables/usePolling'
import { api } from '@/lib/api'
import { changeClass, compact, dateTime, pct, price, timeAgo } from '@/lib/format'

interface StrategyRow {
  key: string
  label: string
  closed: number
  open: number
  avg_net_pct: number | null
  median_net_pct: number | null
  win_rate: number | null
  profit_factor: number | null
  total_net_pct: number | null
}

interface Summary {
  strategies: StrategyRow[]
  pairs: { tracking: number; total: number; last_24h: number; by_source: Record<string, number>; by_chain: Record<string, number>; first_seen_at: string | null }
  rules: { stop_pct: number; take_profit_pct: number[]; max_hold_hours: number; round_trip_cost_pct: number; min_liquidity_usd: number; max_tracked: number }
}

interface Pool {
  id: number
  chain_id: string
  symbol: string
  name: string | null
  quote_symbol: string | null
  dex_id: string | null
  pair_address: string
  url: string | null
  source: string
  status: 'tracking' | 'done'
  end_reason: string | null
  pool_created_at: string | null
  first_seen_at: string
  age_at_first_seen_minutes: number | null
  price_usd: number | null
  change_since_seen_pct: number | null
  max_since_seen_pct: number | null
  min_since_seen_pct: number | null
  liquidity_usd: number | null
  first_liquidity_usd: number | null
  volume_h1: number | null
  buys_m5: number | null
  sells_m5: number | null
  security_checked: boolean
  security_score: number | null
  is_honeypot: boolean | null
  sell_tax: number | null
  top10_percent: number | null
  last_sample_at: string | null
  trades_count: number
}

interface Trade {
  id: number
  strategy: string
  strategy_label: string
  status: 'open' | 'closed'
  symbol: string | null
  chain_id: string | null
  url: string | null
  entry_at: string
  entry_price: number
  pool_age_minutes: number | null
  liquidity_usd: number | null
  tp_hit: number
  mfe_pct: number
  mae_pct: number
  exit_at: string | null
  exit_price: number | null
  exit_reason: string | null
  net_pct: number | null
}

interface Paged<T> {
  data: T[]
  current_page: number
  last_page: number
  total: number
}

const summary = ref<Summary | null>(null)
const pools = ref<Paged<Pool> | null>(null)
const trades = ref<Paged<Trade> | null>(null)

const poolStatus = ref<'tracking' | 'done' | ''>('tracking')
const poolChain = ref('')
const poolSearch = ref('')
const poolPage = ref(1)
const tradeStrategy = ref('')
const tradeStatus = ref<'open' | 'closed' | ''>('')
const tradePage = ref(1)

const sourceLabel: Record<string, string> = { discovery: 'Discovery DEX', geckoterminal_new: 'GeckoTerminal baru' }
const endLabel: Record<string, string> = { umur: 'lewat 24 jam', tanpa_data: 'data hilang', likuiditas: 'likuiditas ditarik' }
const exitLabel: Record<string, string> = {
  stop: 'Stop',
  impas: 'Impas setelah TP1',
  tp3: 'TP3',
  waktu: '24 jam',
  likuiditas: 'Likuiditas hilang',
  tanpa_data: 'Data hilang',
}

const chainOptions = computed<SelectOption<string>[]>(() => [
  { value: '', label: 'Semua jaringan' },
  ...Object.keys(summary.value?.pairs.by_chain ?? {}).map((c) => ({ value: c, label: c })),
])
const poolStatusOptions: SelectOption<string>[] = [
  { value: 'tracking', label: 'Sedang dipantau' },
  { value: 'done', label: 'Selesai' },
  { value: '', label: 'Semua' },
]
const strategyOptions = computed<SelectOption<string>[]>(() => [
  { value: '', label: 'Semua strategi' },
  ...(summary.value?.strategies ?? []).map((s) => ({ value: s.key, label: s.label })),
])
const tradeStatusOptions: SelectOption<string>[] = [
  { value: '', label: 'Semua' },
  { value: 'open', label: 'Terbuka' },
  { value: 'closed', label: 'Selesai' },
]

async function loadSummary() {
  summary.value = (await api.get('/new-pairs/summary')).data
}

async function loadPools() {
  const params = { status: poolStatus.value || undefined, chain: poolChain.value || undefined, search: poolSearch.value.trim() || undefined, page: poolPage.value }
  pools.value = (await api.get('/new-pairs', { params })).data
}

async function loadTrades() {
  const params = { strategy: tradeStrategy.value || undefined, status: tradeStatus.value || undefined, page: tradePage.value }
  trades.value = (await api.get('/new-pairs/trades', { params })).data
}

usePolling(() => Promise.all([loadSummary(), loadPools(), loadTrades()]), 60000)

let searchTimer: ReturnType<typeof setTimeout> | undefined
watch([poolStatus, poolChain], () => {
  poolPage.value = 1
  loadPools()
})
watch(poolSearch, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    poolPage.value = 1
    loadPools()
  }, 300)
})
watch(poolPage, loadPools)
watch([tradeStrategy, tradeStatus], () => {
  tradePage.value = 1
  loadTrades()
})
watch(tradePage, loadTrades)

function num(value: number | null, digits = 2): string {
  return value === null ? '–' : value.toFixed(digits).replace('.', ',')
}

function signed(value: number | null): string {
  return value === null ? '–' : pct(value, 1)
}

function age(minutes: number | null): string {
  if (minutes === null) return '–'
  if (minutes < 60) return `${minutes} mnt`
  return `${(minutes / 60).toFixed(1).replace('.', ',')} jam`
}

function usdShort(value: number | null): string {
  return value === null ? '–' : '$' + compact(value)
}

function security(p: Pool): { text: string; cls: string } {
  if (!p.security_checked) return { text: 'menunggu', cls: 'text-muted' }
  if (p.is_honeypot) return { text: 'honeypot', cls: 'text-down' }
  if (p.security_score === null) return { text: 'tanpa data', cls: 'text-muted' }
  return { text: `skor ${p.security_score}`, cls: p.security_score >= 70 ? 'text-up' : p.security_score >= 50 ? 'text-warn' : 'text-down' }
}
</script>

<template>
  <div class="stack-section">
    <Skeleton v-if="!summary" :rows="6" />
    <template v-else>
      <section class="card p-4">
        <h2 class="card-title">Token Baru</h2>
        <p class="mt-2 text-sm text-muted">
          Pool berumur di bawah 24 jam, dicatat terpisah dari Market: harga, likuiditas, volume, dan transaksi dari DEX Screener tiap menit (candle 5 menit
          sendiri), cek keamanan GoPlus, dan trade kertas strategi New Token Hunter. <b>Hanya pencatatan</b>: tidak membuat sinyal, order, atau auto-follow, dan
          tidak mengubah strategi DEX.
        </p>
        <p class="mt-2 text-xs text-warn">
          Uji 26 Nov 2026 pada 270 pair muda: tidak ada strategi yang unggul setelah biaya; hasil positif hanya dari beberapa token yang naik berlipat, dan
          separuh token turun lebih dari 57% dalam 24 jam. Data di sini untuk menilai ulang ke depan.
        </p>
        <div class="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <span>Dipantau: <b class="num">{{ summary.pairs.tracking }}</b> / {{ summary.rules.max_tracked }}</span>
          <span>Tercatat: <b class="num">{{ summary.pairs.total }}</b></span>
          <span>24 jam terakhir: <b class="num">{{ summary.pairs.last_24h }}</b></span>
          <span v-for="(n, source) in summary.pairs.by_source" :key="source" class="text-muted">{{ sourceLabel[source] ?? source }}: <b class="num">{{ n }}</b></span>
          <span v-if="summary.pairs.first_seen_at" class="text-muted">Sejak {{ dateTime(summary.pairs.first_seen_at) }}</span>
        </div>
        <p class="mt-2 text-[11px] text-muted">
          Aturan: pool likuiditas ≥ ${{ compact(summary.rules.min_liquidity_usd) }}, entry saat umur pool 5 menit–24 jam; TP
          {{ summary.rules.take_profit_pct.map((v) => `+${v}%`).join(' / ') }} (sepertiga tiap TP), stop −{{ summary.rules.stop_pct }}% (ke harga entry setelah TP1),
          paling lama {{ summary.rules.max_hold_hours }} jam, keluar juga bila likuiditas tinggal 20%. Hasil sudah dikurangi biaya {{ summary.rules.round_trip_cost_pct }}%
          pulang-pergi. Strategi A, B, dan C hanya entry bila GoPlus sudah menjawab dan bukan honeypot.
        </p>
      </section>

      <section class="card overflow-x-auto">
        <h2 class="card-title p-4 pb-2">Hasil trade kertas per strategi</h2>
        <table class="table">
          <thead>
            <tr>
              <th>Strategi</th><th class="text-right!">Selesai</th><th class="text-right!">Terbuka</th><th class="text-right!">Rata-rata</th>
              <th class="text-right!">Median</th><th class="text-right!">Menang</th><th class="text-right!">PF</th><th class="text-right!">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in summary.strategies" :key="s.key">
              <td class="font-medium">{{ s.label }}</td>
              <td class="num text-right">{{ s.closed }}</td>
              <td class="num text-right text-muted">{{ s.open }}</td>
              <td class="num text-right" :class="changeClass(s.avg_net_pct)">{{ signed(s.avg_net_pct) }}</td>
              <td class="num text-right" :class="changeClass(s.median_net_pct)">{{ signed(s.median_net_pct) }}</td>
              <td class="num text-right">{{ s.win_rate === null ? '–' : `${num(s.win_rate, 0)}%` }}</td>
              <td class="num text-right">{{ num(s.profit_factor) }}</td>
              <td class="num text-right" :class="changeClass(s.total_net_pct)">{{ signed(s.total_net_pct) }}</td>
            </tr>
          </tbody>
        </table>
        <p class="px-4 pb-3 text-[11px] text-muted">Persen per trade, sudah dikurangi biaya. Sampel kecil mudah berubah oleh satu token; tunggu sekitar 200 trade per strategi sebelum menilai.</p>
      </section>

      <section class="card">
        <div class="flex flex-wrap items-center gap-2 p-4 pb-2">
          <h2 class="card-title mr-auto">Pool</h2>
          <input v-model="poolSearch" type="search" class="w-44 py-1 text-xs" placeholder="Cari simbol atau alamat" aria-label="Cari pool" />
          <AppSelect v-model="poolStatus" :options="poolStatusOptions" aria-label="Status pool" class="w-40" />
          <AppSelect v-model="poolChain" :options="chainOptions" aria-label="Jaringan" class="w-40" />
        </div>
        <div class="overflow-x-auto">
          <table v-if="pools?.data.length" class="table">
            <thead>
              <tr>
                <th>Token</th><th>Sumber</th><th>Terlihat</th><th class="text-right!">Umur saat terlihat</th><th class="text-right!">Likuiditas</th>
                <th class="text-right!">Vol 1 jam</th><th class="text-right!">Beli/jual 5 mnt</th><th class="text-right!">Sejak terlihat</th>
                <th class="text-right!">Tertinggi / terendah</th><th>Keamanan</th><th class="text-right!">Trade</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in pools.data" :key="p.id">
                <td>
                  <a v-if="p.url" :href="p.url" target="_blank" rel="noopener" class="font-medium hover:underline">{{ p.symbol }}</a>
                  <span v-else class="font-medium">{{ p.symbol }}</span>
                  <span class="block text-[11px] text-muted">{{ p.chain_id }} · {{ p.dex_id ?? '–' }}{{ p.quote_symbol ? ` · ${p.quote_symbol}` : '' }}</span>
                </td>
                <td class="text-xs text-muted">{{ sourceLabel[p.source] ?? p.source }}</td>
                <td class="text-xs">
                  {{ dateTime(p.first_seen_at) }}
                  <span v-if="p.status === 'done'" class="block text-[11px] text-muted">selesai: {{ endLabel[p.end_reason ?? ''] ?? p.end_reason }}</span>
                  <span v-else class="block text-[11px] text-muted">sampel {{ timeAgo(p.last_sample_at) }}</span>
                </td>
                <td class="num text-right">{{ age(p.age_at_first_seen_minutes) }}</td>
                <td class="num text-right">
                  {{ usdShort(p.liquidity_usd) }}
                  <span class="block text-[11px] text-muted">awal {{ usdShort(p.first_liquidity_usd) }}</span>
                </td>
                <td class="num text-right">{{ usdShort(p.volume_h1) }}</td>
                <td class="num text-right">{{ p.buys_m5 ?? '–' }} / {{ p.sells_m5 ?? '–' }}</td>
                <td class="num text-right" :class="changeClass(p.change_since_seen_pct)">
                  {{ signed(p.change_since_seen_pct) }}
                  <span class="block text-[11px] text-muted">{{ price(p.price_usd) }}</span>
                </td>
                <td class="num text-right text-xs">
                  <span class="text-up">{{ signed(p.max_since_seen_pct) }}</span> / <span class="text-down">{{ signed(p.min_since_seen_pct) }}</span>
                </td>
                <td class="text-xs" :class="security(p).cls">
                  {{ security(p).text }}
                  <span v-if="p.top10_percent !== null" class="block text-[11px] text-muted">top 10 {{ num(p.top10_percent, 0) }}%</span>
                </td>
                <td class="num text-right">{{ p.trades_count }}</td>
              </tr>
            </tbody>
          </table>
          <EmptyState v-else-if="pools" title="Belum ada pool" description="Pool muda muncul di sini setelah ditemukan discovery atau GeckoTerminal." />
          <Skeleton v-else :rows="4" />
        </div>
        <div v-if="pools && pools.last_page > 1" class="flex items-center justify-between gap-2 border-t border-line px-4 py-3 text-xs text-muted">
          <span>Halaman {{ pools.current_page }} dari {{ pools.last_page }} · {{ pools.total }} pool</span>
          <div class="flex gap-2">
            <button type="button" class="btn-ghost py-1 text-xs" :disabled="poolPage <= 1" @click="poolPage--">← Sebelumnya</button>
            <button type="button" class="btn-ghost py-1 text-xs" :disabled="poolPage >= pools.last_page" @click="poolPage++">Berikutnya →</button>
          </div>
        </div>
      </section>

      <section class="card">
        <div class="flex flex-wrap items-center gap-2 p-4 pb-2">
          <h2 class="card-title mr-auto">Trade kertas</h2>
          <AppSelect v-model="tradeStrategy" :options="strategyOptions" aria-label="Strategi" class="w-64" />
          <AppSelect v-model="tradeStatus" :options="tradeStatusOptions" aria-label="Status trade" class="w-32" />
        </div>
        <div class="overflow-x-auto">
          <table v-if="trades?.data.length" class="table">
            <thead>
              <tr>
                <th>Strategi</th><th>Token</th><th>Entry</th><th class="text-right!">Umur pool</th><th class="text-right!">Harga entry</th>
                <th class="text-right!">Naik / turun terjauh</th><th class="text-right!">TP</th><th>Keluar</th><th class="text-right!">Hasil</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="t in trades.data" :key="t.id">
                <td class="text-xs">{{ t.strategy_label }}</td>
                <td>
                  <a v-if="t.url" :href="t.url" target="_blank" rel="noopener" class="font-medium hover:underline">{{ t.symbol }}</a>
                  <span v-else class="font-medium">{{ t.symbol }}</span>
                  <span class="block text-[11px] text-muted">{{ t.chain_id }}</span>
                </td>
                <td class="text-xs">{{ dateTime(t.entry_at) }}</td>
                <td class="num text-right">{{ age(t.pool_age_minutes) }}</td>
                <td class="num text-right">{{ price(t.entry_price) }}</td>
                <td class="num text-right text-xs"><span class="text-up">{{ signed(t.mfe_pct) }}</span> / <span class="text-down">{{ signed(t.mae_pct) }}</span></td>
                <td class="num text-right">{{ t.tp_hit }}</td>
                <td class="text-xs">
                  <template v-if="t.status === 'closed'">{{ exitLabel[t.exit_reason ?? ''] ?? t.exit_reason }} · {{ dateTime(t.exit_at) }}</template>
                  <span v-else class="text-warn">terbuka</span>
                </td>
                <td class="num text-right" :class="changeClass(t.net_pct)">{{ signed(t.net_pct) }}</td>
              </tr>
            </tbody>
          </table>
          <EmptyState v-else-if="trades" title="Belum ada trade kertas" description="Trade dibuka saat pool berumur minimal 5 menit dan aturan strategi terpenuhi." />
          <Skeleton v-else :rows="4" />
        </div>
        <div v-if="trades && trades.last_page > 1" class="flex items-center justify-between gap-2 border-t border-line px-4 py-3 text-xs text-muted">
          <span>Halaman {{ trades.current_page }} dari {{ trades.last_page }} · {{ trades.total }} trade</span>
          <div class="flex gap-2">
            <button type="button" class="btn-ghost py-1 text-xs" :disabled="tradePage <= 1" @click="tradePage--">← Sebelumnya</button>
            <button type="button" class="btn-ghost py-1 text-xs" :disabled="tradePage >= trades.last_page" @click="tradePage++">Berikutnya →</button>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>
