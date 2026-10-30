<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AnalysisCard from '@/components/AnalysisCard.vue'
import CandleChart from '@/components/CandleChart.vue'
import EmptyState from '@/components/EmptyState.vue'
import LiveDot from '@/components/LiveDot.vue'
import PriceFlash from '@/components/PriceFlash.vue'
import Skeleton from '@/components/Skeleton.vue'
import NewsList from '@/components/NewsList.vue'
import OrderPanel from '@/components/OrderPanel.vue'
import SecurityCard from '@/components/SecurityCard.vue'
import TokenAvatar from '@/components/TokenAvatar.vue'
import WhaleTable from '@/components/WhaleTable.vue'
import { usePolling } from '@/composables/usePolling'
import { api } from '@/lib/api'
import { changeClass, compact, pct, price, qty, timeAgo, usd } from '@/lib/format'
import type { Analysis, Candle, NewsItem, Order, Portfolio, Signal, Token, WhaleTrade } from '@/lib/types'
import { useAuthStore } from '@/stores/auth'
import { usePortfolioStore } from '@/stores/portfolio'

/** Slug such as "JOB-SOL", or an old numeric id that is swapped for the slug once the token loads. */
const props = defineProps<{ id: string }>()
const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const token = ref<Token | null>(null)
const analysis = ref<Analysis | null>(null)
const signal = ref<Signal | null>(null)
const whaleThreshold = ref<number>(0)
const candles = ref<Candle[]>([])
const timeframe = ref<'15m' | '1h' | '4h' | '1d'>('1h')
const whales = ref<WhaleTrade[]>([])
const news = ref<NewsItem[]>([])
const orders = ref<Order[]>([])
const portfolio = ref<Portfolio | null>(null)
const tab = ref<'whales' | 'news' | 'orders'>('whales')

const position = computed(() => portfolio.value?.positions.find((p) => p.token_id === token.value?.id) ?? null)

let tokenLoading: Promise<void> = Promise.resolve()

/** Whether the loaded token is the one in the URL (by slug, or by the id of an old link). */
function isCurrent(t: Token | null): t is Token {
  return !!t && (t.slug === props.id.toUpperCase() || String(t.id) === props.id)
}

function loadToken() {
  tokenLoading = fetchToken()
  return tokenLoading
}

async function fetchToken() {
  const { data } = await api.get<{ data: Token; analysis: Analysis | null; signal: Signal | null; whale_threshold_usd: number }>(`/tokens/${props.id}`)
  token.value = data.data
  analysis.value = data.analysis
  signal.value = data.signal
  whaleThreshold.value = data.whale_threshold_usd

  if (props.id !== data.data.slug) {
    router.replace({ params: { id: data.data.slug }, query: route.query, hash: route.hash })
  }
}

async function loadCandles() {
  const { data } = await api.get<{ data: Candle[] }>(`/tokens/${props.id}/candles`, { params: { timeframe: timeframe.value } })
  candles.value = data.data
}

async function loadActivity() {
  if (!isCurrent(token.value)) await tokenLoading
  const tokenId = token.value?.id
  if (!tokenId) return

  const [w, n, o, p] = await Promise.all([
    api.get<{ data: WhaleTrade[] }>(`/tokens/${props.id}/whales`),
    api.get<{ data: NewsItem[] }>(`/tokens/${props.id}/news`),
    api.get<{ data: Order[] }>('/orders', { params: { token_id: tokenId } }),
    api.get<Portfolio>('/portfolio'),
  ])
  whales.value = w.data.data
  news.value = n.data.data
  orders.value = o.data.data
  portfolio.value = p.data
}

async function afterTrade() {
  usePortfolioStore().refresh()
  await Promise.all([loadActivity(), auth.fetchUser(), loadToken()])
}

async function cancel(order: Order) {
  await api.delete(`/orders/${order.id}`)
  await loadActivity()
}

usePolling(loadToken, 5000)
usePolling(loadCandles, 60000)
usePolling(loadActivity, 30000)

watch(timeframe, loadCandles)
watch(
  () => props.id,
  () => {
    // Swapping an old id link for the slug is the same token: nothing to reload.
    if (isCurrent(token.value)) return
    loadToken()
    loadCandles()
    loadActivity()
  },
)

const orderTypeLabel: Record<string, string> = { market: 'Market', limit: 'Limit', stop_loss: 'Stop Loss', take_profit: 'Take Profit' }
const statusClass: Record<string, string> = { filled: 'text-up', pending: 'text-warn', cancelled: 'text-muted', rejected: 'text-down' }
</script>

<template>
  <div v-if="token" class="space-y-6">
    <div class="flex flex-wrap items-center gap-4">
      <TokenAvatar :src="token.image_url" :symbol="token.symbol" :size="44" />
      <div>
        <h1 class="text-xl font-semibold">
          {{ token.symbol }}<span class="text-muted">/{{ token.quote_symbol }}</span>
        </h1>
        <div class="text-xs text-muted">
          {{ token.name }} · {{ token.chain_label }} · {{ token.dex_id }} ·
          <a v-if="token.url" :href="token.url" target="_blank" rel="noopener" class="text-brand hover:underline">DEX Screener ↗</a>
        </div>
      </div>
      <div class="ml-auto text-right">
        <div class="num text-2xl font-bold"><PriceFlash :value="token.price_usd">{{ price(token.price_usd) }}</PriceFlash></div>
        <div class="flex items-center justify-end gap-1.5 text-xs text-muted"><LiveDot /> diperbarui {{ timeAgo(token.price_updated_at) }}</div>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <div v-for="(label, key, i) in { m5: '5m', h1: '1j', h6: '6j', h24: '24j' }" :key="key" class="card card-hover animate-fade-up px-3 py-2" :style="{ animationDelay: `${i * 40}ms` }">
        <div class="text-[11px] text-muted">Perubahan {{ label }}</div>
        <div class="num font-semibold" :class="changeClass(token.price_change[key])">{{ pct(token.price_change[key]) }}</div>
      </div>
      <div class="card px-3 py-2">
        <div class="text-[11px] text-muted">Likuiditas</div>
        <div class="num font-semibold">{{ usd(token.liquidity_usd, true) }}</div>
      </div>
      <div class="card px-3 py-2">
        <div class="text-[11px] text-muted">Volume 24j · FDV</div>
        <div class="num font-semibold">{{ usd(token.volume_h24, true) }} · {{ compact(token.fdv) }}</div>
      </div>
    </div>

    <div class="grid gap-6 lg:grid-cols-3 3xl:grid-cols-4">
      <div class="min-w-0 space-y-6 lg:col-span-2 3xl:col-span-3">
        <section class="card animate-fade-up p-3">
          <div class="mb-2 flex items-center gap-1">
            <button
              v-for="tf in ['15m', '1h', '4h', '1d'] as const"
              :key="tf"
              class="rounded px-2 py-1 text-xs transition-colors duration-200"
              :class="timeframe === tf ? 'bg-panel-2 text-text' : 'text-muted hover:text-text'"
              @click="timeframe = tf"
            >
              {{ tf }}
            </button>
            <span class="ml-auto hidden text-[11px] text-muted sm:inline">Candle: GeckoTerminal · Garis: level sinyal</span>
          </div>
          <div class="h-[320px] sm:h-[420px]">
            <CandleChart v-if="candles.length" :candles="candles" :levels="signal ?? analysis?.levels" :live-price="token.price_usd" />
            <EmptyState v-else title="Data candle belum tersedia" description="Candle diambil dari GeckoTerminal setiap 10 menit. Token baru butuh 1–3 menit." />
          </div>
        </section>

        <section class="card">
          <div class="flex gap-1 border-b border-line px-3 pt-3">
            <button
              v-for="(label, key) in { whales: 'Transaksi whale', news: 'Berita', orders: 'Order saya' }"
              :key="key"
              class="-mb-px border-b-2 px-3 py-2 text-sm transition-colors duration-200"
              :class="tab === key ? 'border-brand text-text' : 'border-transparent text-muted hover:text-text'"
              @click="tab = key"
            >
              {{ label }}
            </button>
          </div>

          <template v-if="tab === 'whales'">
            <p class="px-4 pt-3 text-xs text-muted">Transaksi ≥ {{ usd(whaleThreshold) }} dalam 24 jam terakhir (ambang menyesuaikan likuiditas pool).</p>
            <WhaleTable v-if="whales.length" :trades="whales" :chain="token.chain_id" />
            <EmptyState v-else title="Belum ada transaksi whale" />
          </template>

          <div v-else-if="tab === 'news'" class="px-4">
            <NewsList v-if="news.length" :items="news" />
            <EmptyState v-else :title="`Belum ada berita yang menyebut ${token.symbol}`" description="Berita diambil tiap jam dari CoinDesk, Cointelegraph, Decrypt, dan The Block." />
          </div>

          <div v-else class="overflow-x-auto">
            <table v-if="orders.length" class="table">
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Jenis</th>
                  <th class="text-right!">Pemicu</th>
                  <th class="text-right!">Harga isi</th>
                  <th class="text-right!">Jumlah</th>
                  <th class="text-right!">P&L</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                <tr v-for="o in orders" :key="o.id">
                  <td class="text-xs whitespace-nowrap text-muted">{{ timeAgo(o.created_at) }}</td>
                  <td class="whitespace-nowrap">
                    <span :class="o.side === 'buy' ? 'text-up' : 'text-down'">{{ o.side === 'buy' ? 'Beli' : 'Jual' }}</span>
                    {{ orderTypeLabel[o.type] }}
                  </td>
                  <td class="num text-right">{{ price(o.trigger_price) }}</td>
                  <td class="num text-right">{{ price(o.filled_price) }}</td>
                  <td class="num text-right">{{ o.side === 'buy' ? usd(o.amount_usd) : qty(o.filled_quantity ?? o.quantity) }}</td>
                  <td class="num text-right" :class="changeClass(o.realized_pnl)">{{ o.realized_pnl !== null ? usd(o.realized_pnl) : '' }}</td>
                  <td class="text-xs" :class="statusClass[o.status]" :title="o.note ?? ''">{{ o.status }}</td>
                  <td><button v-if="o.status === 'pending'" class="text-xs text-down hover:underline" @click="cancel(o)">Batal</button></td>
                </tr>
              </tbody>
            </table>
            <EmptyState v-else title="Belum ada order untuk token ini" />
          </div>
        </section>
      </div>

      <div class="min-w-0 space-y-6">
        <OrderPanel :token="token" :balance="auth.user?.balance_usd ?? 0" :position-quantity="position?.quantity ?? 0" :levels="signal ?? analysis?.levels" @placed="afterTrade" />

        <div v-if="position" class="card p-4 text-sm">
          <div class="card-title">Posisi Anda</div>
          <dl class="mt-2 space-y-1">
            <div class="flex justify-between"><dt class="text-muted">Jumlah</dt><dd class="num">{{ qty(position.quantity) }} {{ token.symbol }}</dd></div>
            <div class="flex justify-between"><dt class="text-muted">Harga rata-rata</dt><dd class="num">{{ price(position.avg_price) }}</dd></div>
            <div class="flex justify-between"><dt class="text-muted">Nilai</dt><dd class="num">{{ usd(position.value_usd) }}</dd></div>
            <div class="flex justify-between">
              <dt class="text-muted">P&L belum terealisasi</dt>
              <dd class="num" :class="changeClass(position.unrealized_pnl)">{{ usd(position.unrealized_pnl) }} ({{ pct(position.unrealized_pnl_pct) }})</dd>
            </div>
          </dl>
        </div>

        <AnalysisCard :analysis="analysis" :signal="signal" :current-price="token.price_usd" :symbol="token.symbol" @followed="afterTrade" />
        <SecurityCard :security="token.latest_security" />
      </div>
    </div>
  </div>
  <div v-else class="space-y-6">
    <div class="flex items-center gap-4"><div class="skeleton h-11 w-11 rounded-full" /><Skeleton class="w-64" :rows="2" height="h-4" /></div>
    <div class="grid gap-6 lg:grid-cols-3 3xl:grid-cols-4"><div class="skeleton h-[420px] lg:col-span-2 3xl:col-span-3" /><Skeleton :rows="5" height="h-20" /></div>
  </div>
</template>
