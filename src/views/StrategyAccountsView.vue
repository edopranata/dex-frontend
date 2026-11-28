<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import EmptyState from '@/components/EmptyState.vue'
import Skeleton from '@/components/Skeleton.vue'
import { usePolling } from '@/composables/usePolling'
import { api } from '@/lib/api'
import { changeClass, dateTime, pct, price, usd } from '@/lib/format'
import type { StrategyAccountSummary, StrategyKind, StrategyPositionRow } from '@/lib/types'

const route = useRoute()
const router = useRouter()
const accounts = ref<StrategyAccountSummary[] | null>(null)
const positions = ref<StrategyPositionRow[] | null>(null)
const selected = computed(() => (typeof route.query.account === 'string' ? route.query.account : (accounts.value?.[0]?.key ?? null)))
const current = computed(() => accounts.value?.find((a) => a.key === selected.value) ?? null)

async function load() {
  accounts.value = (await api.get<{ accounts: StrategyAccountSummary[] }>('/reports/strategy-accounts')).data.accounts
  await loadPositions()
}

async function loadPositions() {
  if (!selected.value) return
  positions.value = (await api.get<{ positions: StrategyPositionRow[] }>(`/reports/strategy-accounts/${selected.value}`)).data.positions
}

usePolling(load, 60000)
watch(selected, () => {
  positions.value = null
  loadPositions()
})

function choose(key: string) {
  router.replace({ query: { ...route.query, account: key } })
}

const kindLabel: Record<StrategyKind, string> = { main: 'Utama', shadow: 'Bayangan', experiment: 'Eksperimen', benchmark: 'Pembanding' }
const kindClass: Record<StrategyKind, string> = {
  main: 'bg-brand/15 text-brand',
  shadow: 'bg-panel-2 text-muted',
  experiment: 'bg-warn/15 text-warn',
  benchmark: 'bg-panel-2 text-muted',
}
const statusLabel: Record<StrategyPositionRow['status'], string> = { pending: 'Order limit', open: 'Berjalan', closed: 'Selesai', cancelled: 'Batal' }

function r(value: number | null): string {
  return value === null ? '–' : `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(2).replace('.', ',')}R`
}

function day(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}
</script>

<template>
  <div class="stack-section">
    <section class="card animate-fade-up overflow-x-auto">
      <h2 class="card-title p-4 pb-2">Akun strategi dari FutureSim</h2>
      <Skeleton v-if="!accounts" class="p-3" :rows="6" />
      <EmptyState v-else-if="!accounts.length" title="Belum ada akun strategi" description="Akun dibuat saat strategies:run pertama kali berjalan." />
      <table v-else class="table">
        <thead>
          <tr>
            <th>Akun</th>
            <th>Mulai</th>
            <th class="text-right!">Ekuitas</th>
            <th class="text-right!">Hasil</th>
            <th class="text-right!">Biaya</th>
            <th class="text-right!">Posisi selesai</th>
            <th class="text-right!">Terbuka</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="a in accounts"
            :key="a.key"
            class="cursor-pointer hover:bg-panel-2/40"
            :class="a.key === selected ? 'bg-panel-2/60' : ''"
            @click="choose(a.key)"
          >
            <td>
              <span class="font-medium">{{ a.label }}</span>
              <span class="ml-2 rounded px-1.5 py-0.5 text-[10px] font-medium" :class="kindClass[a.kind]">{{ kindLabel[a.kind] }}</span>
              <span v-if="!a.is_active" class="ml-1 text-[10px] text-muted">nonaktif</span>
            </td>
            <td class="text-xs whitespace-nowrap">{{ day(a.started_at) }}</td>
            <td class="num text-right">{{ usd(a.equity) }}</td>
            <td class="num text-right" :class="changeClass(a.return_pct)">{{ pct(a.return_pct) }}</td>
            <td class="num text-right text-muted">{{ usd(a.fees_paid) }}</td>
            <td class="num text-right text-xs whitespace-nowrap">
              <template v-if="a.closed">
                <span :class="changeClass(a.net_pnl)">{{ usd(a.net_pnl) }}</span>
                <span class="text-muted"> ({{ a.wins }}/{{ a.closed }} untung)</span>
              </template>
              <span v-else class="text-muted">belum ada</span>
            </td>
            <td class="num text-right">{{ a.open }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section v-if="current" class="card animate-fade-up overflow-x-auto">
      <h2 class="card-title p-4 pb-2">Posisi · {{ current.label }}</h2>
      <Skeleton v-if="!positions" class="p-3" :rows="5" />
      <EmptyState v-else-if="!positions.length" title="Belum ada posisi" description="Strategi menunggu setup di candle DEX." />
      <table v-else class="table text-xs">
        <thead>
          <tr>
            <th>Token</th>
            <th>Status</th>
            <th>Masuk</th>
            <th class="text-right!">Harga masuk</th>
            <th class="text-right!">Stop / target</th>
            <th class="text-right!">Nominal</th>
            <th class="text-right!">Hasil</th>
            <th>Alasan</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in positions" :key="p.id" class="hover:bg-panel-2/40">
            <td class="font-medium whitespace-nowrap">
              <RouterLink v-if="p.token.slug" :to="`/tokens/${p.token.slug}`" class="hover:text-brand">{{ p.token.symbol }}</RouterLink>
              <span v-else>{{ p.token.symbol }}</span>
              <span class="ml-1 text-muted">{{ p.token.chain }}</span>
            </td>
            <td class="whitespace-nowrap">
              {{ statusLabel[p.status] }}
              <p v-if="p.closed_at" class="text-muted">{{ dateTime(p.closed_at) }}</p>
            </td>
            <td class="whitespace-nowrap">{{ dateTime(p.opened_at) }}</td>
            <td class="num text-right">
              {{ price(p.entry_price) }}
              <p v-if="p.adds" class="text-muted">rata-rata, {{ p.adds }}× tambah</p>
            </td>
            <td class="num text-right whitespace-nowrap">
              {{ p.stop === null ? '–' : price(p.stop) }} / {{ p.take_profit === null ? '–' : price(p.take_profit) }}
              <p v-if="p.initial_stop !== null && p.stop !== null && p.initial_stop !== p.stop" class="text-muted">stop awal {{ price(p.initial_stop) }}</p>
            </td>
            <td class="num text-right">{{ usd(p.amount_usd) }}</td>
            <td class="num text-right whitespace-nowrap">
              <template v-if="p.status === 'closed'">
                <span :class="changeClass(p.net_pnl)">{{ usd(p.net_pnl) }}</span>
                <p :class="changeClass(p.r)">{{ r(p.r) }}</p>
              </template>
              <template v-else-if="p.status === 'open'">
                <span :class="changeClass(p.unrealized_usd)">{{ usd(p.unrealized_usd) }}</span>
                <p class="text-muted">di {{ price(p.price) }}</p>
              </template>
              <span v-else class="text-muted">–</span>
            </td>
            <td class="max-w-80 text-muted">
              {{ p.entry_reason }}
              <p v-if="p.exit_reason">→ {{ p.exit_reason }}</p>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <p class="flex items-start gap-2 text-xs text-muted">
      <AppIcon name="info" class="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        Akun kertas 10.000 USD per strategi, memakai strategi long FutureSim di candle DEX semua token yang punya candle (likuiditas minimal $50 ribu). Swap DEX
        tidak bisa short: akun tren hanya memegang saat di atas SMA50. Filter BTC dan ETH memakai candle Bybit seperti FutureSim. Tiap swap membayar fee 0,3%,
        price impact dari likuiditas pool, dan gas jaringan. Stop, target, order limit, dan tambahan martingale dicek di candle 15 menit; keputusan entry dan exit
        diambil tiap jam setelah candle token tersimpan. Token di luar Market candle-nya diambil bergiliran, jadi hanya dimasuki bila candle jam itu sudah ada.
        Tidak mengubah trading akun mana pun.
      </span>
    </p>
  </div>
</template>
