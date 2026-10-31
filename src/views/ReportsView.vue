<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AppSelect from '@/components/AppSelect.vue'
import EquityChart from '@/components/EquityChart.vue'
import RecommendationBadge from '@/components/RecommendationBadge.vue'
import Skeleton from '@/components/Skeleton.vue'
import StatCard from '@/components/StatCard.vue'
import { usePolling } from '@/composables/usePolling'
import { api } from '@/lib/api'
import { changeClass, dateTime, pct, usd } from '@/lib/format'
import type { Recommendation } from '@/lib/types'

interface Summary {
  trades: number
  win_rate: number | null
  avg_r: number | null
  total_r: number
  gross_total_r: number
  avg_cost_r: number | null
  profit_factor: number | null
  max_drawdown_r: number
}

interface Account {
  key: string
  label: string
  recommendations: Recommendation[]
  started_at: string | null
  closed_signals: number
  wins: number
  win_rate: number | null
  avg_r: number | null
  total_r: number
  equity_usd: number
  starting_balance: number
  total_pnl: number
  total_pnl_pct: number
  realized_pnl: number
  unrealized_pnl: number
  fees_paid: number
  trades: number
  open_positions: number
  pending_orders: number
  max_drawdown_pct: number | null
  curve_started_at: string | null
  curve: { t: number; equity: number }[]
  limits: { max_open_positions: number; risk_pct: number; max_daily_loss_pct: number }
  realized_today: number
  daily_loss_reached: boolean
  has_room: boolean
}

interface Report {
  version: string | null
  current_version: string
  versions: string[]
  summary: Summary
  criteria: { label: string; target: string; value: string; passed: boolean }[]
  weeks: (Summary & { week_start: string; cumulative_r: number })[]
  recommendations: (Summary & { recommendation: Recommendation })[]
  tokens: (Summary & { symbol: string; slug: string })[]
  accounts: Account[]
}

const report = ref<Report | null>(null)
const version = ref('')

async function load() {
  const { data } = await api.get<Report>('/reports/performance', { params: version.value ? { version: version.value } : {} })
  report.value = data
  if (!version.value) version.value = data.version ?? 'all'
}

usePolling(load, 60000)
watch(version, (_value, previous) => {
  if (previous) load()
})

const versionOptions = computed(() => [
  ...(report.value?.versions ?? []).map((v) => ({ value: v, label: v === report.value?.current_version ? `${v} (aktif)` : v })),
  { value: 'all', label: 'Semua versi' },
])

const selectedKey = ref('all')
const account = computed(() => report.value?.accounts.find((a) => a.key === selectedKey.value) ?? report.value?.accounts[0] ?? null)

function buyingStatus(a: Account): { label: string; tone?: 'up' | 'down'; hint: string } {
  if (a.daily_loss_reached) return { label: 'Dijeda', tone: 'down', hint: 'Batas rugi harian tercapai, lanjut besok' }
  if (!a.has_room) return { label: 'Penuh', hint: `Maks. ${a.limits.max_open_positions} posisi, menunggu posisi tutup` }
  return { label: 'Aktif', tone: 'up', hint: `Maks. ${a.limits.max_open_positions} posisi · risiko ${a.limits.risk_pct}% per trade` }
}

const buying = computed(() => (account.value ? buyingStatus(account.value) : null))

function r(value: number | null | undefined): string {
  if (value === null || value === undefined) return '–'
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}R`
}

function percent(value: number | null | undefined): string {
  return value === null || value === undefined ? '–' : `${value}%`
}

function factor(value: number | null | undefined): string {
  return value === null || value === undefined ? '–' : value.toFixed(2)
}

function week(start: string): string {
  const from = new Date(`${start}T00:00:00`)
  const to = new Date(from.getTime() + 6 * 86400000)
  const format = (date: Date) => date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
  return `${format(from)} – ${format(to)}`
}
</script>

<template>
  <div class="stack-section">
    <div class="flex flex-wrap items-end gap-3">
      <div class="mr-auto min-w-0">
        <h1 class="text-xl font-semibold">Laporan performa</h1>
        <p class="mt-1 text-sm text-muted">Hasil bersih sinyal setelah fee dan slippage, serta kurva ekuitas akun Auto-follow. Semua transaksi masih simulasi.</p>
      </div>
      <AppSelect v-if="report" v-model="version" class="w-52" :options="versionOptions" aria-label="Versi strategi" />
    </div>

    <Skeleton v-if="!report" :rows="4" height="h-32" />

    <template v-else>
      <section class="card p-4">
        <h2 class="card-title">Kriteria lolos Fase 2</h2>
        <p class="mt-1 text-xs text-muted">Syarat sebelum memakai uang sungguhan. Selama sinyal selesai belum 30, kriteria lain belum dianggap lolos karena sampelnya terlalu kecil. Backtest 90 hari dicek terpisah.</p>
        <ul class="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <li v-for="c in report.criteria" :key="c.label" class="rounded-lg border border-line p-3">
            <span class="flex items-center gap-1.5 text-xs font-medium" :class="c.passed ? 'text-up' : 'text-muted'">
              <span aria-hidden="true">{{ c.passed ? '✓' : '○' }}</span>
              {{ c.passed ? 'Lolos' : 'Belum' }}
            </span>
            <span class="mt-1 block text-sm">{{ c.label }}</span>
            <span class="num mt-0.5 block text-lg font-semibold">{{ c.value }}</span>
            <span class="block text-xs text-muted">Target {{ c.target }}</span>
          </li>
        </ul>
      </section>

      <div class="grid grid-cols-2 gap-section lg:grid-cols-4">
        <StatCard label="Total R bersih" :value="r(report.summary.total_r)" :tone="report.summary.total_r > 0 ? 'up' : report.summary.total_r < 0 ? 'down' : undefined" :hint="`Sebelum biaya ${r(report.summary.gross_total_r)}`" />
        <StatCard label="Rata-rata per sinyal" :value="r(report.summary.avg_r)" :hint="`Biaya rata-rata ${report.summary.avg_cost_r ?? '–'}R`" />
        <StatCard label="Win rate" :value="percent(report.summary.win_rate)" :hint="`${report.summary.trades} sinyal selesai`" />
        <StatCard label="Profit factor" :value="factor(report.summary.profit_factor)" :hint="`Drawdown terburuk ${report.summary.max_drawdown_r}R`" />
      </div>

      <section class="card overflow-x-auto">
        <h2 class="card-title p-4 pb-2">Per minggu</h2>
        <table v-if="report.weeks.length" class="table">
          <thead>
            <tr>
              <th>Minggu (Senin–Minggu, WIB)</th>
              <th class="text-right">Sinyal</th>
              <th class="text-right">Win rate</th>
              <th class="text-right">Total R</th>
              <th class="text-right">Rata-rata</th>
              <th class="text-right">PF</th>
              <th class="text-right">Kumulatif</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="w in report.weeks" :key="w.week_start">
              <td class="whitespace-nowrap">{{ week(w.week_start) }}</td>
              <td class="num text-right">{{ w.trades }}</td>
              <td class="num text-right">{{ percent(w.win_rate) }}</td>
              <td class="num text-right" :class="changeClass(w.total_r)">{{ r(w.total_r) }}</td>
              <td class="num text-right" :class="changeClass(w.avg_r)">{{ r(w.avg_r) }}</td>
              <td class="num text-right">{{ factor(w.profit_factor) }}</td>
              <td class="num text-right" :class="changeClass(w.cumulative_r)">{{ r(w.cumulative_r) }}</td>
            </tr>
          </tbody>
        </table>
        <p v-else class="px-4 pb-4 text-sm text-muted">Belum ada sinyal selesai pada versi ini. Pilih "Semua versi" untuk melihat data lama.</p>
      </section>

      <div v-if="report.summary.trades" class="grid items-start gap-section lg:grid-cols-2">
        <section class="card overflow-x-auto">
          <h2 class="card-title p-4 pb-2">Per rekomendasi</h2>
          <table class="table">
            <thead>
              <tr>
                <th>Rekomendasi</th>
                <th class="text-right">Sinyal</th>
                <th class="text-right">Win rate</th>
                <th class="text-right">Total R</th>
                <th class="text-right">Rata-rata</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in report.recommendations" :key="row.recommendation">
                <td><RecommendationBadge :value="row.recommendation" /></td>
                <td class="num text-right">{{ row.trades }}</td>
                <td class="num text-right">{{ percent(row.win_rate) }}</td>
                <td class="num text-right" :class="changeClass(row.total_r)">{{ r(row.total_r) }}</td>
                <td class="num text-right" :class="changeClass(row.avg_r)">{{ r(row.avg_r) }}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section class="card overflow-x-auto">
          <h2 class="card-title p-4 pb-2">Per token</h2>
          <div class="max-h-96 overflow-y-auto">
            <table class="table">
              <thead>
                <tr>
                  <th>Token</th>
                  <th class="text-right">Sinyal</th>
                  <th class="text-right">Win rate</th>
                  <th class="text-right">Total R</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in report.tokens" :key="row.slug">
                  <td><RouterLink :to="`/tokens/${row.slug}`" class="font-medium hover:text-brand">{{ row.symbol }}</RouterLink></td>
                  <td class="num text-right">{{ row.trades }}</td>
                  <td class="num text-right">{{ percent(row.win_rate) }}</td>
                  <td class="num text-right" :class="changeClass(row.total_r)">{{ r(row.total_r) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section class="card overflow-x-auto">
        <h2 class="card-title p-4 pb-1">Perbandingan akun Auto-follow</h2>
        <p class="px-4 pb-2 text-xs text-muted">
          Akun simulasi dengan modal dan batas risiko yang sama, masing-masing membeli rekomendasinya sendiri. Win rate dihitung dari sinyal selesai yang benar-benar dibeli akun itu. Tabel ini tidak terpengaruh pilihan versi di atas, dan akun Gabungan masih membawa posisi lama.
        </p>
        <table class="table">
          <thead>
            <tr>
              <th>Akun</th>
              <th class="text-right!">Sinyal selesai</th>
              <th class="text-right!">Win rate</th>
              <th class="text-right!">Rata-rata</th>
              <th class="text-right!">Total R</th>
              <th class="text-right!">Ekuitas</th>
              <th class="text-right!">Drawdown</th>
              <th>Beli baru</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="a in report.accounts" :key="a.key" :class="{ 'bg-brand/10': a.key === account?.key }">
              <td class="whitespace-nowrap">
                <button type="button" class="font-medium hover:text-brand" :aria-pressed="a.key === account?.key" @click="selectedKey = a.key">{{ a.label }}</button>
                <span class="block text-[11px] text-muted">Sejak {{ a.started_at ? dateTime(a.started_at) : '–' }}</span>
              </td>
              <td class="num text-right">{{ a.closed_signals }}</td>
              <td class="num text-right">{{ percent(a.win_rate) }}</td>
              <td class="num text-right" :class="changeClass(a.avg_r)">{{ r(a.avg_r) }}</td>
              <td class="num text-right" :class="changeClass(a.total_r)">{{ r(a.total_r) }}</td>
              <td class="num text-right whitespace-nowrap">
                {{ usd(a.equity_usd) }}
                <span class="block text-[11px]" :class="changeClass(a.total_pnl)">{{ pct(a.total_pnl_pct) }}</span>
              </td>
              <td class="num text-right">{{ percent(a.max_drawdown_pct) }}</td>
              <td class="text-xs whitespace-nowrap" :class="{ 'text-up': buyingStatus(a).tone === 'up', 'text-down': buyingStatus(a).tone === 'down', 'text-muted': !buyingStatus(a).tone }">{{ buyingStatus(a).label }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section v-if="account" class="card p-4">
        <h2 class="card-title">Detail akun: {{ account.label }}</h2>

        <div class="mt-3 grid grid-cols-2 gap-section lg:grid-cols-4">
          <div>
            <p class="text-xs text-muted">Ekuitas</p>
            <p class="num text-lg font-semibold">{{ usd(account.equity_usd) }}</p>
            <p class="num text-xs" :class="changeClass(account.total_pnl)">{{ pct(account.total_pnl_pct) }} dari {{ usd(account.starting_balance) }}</p>
          </div>
          <div>
            <p class="text-xs text-muted">Drawdown terburuk</p>
            <p class="num text-lg font-semibold">{{ percent(account.max_drawdown_pct) }}</p>
            <p class="text-xs text-muted">Target di bawah 15%</p>
          </div>
          <div>
            <p class="text-xs text-muted">Posisi</p>
            <p class="num text-lg font-semibold">{{ account.open_positions }} terbuka</p>
            <p class="text-xs text-muted">{{ account.pending_orders }} order menunggu · {{ account.trades }} transaksi</p>
          </div>
          <div>
            <p class="text-xs text-muted">Pembelian baru</p>
            <p class="text-lg font-semibold" :class="{ 'text-up': buying?.tone === 'up', 'text-down': buying?.tone === 'down' }">{{ buying?.label }}</p>
            <p class="text-xs text-muted">{{ buying?.hint }}</p>
          </div>
        </div>

        <dl class="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs">
          <div><dt class="inline text-muted">Terealisasi </dt><dd class="num inline" :class="changeClass(account.realized_pnl)">{{ usd(account.realized_pnl) }}</dd></div>
          <div><dt class="inline text-muted">Belum terealisasi </dt><dd class="num inline" :class="changeClass(account.unrealized_pnl)">{{ usd(account.unrealized_pnl) }}</dd></div>
          <div><dt class="inline text-muted">Fee </dt><dd class="num inline">{{ usd(account.fees_paid) }}</dd></div>
          <div>
            <dt class="inline text-muted">Hari ini </dt><dd class="num inline" :class="changeClass(account.realized_today)">{{ usd(account.realized_today) }}</dd>
            <span v-if="account.limits.max_daily_loss_pct > 0" class="text-muted"> · batas rugi {{ account.limits.max_daily_loss_pct }}% ekuitas</span>
          </div>
        </dl>

        <div class="mt-4">
          <EquityChart v-if="account.curve.length >= 2" :points="account.curve" :baseline="account.starting_balance" />
          <p v-else class="rounded-lg border border-dashed border-line p-6 text-center text-sm text-muted">Kurva terisi tiap 15 menit dan baru tampil setelah ada dua catatan. Riwayat sebelum fitur ini aktif tidak bisa dibuat ulang.</p>
          <p v-if="account.curve.length >= 2" class="mt-2 text-xs text-muted">Garis putus-putus adalah saldo awal. Dicatat sejak {{ dateTime(account.curve_started_at) }}, jadi drawdown sebelum tanggal itu tidak terhitung.</p>
        </div>
      </section>
    </template>
  </div>
</template>
