<script setup lang="ts">
import { onMounted, ref } from 'vue'
import MarketCells, { type MarketAt } from '@/components/MarketCells.vue'
import { api } from '@/lib/api'
import { changeClass, dateTime, price } from '@/lib/format'

/** One group of the shadow signal table, signal by signal, newest first, loaded a page at a time. */
interface ShadowRow {
  id: number
  symbol: string | null
  slug: string | null
  signal_id: number | null
  recorded_at: string | null
  status: string
  metric: number | null
  entry_low: number
  entry_high: number
  stop_loss: number
  take_profits: number[]
  entry_price: number | null
  exit_price: number | null
  max_tp_hit: number | null
  net_r: number | null
  entered_at: string | null
  closed_at: string | null
  gappy: boolean
  market: MarketAt
}

interface Page {
  total: number
  page: number
  last_page: number
  rows: ShadowRow[]
}

const props = defineProps<{ group: string }>()

const rows = ref<ShadowRow[]>([])
const page = ref(0)
const lastPage = ref(1)
const total = ref(0)
const loading = ref(false)
const failed = ref(false)

async function more() {
  loading.value = true
  failed.value = false
  try {
    const { data } = await api.get<Page>('/reports/shadow-signals', { params: { group: props.group, page: page.value + 1 } })
    rows.value.push(...data.rows)
    page.value = data.page
    lastPage.value = data.last_page
    total.value = data.total
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
}

onMounted(more)

// The holder share is the metric of the v6 holder pair; for Buys the metric is Fear & Greed, already shown.
const holders = props.group === 'top10_holders' || props.group === 'accepted'

const statusLabel: Record<string, string> = {
  not_entered: 'Tidak entry',
  stop_loss: 'Kena stop',
  take_profit: 'Target',
  expired: 'Waktu habis',
}

function status(row: ShadowRow): string {
  if (row.status === 'pending') return row.entered_at ? 'Berjalan' : 'Menunggu entry'
  return statusLabel[row.status] ?? row.status
}

function r(value: number | null): string {
  return value === null ? '–' : `${value > 0 ? '+' : ''}${value.toFixed(2)}R`
}
</script>

<template>
  <div class="overflow-x-auto">
    <table class="table text-xs">
      <thead>
        <tr>
          <th>Token</th>
          <th>Dicatat</th>
          <th>Status</th>
          <th class="text-right">Zona entry</th>
          <th class="text-right">Stop</th>
          <th class="text-right">Target 1 / 2 / 3</th>
          <th>Entry</th>
          <th>Keluar</th>
          <th class="text-right">Target kena</th>
          <th class="text-right">R</th>
          <th v-if="holders" class="text-right">Top 10 holder</th>
          <th class="text-right">Harga BTC</th>
          <th>Tren 4 jam BTC</th>
          <th class="text-right">Fear &amp; Greed</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.id">
          <td class="whitespace-nowrap">
            <RouterLink v-if="row.slug" :to="`/tokens/${row.slug}`" class="font-medium hover:text-brand">{{ row.symbol }}</RouterLink>
            <span v-else>–</span>
          </td>
          <td class="whitespace-nowrap">{{ dateTime(row.recorded_at) }}</td>
          <td class="whitespace-nowrap">
            {{ status(row) }}
            <span v-if="row.gappy" class="text-warn" title="Harga melompat lebih dari 2% melewati candle 15 menit yang hilang"> · bercelah</span>
          </td>
          <td class="num whitespace-nowrap text-right">{{ price(row.entry_low) }} – {{ price(row.entry_high) }}</td>
          <td class="num whitespace-nowrap text-right">{{ price(row.stop_loss) }}</td>
          <td class="num whitespace-nowrap text-right">{{ row.take_profits.map((t) => price(t)).join(' / ') }}</td>
          <td class="num whitespace-nowrap">{{ row.entered_at ? `${dateTime(row.entered_at)} · ${price(row.entry_price)}` : '–' }}</td>
          <td class="num whitespace-nowrap">{{ row.closed_at ? `${dateTime(row.closed_at)} · ${price(row.exit_price)}` : '–' }}</td>
          <td class="num text-right">{{ row.entered_at ? `${row.max_tp_hit ?? 0}/3` : '–' }}</td>
          <td class="num text-right" :class="changeClass(row.net_r ?? 0)">{{ r(row.net_r) }}</td>
          <td v-if="holders" class="num text-right">{{ row.metric === null ? '–' : `${row.metric.toFixed(1)}%` }}</td>
          <MarketCells :market="row.market" />
        </tr>
      </tbody>
    </table>
    <div class="flex items-center gap-3 px-3 py-2 text-xs text-muted">
      <span>{{ rows.length }} dari {{ total }} sinyal</span>
      <button v-if="page < lastPage" type="button" class="font-medium text-brand hover:underline" :disabled="loading" @click="more">
        {{ loading ? 'Memuat…' : 'Muat lagi' }}
      </button>
      <span v-else-if="loading">Memuat…</span>
      <span v-if="failed" class="text-down">Gagal memuat, coba lagi.</span>
    </div>
  </div>
</template>
