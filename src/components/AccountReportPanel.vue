<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import RecommendationBadge from '@/components/RecommendationBadge.vue'
import Skeleton from '@/components/Skeleton.vue'
import { usePolling } from '@/composables/usePolling'
import { api } from '@/lib/api'
import { changeClass, dateTime, price, usd } from '@/lib/format'
import type { AccountLot, AccountReportData, LotExit } from '@/lib/types'

const props = defineProps<{ accountKey: string; version: string; view: 'summary' | 'lots' }>()

const report = ref<AccountReportData | null>(null)

async function load() {
  const key = props.accountKey
  const { data } = await api.get<AccountReportData>(`/reports/accounts/${key}/report`, { params: props.version ? { version: props.version } : {} })
  if (key === props.accountKey) report.value = data
}

usePolling(load, 60000)
watch(
  () => [props.accountKey, props.version],
  () => {
    report.value = null
    load()
  },
)

const exitLabel: Record<LotExit, string> = {
  all_targets: 'Semua target (TP3)',
  breakeven: 'Target lalu breakeven',
  stop_loss: 'Stop loss',
  signal_closed: 'Ditutup bersama sinyal',
  data_closure: 'Penutupan data',
  other: 'Lainnya',
}

const reasonLabel: Record<string, string> = {
  position_limit: 'Slot posisi penuh',
  daily_loss: 'Batas rugi harian',
  below_minimum: 'Ukuran di bawah minimum',
  rejected: 'Ditolak saat order',
}

function r(value: number | null | undefined): string {
  if (value === null || value === undefined) return '–'
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}R`
}

function hours(value: number | null): string {
  if (value === null) return '–'
  return value >= 48 ? `${(value / 24).toFixed(1)} hari` : `${value.toFixed(1)} jam`
}

function week(start: string): string {
  const from = new Date(`${start}T00:00:00`)
  const to = new Date(from.getTime() + 6 * 86400000)
  const format = (date: Date) => date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
  return `${format(from)} – ${format(to)}`
}

const funnelRows = computed(() => {
  const f = report.value?.funnel
  if (!f) return []
  const rows: { label: string; value: number; hint?: string; tone?: string }[] = [
    { label: 'Sinyal muncul', value: f.signals, hint: 'Rekomendasi yang diikuti akun ini, sejak akun dibuat' },
    { label: 'Dibeli', value: f.bought, hint: [`${f.filled} terisi`, f.waiting ? `${f.waiting} menunggu entry` : '', f.cancelled ? `${f.cancelled} batal sebelum terisi` : ''].filter(Boolean).join(' · ') },
    {
      label: 'Dilewati',
      value: f.skipped,
      tone: 'text-warn',
      hint: Object.entries(f.skipped_by_reason)
        .map(([reason, count]) => `${reasonLabel[reason] ?? reason} ${count}`)
        .join(' · '),
    },
  ]
  if (f.unknown) rows.push({ label: 'Tanpa catatan', value: f.unknown, hint: 'Sebelum keputusan dicatat dan tidak ada di log' })
  rows.push({ label: 'Lot selesai', value: f.closed_lots, hint: `${f.open_lots} masih terbuka` })
  rows.push({ label: 'Lot untung', value: f.winning_lots, tone: 'text-up' })
  return rows
})

const lotFilter = ref<'all' | 'open' | 'closed'>('all')
const lots = computed<AccountLot[]>(() => (report.value?.lots ?? []).filter((lot) => lotFilter.value === 'all' || lot.status === lotFilter.value))
</script>

<template>
  <Skeleton v-if="!report" :rows="3" height="h-24" />

  <div v-else-if="view === 'summary'" class="stack-section">
    <section>
      <h3 class="text-sm font-medium">Kriteria Fase 2 untuk akun ini</h3>
      <p class="mt-0.5 text-xs text-muted">
        Dihitung dari lot akun sendiri, setelah fee dan slippage, {{ report.version ? `versi ${report.version}` : 'semua versi' }}. R lot = P&amp;L dibagi risiko saat beli (jumlah × jarak ke SL sinyal).
        Drawdown dari kurva ekuitas seluruh akun.
      </p>
      <ul class="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <li v-for="c in report.criteria" :key="c.label" class="rounded-lg border border-line p-3">
          <span class="flex items-center gap-1.5 text-xs font-medium" :class="c.passed ? 'text-up' : 'text-muted'">
            <span aria-hidden="true">{{ c.passed ? '✓' : '○' }}</span>
            {{ c.passed ? 'Lolos' : 'Belum' }}
          </span>
          <span class="mt-1 block text-sm">{{ c.label }}</span>
          <span class="num mt-0.5 block text-lg font-semibold">{{ c.value }}</span>
          <span class="block text-xs text-muted">Target {{ c.target }}</span>
          <span v-if="c.progress !== undefined" class="mt-2 block h-1.5 overflow-hidden rounded-full bg-panel-2" role="progressbar" :aria-valuenow="Math.round(c.progress * 100)" aria-valuemin="0" aria-valuemax="100">
            <span class="block h-full rounded-full bg-brand" :style="{ width: `${c.progress * 100}%` }" />
          </span>
        </li>
      </ul>
    </section>

    <slot />

    <dl class="grid grid-cols-2 gap-3 text-sm lg:grid-cols-4">
      <div class="rounded-lg border border-line p-3">
        <dt class="text-xs text-muted">Win rate lot</dt>
        <dd class="num text-lg font-semibold">{{ report.summary.win_rate === null ? '–' : `${report.summary.win_rate}%` }}</dd>
        <dd class="text-xs text-muted">{{ report.summary.wins }} dari {{ report.summary.lots }} lot selesai</dd>
      </div>
      <div class="rounded-lg border border-line p-3">
        <dt class="text-xs text-muted">P&amp;L lot selesai</dt>
        <dd class="num text-lg font-semibold" :class="changeClass(report.summary.pnl_usd)">{{ usd(report.summary.pnl_usd) }}</dd>
        <dd class="text-xs text-muted">Rata-rata lama {{ hours(report.summary.avg_hours) }}</dd>
      </div>
      <div class="rounded-lg border border-line p-3">
        <dt class="text-xs text-muted">R akun vs R sinyal</dt>
        <dd class="num text-lg font-semibold">
          <span :class="changeClass(report.summary.total_r)">{{ r(report.summary.total_r) }}</span>
          <span class="text-sm font-normal text-muted"> / </span>
          <span class="text-sm" :class="changeClass(report.summary.signal_total_r)">{{ r(report.summary.signal_total_r) }}</span>
        </dd>
        <dd class="text-xs text-muted">Sinyal yang sama; selisihnya dari fee, slippage, dan harga isi</dd>
      </div>
      <div class="rounded-lg border border-line p-3">
        <dt class="text-xs text-muted">Sinyal dilewati yang sudah selesai</dt>
        <dd class="num text-lg font-semibold" :class="changeClass(report.funnel.missed_r)">{{ r(report.funnel.missed_r) }}</dd>
        <dd class="text-xs text-muted">{{ report.funnel.missed_signals }} sinyal, hasil sinyalnya (bukan akun)</dd>
      </div>
    </dl>

    <div class="grid items-start gap-section lg:grid-cols-2">
      <section>
        <h3 class="text-sm font-medium">Corong sinyal</h3>
        <ul class="mt-2 space-y-2">
          <li v-for="row in funnelRows" :key="row.label">
            <div class="flex items-baseline justify-between gap-3 text-sm">
              <span :class="row.tone">{{ row.label }}</span>
              <span class="num font-semibold">{{ row.value }}</span>
            </div>
            <span class="mt-1 block h-1.5 overflow-hidden rounded-full bg-panel-2">
              <span class="block h-full rounded-full bg-brand/70" :style="{ width: `${report.funnel.signals ? (row.value / report.funnel.signals) * 100 : 0}%` }" />
            </span>
            <span v-if="row.hint" class="mt-0.5 block text-xs text-muted">{{ row.hint }}</span>
          </li>
        </ul>
      </section>

      <section class="overflow-x-auto">
        <h3 class="text-sm font-medium">Cara lot berakhir</h3>
        <table v-if="report.exits.length" class="table mt-1">
          <thead>
            <tr>
              <th>Akhir</th>
              <th class="text-right">Lot</th>
              <th class="text-right">Total R</th>
              <th class="text-right">P&amp;L</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="e in report.exits" :key="e.exit">
              <td>{{ exitLabel[e.exit] }}</td>
              <td class="num text-right">{{ e.lots }}</td>
              <td class="num text-right" :class="changeClass(e.total_r)">{{ r(e.total_r) }}</td>
              <td class="num text-right" :class="changeClass(e.pnl_usd)">{{ usd(e.pnl_usd) }}</td>
            </tr>
          </tbody>
        </table>
        <p v-else class="mt-2 text-sm text-muted">Belum ada lot selesai pada versi ini.</p>
      </section>
    </div>

    <section class="overflow-x-auto">
      <h3 class="text-sm font-medium">Per minggu</h3>
      <table v-if="report.weeks.length" class="table mt-1">
        <thead>
          <tr>
            <th>Minggu (WIB)</th>
            <th class="text-right">Lot</th>
            <th class="text-right">Win rate</th>
            <th class="text-right">Total R</th>
            <th class="text-right">P&amp;L</th>
            <th class="text-right">Kumulatif</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="w in report.weeks" :key="w.week_start">
            <td class="whitespace-nowrap">{{ week(w.week_start) }}</td>
            <td class="num text-right">{{ w.lots }}</td>
            <td class="num text-right">{{ w.win_rate === null ? '–' : `${w.win_rate}%` }}</td>
            <td class="num text-right" :class="changeClass(w.total_r)">{{ r(w.total_r) }}</td>
            <td class="num text-right" :class="changeClass(w.pnl_usd)">{{ usd(w.pnl_usd) }}</td>
            <td class="num text-right" :class="changeClass(w.cumulative_pnl_usd)">{{ usd(w.cumulative_pnl_usd) }}</td>
          </tr>
        </tbody>
      </table>
      <p v-else class="mt-2 text-sm text-muted">Belum ada lot selesai pada versi ini.</p>
    </section>
  </div>

  <section v-else class="overflow-x-auto">
    <div class="flex flex-wrap items-center gap-2">
      <p class="mr-auto text-xs text-muted">Satu lot = satu sinyal yang dibeli akun ini. Klik Grafik untuk melihat kapan lot dibeli dan dijual.</p>
      <div class="inline-flex rounded-lg border border-line bg-panel-2/60 p-0.5 text-xs" role="tablist" aria-label="Status lot">
        <button
          v-for="f in [{ value: 'all', label: 'Semua' }, { value: 'open', label: 'Terbuka' }, { value: 'closed', label: 'Selesai' }] as const"
          :key="f.value"
          type="button"
          role="tab"
          class="rounded-md px-3 py-1 transition-colors duration-150"
          :class="lotFilter === f.value ? 'bg-brand/20 font-medium text-text' : 'text-muted hover:text-text'"
          :aria-selected="lotFilter === f.value"
          @click="lotFilter = f.value"
        >
          {{ f.label }}
        </button>
      </div>
    </div>
    <table v-if="lots.length" class="table mt-2">
      <thead>
        <tr>
          <th>Token</th>
          <th>Sinyal</th>
          <th>Beli</th>
          <th>Keluar</th>
          <th class="text-right">Lama</th>
          <th class="text-right">R lot</th>
          <th class="text-right">P&amp;L</th>
          <th><span class="sr-only">Grafik</span></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="lot in lots" :key="lot.id">
          <td class="font-medium whitespace-nowrap">{{ lot.token.symbol }}</td>
          <td class="whitespace-nowrap">
            <span class="flex items-center gap-1.5">
              <span class="num text-xs text-muted">#{{ lot.signal.id }}</span>
              <RecommendationBadge :value="lot.signal.recommendation" />
            </span>
            <span class="block text-[11px] text-muted">{{ lot.signal.version ?? '–' }} · sinyal {{ r(lot.signal.net_r) }}</span>
          </td>
          <td class="whitespace-nowrap">
            <span class="num">{{ price(lot.buy_price) }}</span>
            <span class="block text-[11px] text-muted">{{ dateTime(lot.bought_at) }} · {{ usd(lot.amount_usd) }}</span>
          </td>
          <td class="whitespace-nowrap">
            <template v-if="lot.status === 'closed'">
              <span class="num">{{ price(lot.exit_price) }}</span>
              <span class="block text-[11px] text-muted">{{ dateTime(lot.closed_at) }} · {{ lot.exit ? exitLabel[lot.exit] : '–' }}</span>
            </template>
            <template v-else>
              <span class="text-xs font-medium text-brand">Terbuka</span>
              <span class="block text-[11px] text-muted">{{ lot.targets_hit ? `TP${lot.targets_hit} tercapai` : 'Belum ada target' }}</span>
            </template>
          </td>
          <td class="num text-right whitespace-nowrap">{{ hours(lot.hours) }}</td>
          <td class="num text-right" :class="changeClass(lot.r)">{{ r(lot.r) }}</td>
          <td class="num text-right whitespace-nowrap">
            <span :class="changeClass(lot.pnl_usd)">{{ usd(lot.pnl_usd) }}</span>
            <span v-if="lot.unrealized_usd !== null" class="block text-[11px]" :class="changeClass(lot.unrealized_usd)">± {{ usd(lot.unrealized_usd) }} terbuka</span>
          </td>
          <td>
            <RouterLink :to="{ path: `/tokens/${lot.token.slug}`, query: { lot: lot.id } }" class="text-xs text-brand hover:underline">Grafik</RouterLink>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-else class="mt-2 text-sm text-muted">Tidak ada lot untuk pilihan ini.</p>
  </section>
</template>
