<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import AppSelect from '@/components/AppSelect.vue'
import type { SelectOption } from '@/components/AppSelect.vue'
import AppSwitch from '@/components/AppSwitch.vue'
import EmptyState from '@/components/EmptyState.vue'
import Skeleton from '@/components/Skeleton.vue'
import { usePolling } from '@/composables/usePolling'
import { api } from '@/lib/api'
import { shortAddress, timeAgo, usd } from '@/lib/format'
import { useToastStore } from '@/stores/toast'

interface WalletRow {
  wallet: string
  chain: string
  chain_label: string
  trades: number
  tokens: number
  buys: number
  sells: number
  volume_usd: number
  last_at: string
  likely_bot: boolean
}

type SortKey = 'trades' | 'tokens' | 'buys' | 'sells' | 'volume_usd' | 'last_at'

const toast = useToastStore()
const rows = ref<WalletRow[]>([])
const loaded = ref(false)
const meta = ref({ current_page: 1, last_page: 1, total: 0 })
const summary = ref({ wallets: 0, likely_bots: 0 })
const chains = ref<{ id: string; label: string }[]>([])
const search = ref('')
const chain = ref('')
const hideBots = ref(false)
const sort = ref<SortKey>('last_at')
const direction = ref<'asc' | 'desc'>('desc')
const page = ref(1)

const chainOptions = computed<SelectOption<string>[]>(() => [{ value: '', label: 'Semua chain' }, ...chains.value.map((c) => ({ value: c.id, label: c.label }))])

const columns: { key: SortKey; label: string }[] = [
  { key: 'trades', label: 'Transaksi' },
  { key: 'tokens', label: 'Token' },
  { key: 'buys', label: 'Beli' },
  { key: 'sells', label: 'Jual' },
  { key: 'volume_usd', label: 'Volume' },
  { key: 'last_at', label: 'Terakhir' },
]

async function load() {
  const params: Record<string, unknown> = { sort: sort.value, direction: direction.value, page: page.value }
  if (search.value.trim()) params.search = search.value.trim()
  if (chain.value) params.chain = chain.value
  if (hideBots.value) params.hide_bots = 1
  const { data } = await api.get<{ data: WalletRow[]; meta: typeof meta.value; summary: typeof summary.value; chains: typeof chains.value }>('/wallets', { params })
  rows.value = data.data
  meta.value = data.meta
  summary.value = data.summary
  chains.value = data.chains
  loaded.value = true
}

usePolling(load, 60000)
watch(page, load)

let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(reload, 300)
})
watch([chain, hideBots], reload)

/** A changed filter or sort starts from the first page. */
function reload() {
  if (page.value === 1) load()
  else page.value = 1
}

function sortBy(key: SortKey) {
  if (sort.value === key) direction.value = direction.value === 'desc' ? 'asc' : 'desc'
  else {
    sort.value = key
    direction.value = 'desc'
  }
  reload()
}

function ariaSort(key: SortKey): 'ascending' | 'descending' | 'none' {
  if (sort.value !== key) return 'none'
  return direction.value === 'asc' ? 'ascending' : 'descending'
}

function copy(address: string) {
  navigator.clipboard?.writeText(address).then(() => toast.info('Alamat wallet disalin'))
}
</script>

<template>
  <div class="stack-section">
    <div>
      <h1 class="text-xl font-semibold">Wallet</h1>
      <p class="mt-1 text-sm text-muted">
        Alamat yang tercatat dari transaksi whale pada token yang dipantau, disimpan 60 hari. Ini bukan seluruh aktivitas wallet, jadi tidak menunjukkan untung-rugi atau pemiliknya.
      </p>
    </div>

    <div class="flex flex-wrap items-center gap-3">
      <input v-model="search" class="num w-full sm:w-80" placeholder="Cari alamat wallet…" aria-label="Cari alamat wallet" />
      <AppSelect v-model="chain" aria-label="Chain" :options="chainOptions" />
      <span class="flex items-center gap-2 text-sm">
        <AppSwitch v-model="hideBots" label="Sembunyikan kemungkinan bot" />
        Sembunyikan kemungkinan bot
      </span>
      <span v-if="loaded" class="text-xs text-muted sm:ml-auto">{{ summary.wallets.toLocaleString('id-ID') }} wallet · {{ summary.likely_bots }} kemungkinan bot</span>
    </div>

    <section class="card">
      <Skeleton v-if="!loaded" class="p-3" :rows="8" />
      <template v-else-if="rows.length">
        <div class="overflow-x-auto">
          <table class="table">
            <thead>
              <tr>
                <th>Wallet</th>
                <th>Chain</th>
                <th v-for="c in columns" :key="c.key" class="text-right!" :aria-sort="ariaSort(c.key)">
                  <button type="button" class="inline-flex items-center gap-1 hover:text-text" @click="sortBy(c.key)">
                    {{ c.label }}
                    <span v-if="sort === c.key" aria-hidden="true">{{ direction === 'desc' ? '↓' : '↑' }}</span>
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in rows" :key="`${row.chain}:${row.wallet}`" class="transition-colors hover:bg-panel-2/50">
                <td class="whitespace-nowrap">
                  <span class="flex items-center gap-2">
                    <RouterLink :to="`/wallets/${row.chain}/${row.wallet}`" class="num text-xs text-brand hover:underline" :title="row.wallet">
                      <span class="sm:hidden">{{ shortAddress(row.wallet) }}</span>
                      <span class="hidden sm:inline">{{ row.wallet }}</span>
                    </RouterLink>
                    <button type="button" class="text-muted transition hover:text-text" :aria-label="`Salin alamat ${row.wallet}`" title="Salin alamat" @click="copy(row.wallet)">
                      <AppIcon name="copy" class="h-3.5 w-3.5" />
                    </button>
                    <span v-if="row.likely_bot" class="rounded bg-warn/15 px-1.5 py-0.5 text-[10px] font-medium text-warn" title="Perkiraan dari frekuensi transaksi, bisa keliru">
                      <span class="sm:hidden">Bot?</span>
                      <span class="hidden sm:inline">Kemungkinan bot</span>
                    </span>
                  </span>
                </td>
                <td class="text-xs whitespace-nowrap text-muted">{{ row.chain_label }}</td>
                <td class="num text-right">{{ row.trades.toLocaleString('id-ID') }}</td>
                <td class="num text-right">{{ row.tokens }}</td>
                <td class="num text-right text-up">{{ row.buys.toLocaleString('id-ID') }}</td>
                <td class="num text-right text-down">{{ row.sells.toLocaleString('id-ID') }}</td>
                <td class="num text-right">{{ usd(row.volume_usd, true) }}</td>
                <td class="text-right text-xs whitespace-nowrap text-muted">{{ timeAgo(row.last_at) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="meta.last_page > 1" class="flex items-center justify-between gap-2 border-t border-line p-3 text-xs text-muted">
          <span>Halaman {{ meta.current_page }} dari {{ meta.last_page }} · {{ meta.total.toLocaleString('id-ID') }} wallet</span>
          <div class="flex gap-2">
            <button type="button" class="btn-ghost py-1 text-xs" :disabled="page <= 1" @click="page--">← Sebelumnya</button>
            <button type="button" class="btn-ghost py-1 text-xs" :disabled="page >= meta.last_page" @click="page++">Berikutnya →</button>
          </div>
        </div>
      </template>
      <EmptyState v-else title="Tidak ada wallet pada filter ini" description="Coba ubah pencarian atau filter chain." />
    </section>
  </div>
</template>
