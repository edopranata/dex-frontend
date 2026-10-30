<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppDatePicker from '@/components/AppDatePicker.vue'
import AppSelect, { type SelectOption } from '@/components/AppSelect.vue'
import EmptyState from '@/components/EmptyState.vue'
import StatCard from '@/components/StatCard.vue'
import TokenAvatar from '@/components/TokenAvatar.vue'
import { usePolling } from '@/composables/usePolling'
import { api } from '@/lib/api'
import { changeClass, dateTime, pct, price, qty, usd } from '@/lib/format'
import { tokenPath } from '@/lib/links'
import type { Order, OrderHistorySummary, OrderStatus, OrderType, Paginated, Portfolio, Side, Token } from '@/lib/types'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const portfolio = ref<Portfolio | null>(null)
const orders = ref<Order[]>([])
const summary = ref<OrderHistorySummary | null>(null)
const meta = ref<Paginated<Order>['meta'] | null>(null)
const tokens = ref<Token[]>([])
const page = ref(1)

interface OrderFilters {
  scope: '' | 'open_positions'
  from: string | null
  to: string | null
  token_id: number | ''
  side: '' | Side
  type: '' | OrderType
  status: '' | OrderStatus
  source: '' | 'signal' | 'manual'
  result: '' | 'profit' | 'loss'
}

const emptyFilters: OrderFilters = { scope: '', from: null, to: null, token_id: '', side: '', type: '', status: '', source: '', result: '' }

/** Filters live in the URL, so a filtered history survives a reload and can be shared. */
function filtersFromQuery(): OrderFilters {
  const q = route.query
  const text = (key: string) => (typeof q[key] === 'string' ? (q[key] as string) : '')
  return {
    scope: text('scope') === 'open_positions' ? 'open_positions' : '',
    from: text('from') || null,
    to: text('to') || null,
    token_id: Number(text('token_id')) || '',
    side: text('side') as OrderFilters['side'],
    type: text('type') as OrderFilters['type'],
    status: text('status') as OrderFilters['status'],
    source: text('source') as OrderFilters['source'],
    result: text('result') as OrderFilters['result'],
  }
}

const filters = reactive<OrderFilters>(filtersFromQuery())

/** Only the filters that are set, as query/API params. */
const activeFilters = computed(() =>
  Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== '' && value !== null)) as Record<string, string | number>,
)
const filterCount = computed(() => Object.keys(activeFilters.value).length)

let latestRequest = 0

async function loadOrders() {
  const request = ++latestRequest
  const { data } = await api.get<Paginated<Order> & { summary: OrderHistorySummary }>('/orders', {
    params: { ...activeFilters.value, page: page.value, tz: Intl.DateTimeFormat().resolvedOptions().timeZone },
  })
  // A slower poll must not overwrite the result of a newer filter change.
  if (request !== latestRequest) return
  orders.value = data.data
  meta.value = data.meta
  summary.value = data.summary
}

async function load() {
  const [p] = await Promise.all([api.get<Portfolio>('/portfolio'), loadOrders()])
  portfolio.value = p.data
}

usePolling(load, 10000)
api.get<{ data: Token[] }>('/tokens').then(({ data }) => (tokens.value = data.data))

watch(
  filters,
  () => {
    page.value = 1
    router.replace({ query: activeFilters.value })
    loadOrders()
  },
  { deep: true },
)
watch(page, loadOrders)

function resetFilters() {
  Object.assign(filters, emptyFilters)
}

/** Local "YYYY-MM-DD", matching the date picker. */
function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const periods = [
  { days: 1, label: 'Hari ini' },
  { days: 7, label: '7 hari' },
  { days: 30, label: '30 hari' },
  { days: 90, label: '90 hari' },
]

function periodFrom(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - (days - 1))
  return dayKey(date)
}

function isPeriod(days: number): boolean {
  return filters.from === periodFrom(days) && filters.to === dayKey(new Date())
}

function setPeriod(days: number | null) {
  filters.from = days ? periodFrom(days) : null
  filters.to = days ? dayKey(new Date()) : null
}

/** Tokens to filter by: everything still tracked plus anything held, by symbol. */
const tokenOptions = computed<SelectOption<number | ''>[]>(() => {
  const byId = new Map<number, Token>()
  for (const t of [...tokens.value, ...(portfolio.value?.positions.map((p) => p.token) ?? [])]) byId.set(t.id, t)
  return [
    { value: '', label: 'Semua token' },
    ...[...byId.values()].sort((a, b) => a.symbol.localeCompare(b.symbol)).map((t) => ({ value: t.id, label: t.symbol, hint: t.chain_label })),
  ]
})

const sideOptions: SelectOption<OrderFilters['side']>[] = [
  { value: '', label: 'Beli & jual' },
  { value: 'buy', label: 'Beli' },
  { value: 'sell', label: 'Jual' },
]
const typeOptions: SelectOption<OrderFilters['type']>[] = [
  { value: '', label: 'Semua jenis' },
  { value: 'market', label: 'Market' },
  { value: 'limit', label: 'Limit' },
  { value: 'stop_loss', label: 'Stop Loss' },
  { value: 'take_profit', label: 'Take Profit' },
]
const statusOptions: SelectOption<OrderFilters['status']>[] = [
  { value: '', label: 'Semua status' },
  { value: 'filled', label: 'Terisi' },
  { value: 'pending', label: 'Menunggu', hint: 'Limit / SL / TP yang belum tersentuh' },
  { value: 'cancelled', label: 'Dibatalkan' },
  { value: 'rejected', label: 'Ditolak' },
]
const sourceOptions: SelectOption<OrderFilters['source']>[] = [
  { value: '', label: 'Semua sumber' },
  { value: 'signal', label: 'Dari sinyal', hint: 'Ikuti sinyal, termasuk dari Telegram' },
  { value: 'manual', label: 'Manual' },
]
const resultOptions: SelectOption<OrderFilters['result']>[] = [
  { value: '', label: 'Semua hasil' },
  { value: 'profit', label: 'Untung', hint: 'Penjualan dengan P&L positif' },
  { value: 'loss', label: 'Rugi', hint: 'Penjualan dengan P&L negatif' },
]

const winRate = computed(() => {
  const s = summary.value
  return s && s.wins + s.losses > 0 ? (s.wins / (s.wins + s.losses)) * 100 : null
})

async function cancel(order: Order) {
  await api.delete(`/orders/${order.id}`)
  await load()
}

async function reset() {
  if (!confirm('Reset portofolio? Semua posisi dan riwayat order akan dihapus dan saldo kembali ke modal awal.')) return
  await api.post('/portfolio/reset')
  await Promise.all([load(), auth.fetchUser()])
}

const typeLabel: Record<string, string> = { market: 'Market', limit: 'Limit', stop_loss: 'Stop Loss', take_profit: 'Take Profit' }
const statusLabel: Record<string, string> = { filled: 'Terisi', pending: 'Menunggu', cancelled: 'Dibatalkan', rejected: 'Ditolak' }
const statusClass: Record<string, string> = { filled: 'text-up', pending: 'text-warn', cancelled: 'text-muted', rejected: 'text-down' }
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center">
      <h1 class="text-xl font-semibold">Portofolio</h1>
      <button class="btn-ghost ml-auto text-down" @click="reset">Reset portofolio</button>
    </div>

    <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard label="Ekuitas" :amount="portfolio?.equity_usd" :format="usd" :hint="`Modal awal ${usd(portfolio?.starting_balance)}`" />
      <StatCard label="Total P&L" :amount="portfolio?.total_pnl" :format="usd" :hint="pct(portfolio?.total_pnl_pct)" :tone="(portfolio?.total_pnl ?? 0) >= 0 ? 'up' : 'down'" style="animation-delay: 60ms" />
      <StatCard label="P&L terealisasi" :amount="portfolio?.realized_pnl" :format="usd" :tone="(portfolio?.realized_pnl ?? 0) >= 0 ? 'up' : 'down'" style="animation-delay: 120ms" />
      <StatCard label="Fee dibayar" :amount="portfolio?.fees_paid" :format="usd" :hint="`${portfolio?.trades ?? 0} transaksi`" style="animation-delay: 180ms" />
    </div>

    <section class="card overflow-x-auto">
      <h2 class="card-title p-4 pb-2">Posisi terbuka</h2>
      <table v-if="portfolio?.positions.length" class="table">
        <thead>
          <tr>
            <th>Token</th>
            <th class="text-right!">Jumlah</th>
            <th class="text-right!">Harga rata-rata</th>
            <th class="text-right!">Harga sekarang</th>
            <th class="text-right!">Nilai</th>
            <th class="text-right!">P&L</th>
          </tr>
        </thead>
        <TransitionGroup tag="tbody" name="row">
          <tr v-for="p in portfolio.positions" :key="p.id" class="cursor-pointer hover:bg-panel-2/50" @click="$router.push(tokenPath(p.token))">
            <td>
              <div class="flex items-center gap-2">
                <TokenAvatar :src="p.token.image_url" :symbol="p.token.symbol" :size="22" />{{ p.token.symbol }}
              </div>
            </td>
            <td class="num text-right">{{ qty(p.quantity) }}</td>
            <td class="num text-right">{{ price(p.avg_price) }}</td>
            <td class="num text-right">{{ price(p.current_price) }}</td>
            <td class="num text-right">{{ usd(p.value_usd) }}</td>
            <td class="num text-right" :class="changeClass(p.unrealized_pnl)">{{ usd(p.unrealized_pnl) }} ({{ pct(p.unrealized_pnl_pct) }})</td>
          </tr>
        </TransitionGroup>
      </table>
      <EmptyState v-else title="Belum ada posisi" description="Buka halaman Market, pilih token, lalu beli atau ikuti sinyal." />
    </section>

    <section class="card">
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2 p-4 pb-3">
        <h2 class="card-title">Riwayat order</h2>
        <div class="inline-flex rounded-lg border border-line bg-panel-2/60 p-0.5 text-xs" role="group" aria-label="Cakupan">
          <button
            v-for="s in [{ value: '', label: 'Semua' }, { value: 'open_positions', label: 'Posisi terbuka' }] as const"
            :key="s.value"
            type="button"
            class="rounded-md px-3 py-1 transition-colors duration-150"
            :class="filters.scope === s.value ? 'bg-brand/20 font-medium text-text' : 'text-muted hover:text-text'"
            :aria-pressed="filters.scope === s.value"
            @click="filters.scope = s.value"
          >
            {{ s.label }}
          </button>
        </div>

        <dl v-if="summary" class="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <div class="flex gap-1.5"><dt class="text-muted">Order</dt><dd class="num">{{ summary.orders }}</dd></div>
          <div class="flex gap-1.5">
            <dt class="text-muted">P&amp;L terealisasi</dt>
            <dd class="num" :class="changeClass(summary.realized_pnl)">{{ usd(summary.realized_pnl) }}</dd>
          </div>
          <div v-if="winRate !== null" class="flex gap-1.5" :title="`${summary.wins} untung, ${summary.losses} rugi`">
            <dt class="text-muted">Win rate</dt>
            <dd class="num">{{ winRate.toFixed(0) }}% <span class="text-muted">({{ summary.wins }}/{{ summary.wins + summary.losses }})</span></dd>
          </div>
          <div class="flex gap-1.5"><dt class="text-muted">Fee</dt><dd class="num">{{ usd(summary.fees) }}</dd></div>
        </dl>
      </div>

      <div class="space-y-2 border-y border-line bg-panel-2/25 px-4 py-3">
        <div class="flex flex-wrap items-center gap-2">
          <div class="flex flex-wrap gap-1" role="group" aria-label="Periode">
            <button
              v-for="period in periods"
              :key="period.days"
              type="button"
              class="rounded-full border px-2.5 py-1 text-xs transition-colors duration-150"
              :class="isPeriod(period.days) ? 'border-brand/60 bg-brand/15 text-text' : 'border-line text-muted hover:border-muted/60 hover:text-text'"
              :aria-pressed="isPeriod(period.days)"
              @click="setPeriod(isPeriod(period.days) ? null : period.days)"
            >
              {{ period.label }}
            </button>
          </div>
          <div class="flex items-center gap-1.5">
            <AppDatePicker v-model="filters.from" class="w-40" placeholder="Dari tanggal" aria-label="Dari tanggal" :max="filters.to" />
            <span class="text-muted">–</span>
            <AppDatePicker v-model="filters.to" class="w-40" placeholder="Sampai tanggal" aria-label="Sampai tanggal" :min="filters.from" />
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <AppSelect v-model="filters.token_id" aria-label="Token" :options="tokenOptions" />
          <AppSelect v-model="filters.side" aria-label="Arah" :options="sideOptions" />
          <AppSelect v-model="filters.type" aria-label="Jenis order" :options="typeOptions" />
          <AppSelect v-model="filters.status" aria-label="Status" :options="statusOptions" />
          <AppSelect v-model="filters.source" aria-label="Sumber" :options="sourceOptions" />
          <AppSelect v-model="filters.result" aria-label="Hasil" :options="resultOptions" />
          <Transition name="fade">
            <button v-if="filterCount" type="button" class="btn-ghost py-1.5 text-xs" @click="resetFilters">Reset filter ({{ filterCount }})</button>
          </Transition>
        </div>
      </div>

      <div class="overflow-x-auto">
        <table v-if="orders.length" class="table">
          <thead>
            <tr>
              <th>Waktu</th>
              <th>Token</th>
              <th>Jenis</th>
              <th class="text-right!">Pemicu</th>
              <th class="text-right!">Harga isi</th>
              <th class="text-right!">Total</th>
              <th class="text-right!">Fee</th>
              <th class="text-right!">Slippage</th>
              <th class="text-right!">P&L</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <TransitionGroup tag="tbody" name="row">
            <tr v-for="o in orders" :key="o.id">
              <td class="text-xs whitespace-nowrap text-muted">{{ dateTime(o.filled_at ?? o.created_at) }}</td>
              <td>
                <RouterLink v-if="o.token" :to="tokenPath(o.token)" class="hover:text-brand">{{ o.token.symbol }}</RouterLink>
              </td>
              <td class="whitespace-nowrap">
                <span :class="o.side === 'buy' ? 'text-up' : 'text-down'">{{ o.side === 'buy' ? 'Beli' : 'Jual' }}</span> {{ typeLabel[o.type] }}
                <span v-if="o.signal_id" class="badge-mini ml-1 bg-brand/15 text-brand" title="Order dari sinyal">Sinyal</span>
              </td>
              <td class="num text-right">{{ price(o.trigger_price) }}</td>
              <td class="num text-right">{{ price(o.filled_price) }}</td>
              <td class="num text-right">{{ usd(o.total_usd ?? o.amount_usd) }}</td>
              <td class="num text-right text-muted">{{ usd(o.fee_usd) }}</td>
              <td class="num text-right text-muted">{{ o.slippage_pct !== null ? pct(o.slippage_pct, 3) : '–' }}</td>
              <td class="num text-right" :class="changeClass(o.realized_pnl)">{{ o.realized_pnl !== null ? usd(o.realized_pnl) : '' }}</td>
              <td class="text-xs" :class="statusClass[o.status]" :title="o.note ?? ''">{{ statusLabel[o.status] ?? o.status }}</td>
              <td><button v-if="o.status === 'pending'" class="text-xs text-down hover:underline" @click="cancel(o)">Batal</button></td>
            </tr>
          </TransitionGroup>
        </table>
        <div v-else-if="filterCount" class="flex flex-col items-center gap-3 py-10 text-center">
          <p class="text-sm text-muted">Tidak ada order yang cocok dengan filter ini.</p>
          <button type="button" class="btn-ghost text-xs" @click="resetFilters">Reset filter</button>
        </div>
        <EmptyState v-else title="Belum ada order" />
      </div>

      <div v-if="meta && meta.last_page > 1" class="flex items-center justify-between gap-2 border-t border-line px-4 py-3 text-xs text-muted">
        <span>Halaman {{ meta.current_page }} dari {{ meta.last_page }} · {{ meta.total }} order</span>
        <div class="flex gap-2">
          <button type="button" class="btn-ghost py-1 text-xs" :disabled="page <= 1" @click="page--">← Sebelumnya</button>
          <button type="button" class="btn-ghost py-1 text-xs" :disabled="page >= meta.last_page" @click="page++">Berikutnya →</button>
        </div>
      </div>
    </section>
  </div>
</template>
