<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import EmptyState from '@/components/EmptyState.vue'
import WhaleTable from '@/components/WhaleTable.vue'
import { usePolling } from '@/composables/usePolling'
import { api } from '@/lib/api'
import { usd } from '@/lib/format'
import type { Token, WhaleTrade } from '@/lib/types'
import { tokenPath } from '@/lib/links'
import AppSelect from '@/components/AppSelect.vue'
import type { SelectOption } from '@/components/AppSelect.vue'

interface Summary {
  token_id: number
  buy_usd: string
  sell_usd: string
  trades: number
}

const trades = ref<WhaleTrade[]>([])
const summary = ref<Summary[]>([])
const tokens = ref<Token[]>([])
const tokenId = ref<number | ''>('')
const side = ref<'' | 'buy' | 'sell'>('')
const hours = ref(24)

const tokenOptions = computed<SelectOption<number | ''>[]>(() => [
  { value: '', label: 'Semua token' },
  ...tokens.value.map((t) => ({ value: t.id, label: `${t.symbol} (${t.chain_label})` })),
])
const sideOptions: SelectOption<typeof side.value>[] = [
  { value: '', label: 'Beli & jual' },
  { value: 'buy', label: 'Hanya beli' },
  { value: 'sell', label: 'Hanya jual' },
]
const hourOptions: SelectOption<number>[] = [
  { value: 6, label: '6 jam' },
  { value: 24, label: '24 jam' },
  { value: 72, label: '3 hari' },
  { value: 168, label: '7 hari' },
]

async function load() {
  const params: Record<string, unknown> = { hours: hours.value }
  if (tokenId.value) params.token_id = tokenId.value
  if (side.value) params.side = side.value
  const { data } = await api.get<{ data: WhaleTrade[]; summary: Summary[] }>('/whales', { params })
  trades.value = data.data
  summary.value = data.summary
}

usePolling(load, 60000)
watch([tokenId, side, hours], load)
api.get<{ data: Token[] }>('/tokens').then(({ data }) => (tokens.value = data.data))

const flows = computed(() =>
  summary.value
    .map((s) => {
      const buy = Number(s.buy_usd)
      const sell = Number(s.sell_usd)
      const token = tokens.value.find((t) => t.id === s.token_id)
      return { ...s, buy, sell, net: buy - sell, token, symbol: token?.symbol ?? `#${s.token_id}` }
    })
    .sort((a, b) => b.net - a.net),
)
const maxFlow = computed(() => Math.max(1, ...flows.value.map((f) => Math.max(f.buy, f.sell))))
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center gap-3">
      <h1 class="text-xl font-semibold">Whale Tracker</h1>
      <AppSelect v-model="tokenId" aria-label="Token" :options="tokenOptions" />
      <AppSelect v-model="side" aria-label="Arah" :options="sideOptions" />
      <AppSelect v-model="hours" aria-label="Periode" :options="hourOptions" />
    </div>

    <section v-if="flows.length" class="card p-4">
      <h2 class="card-title">Arus dana whale per token</h2>
      <ul class="mt-3 space-y-3">
        <li v-for="f in flows" :key="f.token_id" class="grid grid-cols-[4rem_1fr_7rem] items-center gap-3 text-sm">
          <RouterLink :to="tokenPath(f.token, f.token_id)" class="font-medium hover:text-brand">{{ f.symbol }}</RouterLink>
          <div class="space-y-1">
            <div class="h-2 rounded bg-up/70" :style="{ width: `${(f.buy / maxFlow) * 100}%` }" :title="`Beli ${usd(f.buy)}`" />
            <div class="h-2 rounded bg-down/70" :style="{ width: `${(f.sell / maxFlow) * 100}%` }" :title="`Jual ${usd(f.sell)}`" />
          </div>
          <div class="num text-right text-xs" :class="f.net >= 0 ? 'text-up' : 'text-down'">
            Net {{ usd(f.net, true) }}<br /><span class="text-muted">{{ f.trades }} trx</span>
          </div>
        </li>
      </ul>
    </section>

    <section class="card">
      <WhaleTable v-if="trades.length" :trades="trades" show-token />
      <EmptyState v-else title="Tidak ada transaksi whale pada filter ini" description="Data diambil dari GeckoTerminal tiap 10 menit (transaksi 24 jam terakhir per pool)." />
    </section>
  </div>
</template>
