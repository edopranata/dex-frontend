<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import EmptyState from '@/components/EmptyState.vue'
import Skeleton from '@/components/Skeleton.vue'
import StatCard from '@/components/StatCard.vue'
import TokenAvatar from '@/components/TokenAvatar.vue'
import WhaleTable from '@/components/WhaleTable.vue'
import { usePolling } from '@/composables/usePolling'
import { api } from '@/lib/api'
import { dateTime, explorerUrl, timeAgo, usd } from '@/lib/format'
import { tokenPath } from '@/lib/links'
import type { WhaleTrade } from '@/lib/types'
import { useToastStore } from '@/stores/toast'

const props = defineProps<{ chain: string; address: string }>()

interface Detail {
  wallet: {
    wallet: string
    chain_label: string
    trades: number
    tokens: number
    buys: number
    sells: number
    buy_usd: number
    sell_usd: number
    volume_usd: number
    first_at: string
    last_at: string
    likely_bot: boolean
  }
  tokens: { id: number; slug: string; symbol: string; image_url: string | null; trades: number; buys: number; sells: number; buy_usd: number; sell_usd: number; last_at: string }[]
  trades: { data: WhaleTrade[]; meta: { current_page: number; last_page: number; total: number } }
}

const toast = useToastStore()
const detail = ref<Detail | null>(null)
const notFound = ref(false)
const page = ref(1)

const explorer = computed(() => explorerUrl(props.chain, 'address', props.address))

async function load() {
  try {
    const { data } = await api.get<Detail>(`/wallets/${props.chain}/${props.address}`, { params: { page: page.value } })
    detail.value = data
  } catch {
    notFound.value = detail.value === null
  }
}

usePolling(load, 60000)
watch(page, load)
watch(
  () => [props.chain, props.address],
  () => {
    detail.value = null
    notFound.value = false
    if (page.value === 1) load()
    else page.value = 1
  },
)

function copy() {
  navigator.clipboard?.writeText(props.address).then(() => toast.info('Alamat wallet disalin'))
}
</script>

<template>
  <div class="stack-section">
    <div>
      <RouterLink to="/wallets" class="text-xs text-muted hover:text-text">← Semua wallet</RouterLink>
      <h1 class="num mt-1 text-sm font-semibold break-all sm:text-lg">{{ address }}</h1>
      <div class="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <span v-if="detail" class="rounded bg-panel-2 px-1.5 py-0.5 text-muted">{{ detail.wallet.chain_label }}</span>
        <span v-if="detail?.wallet.likely_bot" class="rounded bg-warn/15 px-1.5 py-0.5 font-medium text-warn" title="Perkiraan dari frekuensi transaksi, bisa keliru">Kemungkinan bot</span>
        <button type="button" class="btn-ghost inline-flex items-center gap-1 px-2 py-1 text-xs" @click="copy">
          <AppIcon name="copy" class="h-3.5 w-3.5" />
          Salin alamat
        </button>
        <a v-if="explorer" :href="explorer" target="_blank" rel="noopener noreferrer" class="btn-ghost px-2 py-1 text-xs">Buka di explorer ↗</a>
      </div>
    </div>

    <EmptyState v-if="notFound" title="Wallet tidak ditemukan" description="Riwayat disimpan 60 hari, jadi alamat ini mungkin sudah terhapus." />
    <Skeleton v-else-if="!detail" :rows="4" height="h-24" />

    <template v-else>
      <div class="grid grid-cols-2 gap-section lg:grid-cols-4">
        <StatCard label="Transaksi tercatat" :value="detail.wallet.trades.toLocaleString('id-ID')" :hint="`${detail.wallet.buys} beli · ${detail.wallet.sells} jual`" />
        <StatCard label="Total beli" :value="usd(detail.wallet.buy_usd, true)" />
        <StatCard label="Total jual" :value="usd(detail.wallet.sell_usd, true)" />
        <StatCard label="Terakhir terlihat" :value="timeAgo(detail.wallet.last_at)" :hint="`Pertama ${dateTime(detail.wallet.first_at)}`" />
      </div>

      <p class="text-xs text-muted">Hanya transaksi besar pada token yang dipantau. Selisih beli dan jual di sini bukan untung-rugi wallet ini.</p>

      <section class="card overflow-x-auto">
        <h2 class="card-title p-4 pb-2">Token yang ditransaksikan</h2>
        <table class="table">
          <thead>
            <tr>
              <th>Token</th>
              <th class="text-right!">Transaksi</th>
              <th class="text-right!">Beli</th>
              <th class="text-right!">Jual</th>
              <th class="text-right!">Terakhir</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="token in detail.tokens" :key="token.id">
              <td>
                <RouterLink :to="tokenPath(token)" class="flex items-center gap-2 font-medium hover:text-brand">
                  <TokenAvatar :src="token.image_url" :symbol="token.symbol" :size="20" />
                  {{ token.symbol }}
                </RouterLink>
              </td>
              <td class="num text-right">{{ token.trades }}</td>
              <td class="num text-right text-up">{{ usd(token.buy_usd, true) }}</td>
              <td class="num text-right text-down">{{ usd(token.sell_usd, true) }}</td>
              <td class="text-right text-xs whitespace-nowrap text-muted">{{ timeAgo(token.last_at) }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="card">
        <h2 class="card-title p-4 pb-2">Riwayat transaksi</h2>
        <WhaleTable :trades="detail.trades.data" :chain="chain" show-token />
        <div v-if="detail.trades.meta.last_page > 1" class="flex items-center justify-between gap-2 border-t border-line p-3 text-xs text-muted">
          <span>Halaman {{ detail.trades.meta.current_page }} dari {{ detail.trades.meta.last_page }} · {{ detail.trades.meta.total }} transaksi</span>
          <div class="flex gap-2">
            <button type="button" class="btn-ghost py-1 text-xs" :disabled="page <= 1" @click="page--">← Sebelumnya</button>
            <button type="button" class="btn-ghost py-1 text-xs" :disabled="page >= detail.trades.meta.last_page" @click="page++">Berikutnya →</button>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>
