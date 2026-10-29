<script setup lang="ts">
import { computed, ref } from 'vue'
import AddTokenDialog from '@/components/AddTokenDialog.vue'
import EmptyState from '@/components/EmptyState.vue'
import PriceFlash from '@/components/PriceFlash.vue'
import RecommendationBadge from '@/components/RecommendationBadge.vue'
import ScoreSparkline from '@/components/ScoreSparkline.vue'
import Skeleton from '@/components/Skeleton.vue'
import TokenAvatar from '@/components/TokenAvatar.vue'
import { usePolling } from '@/composables/usePolling'
import { api, errorMessage } from '@/lib/api'
import { changeClass, pct, price, timeAgo, usd } from '@/lib/format'
import type { Token, WatchlistEvent } from '@/lib/types'
import { useToastStore } from '@/stores/toast'

type Filter = 'all' | 'new' | 'auto' | 'pinned' | 'declining'

const toast = useToastStore()
const tokens = ref<Token[] | null>(null)
const capacity = ref<{ used: number; max: number } | null>(null)
const events = ref<WatchlistEvent[]>([])
const chains = ref<{ id: string; label: string }[]>([])
const showAdd = ref(false)
const search = ref('')
const filter = ref<Filter>('all')
const sortKey = ref<'liquidity_usd' | 'volume_h24' | 'change' | 'score' | 'added'>('score')
const pinning = ref<number | null>(null)

async function load() {
  const { data } = await api.get<{ data: Token[]; capacity: { used: number; max: number } }>('/tokens')
  tokens.value = data.data
  capacity.value = data.capacity
}

async function loadEvents() {
  const { data } = await api.get<{ data: WatchlistEvent[] }>('/watchlist/events')
  events.value = data.data
}

async function openAdd() {
  if (!chains.value.length) {
    const { data } = await api.get<{ chains: { id: string; label: string }[] }>('/market/overview')
    chains.value = data.chains
  }
  showAdd.value = true
}

async function togglePin(token: Token) {
  pinning.value = token.id
  try {
    await api.patch(`/tokens/${token.id}/pin`, { pinned: !token.is_pinned })
    token.is_pinned = !token.is_pinned
    toast.info(
      token.is_pinned ? `${token.symbol} dikunci` : `Kunci ${token.symbol} dilepas`,
      token.is_pinned ? 'Tidak akan dikeluarkan otomatis.' : 'Akan dikeluarkan jika skornya terus turun selama seminggu.',
    )
    loadEvents()
  } catch (error) {
    toast.error('Gagal mengubah kunci', errorMessage(error))
  } finally {
    pinning.value = null
  }
}

usePolling(load, 5000)
usePolling(loadEvents, 60000)

const counts = computed(() => {
  const list = tokens.value ?? []
  return {
    all: list.length,
    new: list.filter((t) => t.is_new).length,
    auto: list.filter((t) => t.source === 'discovery').length,
    pinned: list.filter((t) => t.is_pinned).length,
    declining: list.filter((t) => t.score_trend?.declining).length,
  }
})

const filters: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Semua' },
  { value: 'new', label: 'Baru 24 jam' },
  { value: 'auto', label: 'Otomatis' },
  { value: 'pinned', label: 'Dikunci' },
  { value: 'declining', label: 'Skor menurun' },
]

const rows = computed(() => {
  const q = search.value.toLowerCase()
  const list = (tokens.value ?? []).filter((t) => {
    if (q && !t.symbol.toLowerCase().includes(q) && !t.name.toLowerCase().includes(q)) return false
    return {
      all: true,
      new: t.is_new,
      auto: t.source === 'discovery',
      pinned: t.is_pinned,
      declining: !!t.score_trend?.declining,
    }[filter.value]
  })
  const value = (t: Token): number => {
    switch (sortKey.value) {
      case 'change':
        return t.price_change.h24 ?? 0
      case 'score':
        return t.latest_analysis?.final_score ?? -1
      case 'added':
        return t.added_at ? new Date(t.added_at).getTime() : 0
      default:
        return t[sortKey.value] ?? 0
    }
  }
  return [...list].sort((a, b) => value(b) - value(a))
})

const eventStyle: Record<WatchlistEvent['action'], { icon: string; class: string; label: string }> = {
  added: { icon: '＋', class: 'bg-up/15 text-up', label: 'Masuk' },
  removed: { icon: '－', class: 'bg-down/15 text-down', label: 'Keluar' },
  pinned: { icon: '📌', class: 'bg-brand/15 text-brand', label: 'Dikunci' },
  unpinned: { icon: '○', class: 'bg-panel-2 text-muted', label: 'Kunci dilepas' },
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center gap-3">
      <div class="mr-auto">
        <h1 class="text-xl font-semibold">Market</h1>
        <p class="mt-0.5 text-xs text-muted">
          Daftar dikelola otomatis: token temuan dengan skor tinggi masuk sendiri; token yang tidak dikunci & tidak di portofolio keluar jika skornya menurun seminggu.
        </p>
      </div>
      <div v-if="capacity" class="w-44" :title="`${capacity.used} dari ${capacity.max} slot terpakai (batas rate limit GeckoTerminal)`">
        <div class="mb-1 flex justify-between text-[11px] text-muted"><span>Slot Market</span><span class="num">{{ capacity.used }}/{{ capacity.max }}</span></div>
        <div class="h-1.5 overflow-hidden rounded-full bg-panel-2">
          <div
            class="h-full rounded-full transition-[width] duration-700"
            :class="capacity.used >= capacity.max ? 'bg-warn' : 'bg-brand'"
            :style="{ width: `${(capacity.used / capacity.max) * 100}%` }"
          />
        </div>
      </div>
      <button class="btn-primary" @click="openAdd">+ Tambah token</button>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <div class="flex flex-wrap gap-1 rounded-lg bg-panel p-1">
        <button
          v-for="f in filters"
          :key="f.value"
          class="rounded-md px-3 py-1.5 text-sm transition-colors duration-200"
          :class="filter === f.value ? 'bg-panel-2 text-text' : 'text-muted hover:text-text'"
          @click="filter = f.value"
        >
          {{ f.label }} <span class="num ml-1 text-xs text-muted">{{ counts[f.value] }}</span>
        </button>
      </div>
      <input v-model="search" placeholder="Cari token…" class="w-40" />
      <select v-model="sortKey">
        <option value="score">Urut: skor analisis</option>
        <option value="added">Urut: terbaru masuk</option>
        <option value="liquidity_usd">Urut: likuiditas</option>
        <option value="volume_h24">Urut: volume 24j</option>
        <option value="change">Urut: perubahan 24j</option>
      </select>
    </div>

    <div class="grid gap-4 xl:grid-cols-[1fr_20rem] 3xl:grid-cols-[1fr_24rem]">
      <div class="card animate-fade-up min-w-0 overflow-x-auto">
        <table class="table">
          <thead>
            <tr>
              <th class="w-8" />
              <th>Token</th>
              <th class="text-right!">Harga</th>
              <th class="text-right!">24j</th>
              <th class="text-right!">Likuiditas</th>
              <th class="text-right!">Skor 7 hari</th>
              <th>Rekomendasi</th>
            </tr>
          </thead>
          <TransitionGroup tag="tbody" name="row">
            <tr v-for="t in rows" :key="t.id" class="cursor-pointer transition-colors duration-150 hover:bg-panel-2/50" @click="$router.push(`/tokens/${t.id}`)">
              <td>
                <button
                  class="text-sm transition-all duration-200 hover:scale-125 disabled:opacity-40"
                  :class="t.is_pinned ? 'opacity-100' : 'opacity-25 grayscale hover:opacity-70'"
                  :title="t.is_pinned ? 'Dikunci: tidak dikeluarkan otomatis. Klik untuk melepas.' : 'Dikelola otomatis. Klik untuk mengunci.'"
                  :disabled="pinning === t.id"
                  @click.stop="togglePin(t)"
                >
                  📌
                </button>
              </td>
              <td>
                <div class="flex items-center gap-2.5">
                  <TokenAvatar :src="t.image_url" :symbol="t.symbol" />
                  <div>
                    <div class="flex items-center gap-1.5 font-medium">
                      {{ t.symbol }}<span class="text-muted">/{{ t.quote_symbol }}</span>
                      <span v-if="t.is_new" class="animate-glow rounded bg-up/15 px-1.5 text-[10px] font-semibold text-up" :title="`Masuk ${timeAgo(t.added_at)}`">BARU</span>
                    </div>
                    <div class="flex items-center gap-1.5 text-xs text-muted">
                      {{ t.chain_label }} · {{ t.dex_id }}
                      <span v-if="t.source === 'discovery'" class="rounded bg-violet-500/15 px-1 text-[10px] text-violet-300" title="Ditemukan otomatis oleh discovery">auto</span>
                    </div>
                  </div>
                </div>
              </td>
              <td class="num text-right font-medium"><PriceFlash :value="t.price_usd">{{ price(t.price_usd) }}</PriceFlash></td>
              <td class="num text-right" :class="changeClass(t.price_change.h24)">{{ pct(t.price_change.h24) }}</td>
              <td class="num text-right">{{ usd(t.liquidity_usd, true) }}</td>
              <td>
                <ScoreSparkline :points="t.score_history ?? []" :declining="t.score_trend?.declining" :change="t.score_trend?.change" />
              </td>
              <td>
                <div class="flex items-center gap-2">
                  <RecommendationBadge :value="t.latest_analysis?.recommendation" />
                  <span v-if="t.latest_analysis" class="num text-xs text-muted">{{ t.latest_analysis.final_score }}</span>
                  <span v-if="t.score_trend?.declining" class="text-[10px] text-down" title="Skor menurun di mayoritas hari dalam seminggu">↓ menurun</span>
                </div>
              </td>
            </tr>
          </TransitionGroup>
        </table>
        <Skeleton v-if="tokens === null" class="p-3" :rows="6" />
        <EmptyState v-else-if="!rows.length" title="Tidak ada token pada filter ini">
          <button v-if="filter === 'all'" class="btn-primary" @click="openAdd">+ Tambah token</button>
        </EmptyState>
      </div>

      <aside class="card animate-fade-up h-fit p-4" style="animation-delay: 80ms">
        <div class="flex items-center justify-between">
          <h2 class="card-title">Aktivitas Market</h2>
          <RouterLink to="/discover" class="text-xs text-brand hover:underline">Temukan →</RouterLink>
        </div>
        <p v-if="!events.length" class="mt-3 text-xs text-muted">Belum ada aktivitas. Token yang masuk & keluar otomatis akan dicatat di sini beserta alasannya.</p>
        <TransitionGroup tag="ol" name="row" class="mt-3 space-y-3">
          <li v-for="e in events" :key="e.id" class="flex gap-2.5">
            <span class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold" :class="eventStyle[e.action].class">
              {{ eventStyle[e.action].icon }}
            </span>
            <div class="min-w-0 text-xs">
              <div class="flex items-center gap-1.5">
                <RouterLink v-if="e.token.is_active" :to="`/tokens/${e.token.id}`" class="font-medium text-text hover:text-brand">{{ e.token.symbol }}</RouterLink>
                <span v-else class="font-medium text-muted line-through">{{ e.token.symbol }}</span>
                <span class="text-muted">{{ eventStyle[e.action].label }} · {{ timeAgo(e.created_at) }}</span>
              </div>
              <p class="mt-0.5 leading-relaxed text-muted">{{ e.reason }}</p>
            </div>
          </li>
        </TransitionGroup>
      </aside>
    </div>

    <Transition name="modal">
      <AddTokenDialog v-if="showAdd" :chains="chains" @close="showAdd = false" @added="load(), loadEvents()" />
    </Transition>
  </div>
</template>
