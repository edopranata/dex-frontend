<script setup lang="ts">
import { ref } from 'vue'
import EmptyState from '@/components/EmptyState.vue'
import StatCard from '@/components/StatCard.vue'
import TokenAvatar from '@/components/TokenAvatar.vue'
import { usePolling } from '@/composables/usePolling'
import { api } from '@/lib/api'
import { changeClass, dateTime, pct, price, qty, usd } from '@/lib/format'
import type { Order, Paginated, Portfolio } from '@/lib/types'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const portfolio = ref<Portfolio | null>(null)
const orders = ref<Order[]>([])

async function load() {
  const [p, o] = await Promise.all([api.get<Portfolio>('/portfolio'), api.get<Paginated<Order>>('/orders')])
  portfolio.value = p.data
  orders.value = o.data.data
}

usePolling(load, 10000)

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
          <tr v-for="p in portfolio.positions" :key="p.id" class="cursor-pointer hover:bg-panel-2/50" @click="$router.push(`/tokens/${p.token_id}`)">
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

    <section class="card overflow-x-auto">
      <h2 class="card-title p-4 pb-2">Riwayat order</h2>
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
            <td>{{ o.token?.symbol }}</td>
            <td class="whitespace-nowrap">
              <span :class="o.side === 'buy' ? 'text-up' : 'text-down'">{{ o.side === 'buy' ? 'Beli' : 'Jual' }}</span> {{ typeLabel[o.type] }}
            </td>
            <td class="num text-right">{{ price(o.trigger_price) }}</td>
            <td class="num text-right">{{ price(o.filled_price) }}</td>
            <td class="num text-right">{{ usd(o.total_usd ?? o.amount_usd) }}</td>
            <td class="num text-right text-muted">{{ usd(o.fee_usd) }}</td>
            <td class="num text-right text-muted">{{ o.slippage_pct !== null ? pct(o.slippage_pct, 3) : '–' }}</td>
            <td class="num text-right" :class="changeClass(o.realized_pnl)">{{ o.realized_pnl !== null ? usd(o.realized_pnl) : '' }}</td>
            <td class="text-xs" :class="statusClass[o.status]" :title="o.note ?? ''">{{ o.status }}</td>
            <td><button v-if="o.status === 'pending'" class="text-xs text-down hover:underline" @click="cancel(o)">Batal</button></td>
          </tr>
        </TransitionGroup>
      </table>
      <EmptyState v-else title="Belum ada order" />
    </section>
  </div>
</template>
