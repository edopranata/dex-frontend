<script setup lang="ts">
import { ref } from 'vue'
import { api, errorMessage } from '@/lib/api'
import { useToastStore } from '@/stores/toast'
import { price, usd } from '@/lib/format'
import TokenAvatar from './TokenAvatar.vue'
import AppSelect from '@/components/AppSelect.vue'

interface SearchResult {
  chain_id: string
  pair_address: string
  dex_id: string | null
  symbol: string
  name: string
  quote_symbol: string | null
  price_usd: number | null
  liquidity_usd: number | null
  volume_h24: number | null
  image_url: string | null
  tracked: boolean
}

defineProps<{ chains: { id: string; label: string }[] }>()
const emit = defineEmits<{ close: []; added: [] }>()
const toast = useToastStore()

const query = ref('')
const results = ref<SearchResult[]>([])
const searching = ref(false)
const adding = ref<string | null>(null)
const error = ref<string | null>(null)
const manualChain = ref('solana')
const manualAddress = ref('')

async function search() {
  if (query.value.trim().length < 2) return
  searching.value = true
  error.value = null
  try {
    const { data } = await api.get<{ data: SearchResult[] }>('/tokens/search', { params: { q: query.value.trim() } })
    results.value = data.data
    if (!data.data.length) error.value = 'Tidak ada pair dengan likuiditas cukup di jaringan yang didukung.'
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    searching.value = false
  }
}

async function add(chainId: string, address: string) {
  adding.value = address
  error.value = null
  try {
    const { data } = await api.post<{ data: { symbol: string } }>('/tokens', { chain_id: chainId, address })
    toast.success(`${data.data.symbol} ditambahkan`, 'Data keamanan, candle, dan whale sedang diambil, lalu dianalisis.')
    emit('added')
    emit('close')
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    adding.value = null
  }
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-[10vh]" @click.self="emit('close')">
    <div class="modal-panel card w-full max-w-2xl p-5 shadow-2xl shadow-black/50">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-semibold">Tambah token ke pantauan</h2>
        <button class="text-muted hover:text-text" aria-label="Tutup" @click="emit('close')">✕</button>
      </div>

      <form class="mt-4 flex gap-2" @submit.prevent="search">
        <input v-model="query" class="w-full" placeholder="Cari simbol atau nama, mis. BONK, PEPE, AERO" autofocus />
        <button class="btn-primary shrink-0" :disabled="searching">{{ searching ? 'Mencari…' : 'Cari' }}</button>
      </form>

      <ul v-if="results.length" class="mt-3 max-h-80 divide-y divide-line overflow-y-auto rounded-lg border border-line">
        <li v-for="(r, i) in results" :key="r.chain_id + r.pair_address" class="animate-fade-up flex items-center gap-3 px-3 py-2 transition-colors hover:bg-panel-2/50" :style="{ animationDelay: `${i * 30}ms` }">
          <TokenAvatar :src="r.image_url" :symbol="r.symbol" />
          <div class="min-w-0 flex-1">
            <div class="truncate text-sm font-medium">
              {{ r.symbol }}<span class="text-muted">/{{ r.quote_symbol }}</span>
              <span class="ml-1 text-xs text-muted">{{ r.chain_id }} · {{ r.dex_id }}</span>
            </div>
            <div class="truncate text-xs text-muted">{{ r.name }}</div>
          </div>
          <div class="num text-right text-xs">
            <div>{{ price(r.price_usd) }}</div>
            <div class="text-muted">Liq {{ usd(r.liquidity_usd, true) }}</div>
          </div>
          <button class="btn-ghost shrink-0 py-1 text-xs" :disabled="r.tracked || adding !== null" @click="add(r.chain_id, r.pair_address)">
            {{ r.tracked ? 'Dipantau' : adding === r.pair_address ? '…' : 'Tambah' }}
          </button>
        </li>
      </ul>

      <div class="mt-5 border-t border-line pt-4">
        <div class="card-title mb-2">Atau tempel alamat token / pair</div>
        <form class="flex flex-col gap-2 sm:flex-row" @submit.prevent="add(manualChain, manualAddress.trim())">
          <AppSelect v-model="manualChain" class="sm:w-40" aria-label="Jaringan" :options="chains.map((c) => ({ value: c.id, label: c.label }))" />
          <input v-model="manualAddress" class="num w-full" placeholder="0x… atau alamat Solana" />
          <button class="btn-primary shrink-0" :disabled="!manualAddress || adding !== null">Tambah</button>
        </form>
      </div>

      <p v-if="error" class="mt-3 text-sm text-down">{{ error }}</p>
      <p class="mt-3 text-xs text-muted">Token baru langsung diambil datanya (keamanan, candle, whale) lalu dianalisis lewat queue, sekitar 1–3 menit.</p>
    </div>
  </div>
</template>
