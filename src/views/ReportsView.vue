<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AccountPortfolio from '@/components/AccountPortfolio.vue'
import AccountReportPanel from '@/components/AccountReportPanel.vue'
import AppSelect from '@/components/AppSelect.vue'
import EquityChart from '@/components/EquityChart.vue'
import MarketCells, { type MarketAt } from '@/components/MarketCells.vue'
import RecommendationBadge from '@/components/RecommendationBadge.vue'
import ShadowSignalList from '@/components/ShadowSignalList.vue'
import Skeleton from '@/components/Skeleton.vue'
import StatCard from '@/components/StatCard.vue'
import { usePolling } from '@/composables/usePolling'
import { api } from '@/lib/api'
import { changeClass, dateTime, pct, price, usd } from '@/lib/format'
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
  chains: string[] | null
  realized_today: number
  daily_loss_reached: boolean
  has_room: boolean
}

/** One signal under a candidate v5 rule: its real result, what the rule did to it, and the market at entry. */
interface ShadowExitRow {
  id: number
  symbol: string
  slug: string
  entered_at: string
  actual_r: number
  shadow_r: number
  action: 'unchanged' | 'skipped' | 'exit' | 'later_entry'
  rule_entry_at?: string | null
  rule_entry_price?: number | null
  exit_at: string | null
  exit_price: number | null
  taken: number | null
  held: boolean
  /** Entered while the rule still held an earlier signal on the same token: left out of one position per token. */
  overlapping?: boolean
  gappy: boolean
  market: MarketAt
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
  chains: (Summary & { chain: string; label: string; by_recommendation: Partial<Record<Recommendation, Summary>> })[]
  accounts: Account[]
  shadow_exit: { key: string; label: string; since: string; signals: number; affected: number; actual_r: number; shadow_r: number; held?: number; held_r?: number; overlapping?: number; one_per_token_r?: number; gaps?: number; rows?: ShadowExitRow[] }[]
  holder_filter?: { rule: string; recorded: number; open: number; overlap: number; not_entered: number; trades: number; wins: number; total_r: number; avg_r: number | null; gaps?: number; gap_r?: number }[]
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
const accountTab = ref<'summary' | 'lots' | 'portfolio'>('summary')
const accountTabs = [
  { value: 'summary', label: 'Ringkasan' },
  { value: 'lots', label: 'Daftar lot' },
  { value: 'portfolio', label: 'Portofolio' },
] as const
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

// One open detail per table: the rule or group key whose signals are listed under it.
const openVariant = ref<string | null>(null)
const openGroup = ref<string | null>(null)

function ruleAction(row: ShadowExitRow): string {
  if (row.action === 'unchanged') return 'Tidak berubah'
  if (row.action === 'skipped') return 'Tidak dibuka (0R)'
  const after = row.taken ? ` setelah target ${row.taken}` : ''
  if (row.action === 'later_entry') {
    const entry = `Entry ${dateTime(row.rule_entry_at)} di ${price(row.rule_entry_price)}, `
    return row.held ? `${entry}masih dipegang, dinilai di close ${dateTime(row.exit_at)} (${price(row.exit_price)})${after}` : `${entry}keluar ${dateTime(row.exit_at)} di ${price(row.exit_price)}${after}`
  }
  if (row.held) return `Masih dipegang, dinilai di close ${dateTime(row.exit_at)} (${price(row.exit_price)})${after}`
  return `Keluar ${dateTime(row.exit_at)} di ${price(row.exit_price)}${after}`
}

const shadowRuleLabel: Record<string, string> = {
  accepted: 'Diterima (sinyal asli, diikuti sampai target atau stop)',
  top10_holders: 'Ditahan aturan holder',
  high_score: 'Strong Buy skor 77+ (tidak jadi sinyal sejak v7)',
  first_buy: 'Strong Buy pertama setelah analisa bukan Buy (tidak jadi sinyal sejak v8)',
  buy_btc_rising: 'Buy (bayangan) saat tren 4 jam BTC naik',
  buy_btc_not_rising: 'Buy (bayangan) saat tren 4 jam BTC tidak naik',
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

      <section class="card overflow-x-auto">
        <h2 class="card-title p-4 pb-1">Catatan bayangan: calon aturan v5</h2>
        <p class="px-4 pb-2 text-xs text-muted">
          Tidak mengubah trading. Tiap baris menghitung ulang sinyal yang sudah selesai seandainya aturannya berlaku: keluar di harga analisa itu dengan target yang sudah tercapai tetap dihitung,
          atau 0R untuk sinyal yang tidak akan dibuka. Biaya dianggap sama. Hanya sinyal yang entry setelah datanya mulai dicatat yang dihitung, jadi sampelnya masih kecil.
          Jam tanpa transaksi tidak punya candle; konfirmasi candle menganggapnya candle datar tanpa volume. Data bercelah: sinyal yang harganya melompat lebih dari 2% melewati candle yang hilang (data kemungkinan tidak lengkap), atau belum punya candle sebelum entry; hasilnya tetap dihitung, tetapi kurang bisa dipercaya.
          Aturan yang bisa menahan posisi (misalnya trailing ATR) menilai posisi yang belum keluar dengan close candle terakhir: bagian "masih terbuka" di bawah R bayangan belum menjadi hasil.
          "Satu posisi per token" menghitung seperti akun sungguhan: sinyal yang entry saat aturan masih memegang sinyal sebelumnya di token yang sama tidak dibuka (0R). Selisih dihitung dari angka ini.
          Klik satu aturan untuk melihat sinyalnya satu per satu. Harga BTC, tren 4 jam BTC, dan Fear &amp; Greed diambil dari analisa token terakhir sebelum entry (snapshot pasar yang disimpan tiap analisa). Sebelum 15 Nov snapshot belum menyimpan BTC; harga (≈) dan tren (*) BTC untuk sinyal itu dihitung ulang dari candle BTC yang sudah tutup sebelum entry.
        </p>
        <table class="table">
          <thead>
            <tr>
              <th>Aturan</th>
              <th class="text-right">Sinyal</th>
              <th class="text-right">Kena aturan</th>
              <th class="text-right">R aktual</th>
              <th class="text-right">R bayangan</th>
              <th class="text-right">Satu posisi per token</th>
              <th class="text-right">Selisih</th>
              <th class="text-right">Data bercelah</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="v in report.shadow_exit" :key="v.key">
              <tr class="cursor-pointer hover:bg-panel-2/50" :aria-expanded="openVariant === v.key" @click="openVariant = openVariant === v.key ? null : v.key">
                <td>
                  <span class="mr-1 inline-block w-3 text-muted">{{ openVariant === v.key ? '▾' : '▸' }}</span>{{ v.label }}
                  <span class="block text-[11px] text-muted">Entry sejak {{ dateTime(v.since) }}</span>
                </td>
                <td class="num text-right">{{ v.signals }}</td>
                <td class="num text-right">{{ v.affected }}</td>
                <td class="num text-right" :class="changeClass(v.actual_r)">{{ r(v.actual_r) }}</td>
                <td class="num text-right" :class="changeClass(v.shadow_r)">
                  {{ r(v.shadow_r) }}
                  <span v-if="v.held" class="block text-[11px] text-warn" title="Posisi yang belum keluar, dinilai di close candle terakhir">{{ v.held }} masih terbuka: {{ r(v.held_r ?? 0) }}</span>
                </td>
                <td class="num text-right" :class="changeClass(v.one_per_token_r ?? v.shadow_r)">
                  {{ r(v.one_per_token_r ?? v.shadow_r) }}
                  <span v-if="v.overlapping" class="block text-[11px] text-muted">{{ v.overlapping }} tumpang-tindih tidak dibuka</span>
                </td>
                <td class="num text-right" :class="changeClass((v.one_per_token_r ?? v.shadow_r) - v.actual_r)">{{ v.signals ? r((v.one_per_token_r ?? v.shadow_r) - v.actual_r) : '–' }}</td>
                <td class="num text-right" :class="v.gaps ? 'text-warn' : 'text-muted'">{{ v.gaps ?? '–' }}</td>
              </tr>
              <tr v-if="openVariant === v.key">
                <td colspan="8" class="bg-panel-2/40 p-0">
                  <div v-if="v.rows?.length" class="overflow-x-auto">
                    <table class="table text-xs">
                      <thead>
                        <tr>
                          <th>Token</th>
                          <th>Entry</th>
                          <th>Yang dilakukan aturan</th>
                          <th class="text-right">R aktual</th>
                          <th class="text-right">R aturan</th>
                          <th class="text-right">Harga BTC</th>
                          <th>Tren 4 jam BTC</th>
                          <th class="text-right">Fear &amp; Greed</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="row in v.rows" :key="row.id">
                          <td class="whitespace-nowrap"><RouterLink :to="`/tokens/${row.slug}`" class="font-medium hover:text-brand">{{ row.symbol }}</RouterLink></td>
                          <td class="whitespace-nowrap">{{ dateTime(row.entered_at) }}</td>
                          <td :class="row.action === 'unchanged' ? 'text-muted' : ''">
                            {{ ruleAction(row) }}
                            <span v-if="row.overlapping" class="text-muted" title="Aturan masih memegang sinyal sebelumnya di token ini saat sinyal ini entry"> · tumpang-tindih, tidak dihitung di satu posisi per token</span>
                            <span v-if="row.gappy" class="text-warn" title="Data candle kurang lengkap untuk sinyal ini"> · bercelah</span>
                          </td>
                          <td class="num text-right" :class="changeClass(row.actual_r)">{{ r(row.actual_r) }}</td>
                          <td class="num text-right" :class="changeClass(row.shadow_r)">{{ r(row.shadow_r) }}</td>
                          <MarketCells :market="row.market" />
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p v-else class="px-4 py-2 text-xs text-muted">Belum ada sinyal untuk aturan ini.</p>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </section>

      <section v-if="report.holder_filter?.length" class="card overflow-x-auto">
        <h2 class="card-title p-4 pb-1">Sinyal bayangan: aturan holder v6 dan Buy</h2>
        <p class="px-4 pb-2 text-xs text-muted">
          Tidak mengubah trading. Strong Buy yang ditahan karena 10 holder teratas memegang 20% supply atau lebih tetap dicatat dengan level entry, stop, dan targetnya, lalu diikuti di candle 15 menit.
          Sinyal asli diikuti dengan cara yang sama sebagai pembanding, jadi angkanya bisa berbeda sedikit dari hasil sinyal di atas. Satu token hanya punya satu yang berjalan per kelompok; sisanya tidak dihitung.
          Kalau kelompok yang ditahan rugi lebih besar, aturannya bekerja.
          Sejak 15 Nov 2026 setiap Buy (yang tidak lagi menjadi sinyal sejak v5) juga diikuti dengan cara yang sama, dipisah menurut tren 4 jam BTC saat analisa, untuk menilai apakah Buy layak aktif lagi saat BTC naik. Nilai Fear &amp; Greed tiap Buy ikut tercatat.
          Data bercelah: trade selesai yang harganya melompat lebih dari 2% melewati candle 15 menit yang hilang selama diikuti, dengan total R-nya. Periode tanpa transaksi (harga sama sebelum dan sesudah) tidak dihitung.
          Klik satu kelompok untuk melihat sinyalnya satu per satu, terbaru dulu. Harga BTC, tren 4 jam BTC, dan Fear &amp; Greed diambil saat entry; untuk yang belum atau tidak entry, saat dicatat. Tanda ≈ dan * berarti BTC dihitung ulang dari candle tersimpan.
        </p>
        <table class="table">
          <thead>
            <tr>
              <th>Kelompok</th>
              <th class="text-right">Tercatat</th>
              <th class="text-right">Berjalan</th>
              <th class="text-right">Tidak entry</th>
              <th class="text-right">Trade selesai</th>
              <th class="text-right">Win rate</th>
              <th class="text-right">Total R</th>
              <th class="text-right">Rata-rata</th>
              <th class="text-right">Data bercelah</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="h in report.holder_filter" :key="h.rule">
              <tr class="cursor-pointer hover:bg-panel-2/50" :aria-expanded="openGroup === h.rule" @click="openGroup = openGroup === h.rule ? null : h.rule">
                <td><span class="mr-1 inline-block w-3 text-muted">{{ openGroup === h.rule ? '▾' : '▸' }}</span>{{ shadowRuleLabel[h.rule] ?? h.rule }}</td>
                <td class="num text-right">{{ h.recorded - h.overlap }}</td>
                <td class="num text-right">{{ h.open }}</td>
                <td class="num text-right">{{ h.not_entered }}</td>
                <td class="num text-right">{{ h.trades }}</td>
                <td class="num text-right">{{ h.trades ? Math.round((h.wins / h.trades) * 100) + '%' : '–' }}</td>
                <td class="num text-right" :class="changeClass(h.total_r)">{{ h.trades ? r(h.total_r) : '–' }}</td>
                <td class="num text-right" :class="changeClass(h.avg_r ?? 0)">{{ h.avg_r === null ? '–' : r(h.avg_r) }}</td>
                <td class="num text-right" :class="h.gaps ? 'text-warn' : 'text-muted'">{{ h.gaps ? `${h.gaps} (${r(h.gap_r ?? 0)})` : (h.gaps ?? '–') }}</td>
              </tr>
              <tr v-if="openGroup === h.rule">
                <td colspan="9" class="bg-panel-2/40 p-0"><ShadowSignalList :group="h.rule" /></td>
              </tr>
            </template>
          </tbody>
        </table>
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

      <section v-if="report.chains.length" class="card overflow-x-auto">
        <h2 class="card-title p-4 pb-1">Per jaringan</h2>
        <p class="px-4 pb-2 text-xs text-muted">Hasil sinyal per jaringan token, untuk memilih wallet jaringan mana yang dipakai nanti. Belum termasuk gas; akun Auto-follow per jaringan di bawah sudah menghitungnya.</p>
        <table class="table">
          <thead>
            <tr>
              <th>Jaringan</th>
              <th class="text-right">Sinyal</th>
              <th class="text-right">Win rate</th>
              <th class="text-right">Rata-rata</th>
              <th class="text-right">Total R</th>
              <th class="text-right">PF</th>
              <th class="text-right">Strong Buy</th>
              <th class="text-right">Buy</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in report.chains" :key="c.chain">
              <td class="font-medium whitespace-nowrap">{{ c.label }}</td>
              <td class="num text-right">{{ c.trades }}</td>
              <td class="num text-right">{{ percent(c.win_rate) }}</td>
              <td class="num text-right" :class="changeClass(c.avg_r)">{{ r(c.avg_r) }}</td>
              <td class="num text-right" :class="changeClass(c.total_r)">{{ r(c.total_r) }}</td>
              <td class="num text-right">{{ factor(c.profit_factor) }}</td>
              <td v-for="rec in ['STRONG_BUY', 'BUY'] as const" :key="rec" class="num text-right whitespace-nowrap">
                <template v-if="c.by_recommendation[rec]">
                  <span :class="changeClass(c.by_recommendation[rec]!.avg_r)">{{ r(c.by_recommendation[rec]!.avg_r) }}</span>
                  <span class="block text-[11px] text-muted">{{ c.by_recommendation[rec]!.trades }} sinyal</span>
                </template>
                <span v-else class="text-muted">–</span>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="card overflow-x-auto">
        <h2 class="card-title p-4 pb-1">Perbandingan akun Auto-follow</h2>
        <p class="px-4 pb-2 text-xs text-muted">
          Akun simulasi dengan modal dan batas risiko yang sama, masing-masing membeli rekomendasinya sendiri. Win rate dihitung dari sinyal selesai yang benar-benar dibeli akun itu. Akun per jaringan (Solana, BNB Chain, Ethereum) hanya membeli token di jaringannya dan membayar gas jaringan itu di tiap swap. Tabel ini tidak terpengaruh pilihan versi di atas; laporan per akun di bawahnya mengikuti versi. Sejak 7 Nov lot ikut ditutup saat sinyalnya selesai.
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
                <span class="block text-[11px] text-muted">{{ a.chains ? 'Per jaringan · ' : '' }}Sejak {{ a.started_at ? dateTime(a.started_at) : '–' }}</span>
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
        <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h2 class="card-title">Akun: {{ account.label }}</h2>
          <div class="inline-flex rounded-lg border border-line bg-panel-2/60 p-0.5 text-xs" role="tablist" aria-label="Isi akun">
            <button
              v-for="t in accountTabs"
              :key="t.value"
              type="button"
              role="tab"
              class="rounded-md px-3 py-1 transition-colors duration-150"
              :class="accountTab === t.value ? 'bg-brand/20 font-medium text-text' : 'text-muted hover:text-text'"
              :aria-selected="accountTab === t.value"
              @click="accountTab = t.value"
            >
              {{ t.label }}
            </button>
          </div>
        </div>

        <AccountPortfolio v-if="accountTab === 'portfolio'" class="mt-3" :account-key="account.key" />

        <AccountReportPanel v-else-if="accountTab === 'lots'" class="mt-3" :account-key="account.key" :version="version" view="lots" />

        <AccountReportPanel v-else class="mt-3" :account-key="account.key" :version="version" view="summary">
          <div class="grid grid-cols-2 gap-section lg:grid-cols-4">
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
        </AccountReportPanel>
      </section>
    </template>
  </div>
</template>
