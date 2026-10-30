<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import EmptyState from '@/components/EmptyState.vue'
import WhaleFlowChart from '@/components/WhaleFlowChart.vue'
import type { WhaleFlowSummary } from '@/components/WhaleFlowChart.vue'
import WhaleTable from '@/components/WhaleTable.vue'
import { usePolling } from '@/composables/usePolling'
import { api } from '@/lib/api'
import type { Token, WhaleTrade } from '@/lib/types'
import AppSelect from '@/components/AppSelect.vue'
import type { SelectOption } from '@/components/AppSelect.vue'

const trades = ref<WhaleTrade[]>([])
const summary = ref<WhaleFlowSummary[]>([])
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
  const { data } = await api.get<{ data: WhaleTrade[]; summary: WhaleFlowSummary[] }>('/whales', { params })
  trades.value = data.data
  summary.value = data.summary
}

usePolling(load, 60000)
watch([tokenId, side, hours], load)
api.get<{ data: Token[] }>('/tokens').then(({ data }) => (tokens.value = data.data))

</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center gap-3">
      <h1 class="text-xl font-semibold">Whale Tracker</h1>
      <AppSelect v-model="tokenId" aria-label="Token" :options="tokenOptions" />
      <AppSelect v-model="side" aria-label="Arah" :options="sideOptions" />
      <AppSelect v-model="hours" aria-label="Periode" :options="hourOptions" />
    </div>

    <WhaleFlowChart v-if="summary.length" :summary="summary" />

    <section class="card">
      <WhaleTable v-if="trades.length" :trades="trades" show-token />
      <EmptyState v-else title="Tidak ada transaksi whale pada filter ini" description="Data diambil dari GeckoTerminal tiap 10 menit (transaksi 24 jam terakhir per pool)." />
    </section>
  </div>
</template>
