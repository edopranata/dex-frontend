<script setup lang="ts">
import { ref, watch } from 'vue'
import EmptyState from '@/components/EmptyState.vue'
import OrderKind from '@/components/OrderKind.vue'
import PositionCard from '@/components/PositionCard.vue'
import Skeleton from '@/components/Skeleton.vue'
import { usePolling } from '@/composables/usePolling'
import { api } from '@/lib/api'
import { changeClass, dateTime, price, usd } from '@/lib/format'
import { tokenPath } from '@/lib/links'
import { orderStatusClass, orderStatusLabel, targetLabel } from '@/lib/orders'
import type { Order, Paginated, PositionCardData } from '@/lib/types'

interface AccountPortfolio {
  positions: PositionCardData[]
  pending: Order[]
  orders: Paginated<Order>
}

const props = defineProps<{ accountKey: string }>()

const portfolio = ref<AccountPortfolio | null>(null)
const failed = ref(false)
const page = ref(1)
let latestRequest = 0

async function load() {
  // Switching accounts quickly must not let a slower, older answer replace the newer one.
  const request = ++latestRequest
  try {
    const { data } = await api.get<AccountPortfolio>(`/reports/accounts/${props.accountKey}/portfolio`, { params: { page: page.value } })
    if (request !== latestRequest) return
    portfolio.value = data
    failed.value = false
  } catch {
    if (request === latestRequest) failed.value = true
  }
}

// Each card shows where the price sits now; prices refresh every 15 seconds.
usePolling(load, 15000)
watch(page, load)
watch(
  () => props.accountKey,
  () => {
    portfolio.value = null
    failed.value = false
    if (page.value === 1) load()
    else page.value = 1
  },
)
</script>

<template>
  <div class="space-y-5">
    <p v-if="failed && !portfolio" class="rounded-lg border border-dashed border-line p-6 text-center text-sm text-muted">Portofolio akun gagal dimuat. Dicoba lagi otomatis.</p>
    <Skeleton v-else-if="!portfolio" class="p-3" :rows="5" />

    <template v-else>
      <div>
        <h3 class="mb-1 text-sm font-medium">Posisi terbuka ({{ portfolio.positions.length }})</h3>
        <div v-if="portfolio.positions.length" class="grid gap-section md:grid-cols-2 2xl:grid-cols-3">
          <PositionCard v-for="p in portfolio.positions" :key="p.id" :card="p" link-lots />
        </div>
        <EmptyState v-else title="Belum ada posisi" description="Akun ini sedang tidak memegang token." />
      </div>

      <div v-if="portfolio.pending.length">
        <h3 class="mb-1 text-sm font-medium">Order menunggu ({{ portfolio.pending.length }})</h3>
        <div class="overflow-x-auto">
          <table class="table">
            <thead>
              <tr>
                <th>Dibuat</th>
                <th>Token</th>
                <th>Jenis</th>
                <th class="text-right!">Pemicu</th>
                <th class="text-right!">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="o in portfolio.pending" :key="o.id">
                <td class="text-xs whitespace-nowrap text-muted">{{ dateTime(o.created_at) }}</td>
                <td>
                  <RouterLink v-if="o.token" :to="tokenPath(o.token)" class="hover:text-brand">{{ o.token.symbol }}</RouterLink>
                </td>
                <td class="whitespace-nowrap">
                  <OrderKind :side="o.side" :type="o.type" />
                  <span v-if="targetLabel(o.note)" class="badge-mini ml-1 bg-brand/15 text-brand">{{ targetLabel(o.note) }}</span>
                </td>
                <td class="num text-right">{{ price(o.trigger_price) }}</td>
                <td class="num text-right">{{ usd(o.total_usd ?? o.amount_usd) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h3 class="mb-1 text-sm font-medium">Riwayat order ({{ portfolio.orders.meta.total }})</h3>
        <div v-if="portfolio.orders.data.length" class="overflow-x-auto">
          <table class="table">
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Token</th>
                <th>Jenis</th>
                <th class="text-right!">Pemicu</th>
                <th class="text-right!">Harga isi</th>
                <th class="text-right!">Total</th>
                <th class="text-right!">Fee</th>
                <th class="text-right!">P&amp;L</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="o in portfolio.orders.data" :key="o.id">
                <td class="text-xs whitespace-nowrap text-muted">{{ dateTime(o.filled_at ?? o.created_at) }}</td>
                <td>
                  <RouterLink v-if="o.token" :to="tokenPath(o.token)" class="hover:text-brand">{{ o.token.symbol }}</RouterLink>
                </td>
                <td class="whitespace-nowrap">
                  <OrderKind :side="o.side" :type="o.type" />
                  <span v-if="targetLabel(o.note)" class="badge-mini ml-1 bg-brand/15 text-brand">{{ targetLabel(o.note) }}</span>
                </td>
                <td class="num text-right">{{ price(o.trigger_price) }}</td>
                <td class="num text-right">{{ price(o.filled_price) }}</td>
                <td class="num text-right">{{ usd(o.total_usd ?? o.amount_usd) }}</td>
                <td class="num text-right text-muted">{{ usd(o.fee_usd) }}</td>
                <td class="num text-right" :class="changeClass(o.realized_pnl)">{{ o.realized_pnl !== null ? usd(o.realized_pnl) : '' }}</td>
                <td class="text-xs" :class="orderStatusClass[o.status]" :title="o.note ?? ''">{{ orderStatusLabel[o.status] ?? o.status }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <EmptyState v-else title="Belum ada riwayat order" />

        <div v-if="portfolio.orders.meta.last_page > 1" class="mt-3 flex items-center justify-between gap-2 text-xs text-muted">
          <span>Halaman {{ portfolio.orders.meta.current_page }} dari {{ portfolio.orders.meta.last_page }}</span>
          <div class="flex gap-2">
            <button type="button" class="btn-ghost py-1 text-xs" :disabled="page <= 1" @click="page--">← Sebelumnya</button>
            <button type="button" class="btn-ghost py-1 text-xs" :disabled="page >= portfolio.orders.meta.last_page" @click="page++">Berikutnya →</button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
