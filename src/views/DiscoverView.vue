<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import EmptyState from '@/components/EmptyState.vue'
import PriceFlash from '@/components/PriceFlash.vue'
import RecommendationBadge from '@/components/RecommendationBadge.vue'
import ScoreBar from '@/components/ScoreBar.vue'
import Skeleton from '@/components/Skeleton.vue'
import TokenAvatar from '@/components/TokenAvatar.vue'
import { usePolling } from '@/composables/usePolling'
import { api, errorMessage } from '@/lib/api'
import { changeClass, pct, price, timeAgo, usd } from '@/lib/format'
import type { Candidate, CandidateSource } from '@/lib/types'
import { useToastStore } from '@/stores/toast'

const toast = useToastStore()
const candidates = ref<Candidate[] | null>(null)
const counts = ref<Record<string, number>>({})
const lastRunAt = ref<string | null>(null)
const status = ref<'' | 'tracked' | 'rejected'>('')
const chain = ref('')
const tracking = ref<number | null>(null)
const expanded = ref<Set<number>>(new Set())

async function load() {
  const params: Record<string, string> = {}
  if (status.value) params.status = status.value
  if (chain.value) params.chain_id = chain.value
  const { data } = await api.get<{ data: Candidate[]; counts: Record<string, number>; last_run_at: string | null }>('/discovery', { params })
  candidates.value = data.data
  counts.value = data.counts
  lastRunAt.value = data.last_run_at
}

usePolling(load, 60000)
watch([status, chain], () => {
  candidates.value = null
  load()
})

async function track(candidate: Candidate) {
  tracking.value = candidate.id
  try {
    await api.post(`/discovery/${candidate.id}/track`)
    toast.success(`${candidate.symbol} masuk Market`, 'Analisis lengkap (entry, SL, TP) siap dalam 1–3 menit.')
    await load()
  } catch (error) {
    toast.error('Gagal memantau token', errorMessage(error))
  } finally {
    tracking.value = null
  }
}

function toggle(id: number) {
  const next = new Set(expanded.value)
  next.has(id) ? next.delete(id) : next.add(id)
  expanded.value = next
}

const sourceMeta: Record<CandidateSource, { label: string; class: string; title: string }> = {
  geckoterminal_trending: { label: 'Trending DEX', class: 'bg-brand/15 text-brand', title: 'Masuk trending pools GeckoTerminal' },
  coingecko_trending: { label: 'Trending pencarian', class: 'bg-violet-500/15 text-violet-300', title: 'Paling banyak dicari di CoinGecko (24 jam)' },
  dexscreener_boost: { label: 'Boost (iklan)', class: 'bg-warn/15 text-warn', title: 'Promosi berbayar di DEX Screener, bukan permintaan organik' },
}

const tabs = computed(() => [
  { value: '' as const, label: 'Kandidat', count: (counts.value.candidate ?? 0) + (counts.value.tracked ?? 0) },
  { value: 'tracked' as const, label: 'Di Market', count: counts.value.tracked ?? 0 },
  { value: 'rejected' as const, label: 'Ditolak', count: counts.value.rejected ?? 0 },
])

function whaleWidth(c: Candidate, side: 'buy' | 'sell') {
  if (!c.whale) return '0%'
  const max = Math.max(c.whale.buy_usd, c.whale.sell_usd, 1)
  return `${((side === 'buy' ? c.whale.buy_usd : c.whale.sell_usd) / max) * 100}%`
}

function buyerShare(c: Candidate) {
  const { buyers, sellers } = c.txns_h24
  if (!buyers || !sellers) return null
  return (buyers / (buyers + sellers)) * 100
}

function scoreRing(score: number | null) {
  if (score === null) return 'ring-line text-muted'
  if (score >= 65) return 'ring-up/60 text-up'
  if (score >= 50) return 'ring-warn/60 text-warn'
  return 'ring-down/60 text-down'
}

function ageDays(iso: string | null) {
  if (!iso) return null
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-end gap-3">
      <div class="mr-auto">
        <h1 class="text-xl font-semibold">Temukan token</h1>
        <p class="mt-1 max-w-3xl text-sm text-muted">
          Token ditemukan otomatis dari trending DEX (GeckoTerminal), trending pencarian (CoinGecko), dan berita. Kandidat difilter likuiditas & umur pair,
          lalu dicek keamanan kontrak (GoPlus) dan arus dana whale. Yang terbaik <strong class="text-text">otomatis masuk Market</strong> (maks 3 per putaran; saat penuh menggantikan token terlemah yang tidak dikunci) dan mendapat analisis entry/SL/TP.
        </p>
      </div>
      <div class="text-xs text-muted">Diperbarui {{ timeAgo(lastRunAt) }} · tiap 30 menit</div>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <div class="flex gap-1 rounded-lg bg-panel p-1">
        <button
          v-for="t in tabs"
          :key="t.value"
          class="rounded-md px-3 py-1.5 text-sm transition-colors duration-200"
          :class="status === t.value ? 'bg-panel-2 text-text' : 'text-muted hover:text-text'"
          @click="status = t.value"
        >
          {{ t.label }} <span class="num ml-1 text-xs text-muted">{{ t.count }}</span>
        </button>
      </div>
      <select v-model="chain">
        <option value="">Semua jaringan</option>
        <option value="solana">Solana</option>
        <option value="base">Base</option>
        <option value="ethereum">Ethereum</option>
        <option value="bsc">BNB Chain</option>
      </select>
    </div>

    <div v-if="candidates === null" class="grid gap-4 lg:grid-cols-2 3xl:grid-cols-3 4xl:grid-cols-4">
      <div v-for="i in 4" :key="i" class="card p-4"><Skeleton :rows="4" height="h-8" /></div>
    </div>

    <EmptyState
      v-else-if="!candidates.length"
      title="Belum ada kandidat"
      description="Discovery berjalan otomatis setiap 30 menit. Jalankan manual dengan: php artisan market:discover --sync"
    />

    <TransitionGroup v-else tag="div" name="row" class="grid gap-4 lg:grid-cols-2 3xl:grid-cols-3 4xl:grid-cols-4">
      <article
        v-for="(c, i) in candidates"
        :key="c.id"
        class="card card-hover animate-fade-up flex flex-col p-4"
        :class="{ 'opacity-75': c.status === 'rejected' }"
        :style="{ animationDelay: `${Math.min(i, 12) * 40}ms` }"
      >
        <header class="flex items-start gap-3">
          <TokenAvatar :src="c.image_url" :symbol="c.symbol" :size="40" />
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <span class="font-semibold">{{ c.symbol }}<span class="text-muted">/{{ c.quote_symbol }}</span></span>
              <span class="text-xs text-muted">{{ c.chain_label }}</span>
              <span v-if="ageDays(c.pair_created_at) !== null" class="text-xs text-muted">· umur {{ ageDays(c.pair_created_at) }} hari</span>
            </div>
            <div class="mt-1 flex flex-wrap gap-1">
              <span v-for="s in c.sources" :key="s" class="rounded px-1.5 py-0.5 text-[11px] font-medium" :class="sourceMeta[s].class" :title="sourceMeta[s].title">
                {{ sourceMeta[s].label }}
              </span>
              <span v-if="c.news_mentions" class="rounded bg-panel-2 px-1.5 py-0.5 text-[11px] text-muted">{{ c.news_mentions }} berita</span>
            </div>
          </div>
          <div
            class="num flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-full ring-2 transition-colors duration-500"
            :class="scoreRing(c.scores.discovery)"
            :title="c.scores.discovery === null ? 'Belum dicek mendalam' : 'Skor discovery'"
          >
            <span class="text-lg leading-none font-bold">{{ c.scores.discovery ?? '–' }}</span>
            <span class="text-[9px] text-muted">skor</span>
          </div>
        </header>

        <dl class="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <div>
            <dt class="text-muted">Harga</dt>
            <dd class="num mt-0.5 font-medium"><PriceFlash :value="c.price_usd">{{ price(c.price_usd) }}</PriceFlash></dd>
          </div>
          <div>
            <dt class="text-muted">24j / 1j</dt>
            <dd class="num mt-0.5">
              <span :class="changeClass(c.price_change.h24)">{{ pct(c.price_change.h24, 1) }}</span>
              <span class="text-muted"> / </span>
              <span :class="changeClass(c.price_change.h1)">{{ pct(c.price_change.h1, 1) }}</span>
            </dd>
          </div>
          <div>
            <dt class="text-muted">Likuiditas</dt>
            <dd class="num mt-0.5">{{ usd(c.liquidity_usd, true) }}</dd>
          </div>
          <div>
            <dt class="text-muted">Volume 24j</dt>
            <dd class="num mt-0.5">{{ usd(c.volume_h24, true) }}</dd>
          </div>
        </dl>

        <div class="mt-4 space-y-3">
          <div v-if="buyerShare(c) !== null">
            <div class="mb-1 flex justify-between text-[11px] text-muted">
              <span>Pembeli unik {{ c.txns_h24.buyers?.toLocaleString() }}</span>
              <span>Penjual unik {{ c.txns_h24.sellers?.toLocaleString() }}</span>
            </div>
            <div class="flex h-1.5 overflow-hidden rounded-full bg-down/60">
              <div class="h-full bg-up transition-[width] duration-700 ease-out" :style="{ width: `${buyerShare(c)}%` }" />
            </div>
          </div>

          <div v-if="c.whale" class="rounded-lg bg-panel-2/60 p-2.5">
            <div class="mb-1.5 flex items-center justify-between text-[11px]">
              <span class="font-medium text-text">Whale 24 jam</span>
              <span class="text-muted">{{ c.whale.trades }} transaksi · {{ c.whale.buy_wallets }} wallet beli</span>
            </div>
            <div class="space-y-1">
              <div class="flex items-center gap-2 text-[11px]">
                <span class="w-8 text-up">Beli</span>
                <div class="h-1.5 flex-1 rounded-full bg-panel"><div class="h-full rounded-full bg-up transition-[width] duration-700" :style="{ width: whaleWidth(c, 'buy') }" /></div>
                <span class="num w-16 text-right">{{ usd(c.whale.buy_usd, true) }}</span>
              </div>
              <div class="flex items-center gap-2 text-[11px]">
                <span class="w-8 text-down">Jual</span>
                <div class="h-1.5 flex-1 rounded-full bg-panel"><div class="h-full rounded-full bg-down transition-[width] duration-700" :style="{ width: whaleWidth(c, 'sell') }" /></div>
                <span class="num w-16 text-right">{{ usd(c.whale.sell_usd, true) }}</span>
              </div>
            </div>
          </div>
          <p v-else class="rounded-lg bg-panel-2/40 p-2.5 text-[11px] text-muted">Whale & keamanan belum dicek (hanya kandidat teratas yang dicek tiap putaran).</p>

          <div class="grid grid-cols-2 gap-x-4 gap-y-2">
            <ScoreBar label="Tren" :score="c.scores.trend" :weight="0.3" />
            <ScoreBar label="Atensi" :score="c.scores.attention" :weight="0.15" />
            <ScoreBar v-if="c.scores.whale !== null" label="Whale" :score="c.scores.whale" :weight="0.35" />
            <ScoreBar v-if="c.scores.security !== null" label="Keamanan" :score="c.scores.security" :weight="0.2" />
          </div>
        </div>

        <ul class="mt-3 space-y-1 text-xs text-muted">
          <li v-for="(r, ri) in expanded.has(c.id) ? c.reasons : c.reasons.slice(0, 3)" :key="ri" :class="{ 'text-down': r.startsWith('Ditolak') }">• {{ r }}</li>
        </ul>
        <button v-if="c.reasons.length > 3" class="mt-1 self-start text-[11px] text-brand hover:underline" @click="toggle(c.id)">
          {{ expanded.has(c.id) ? 'Ringkas' : `+${c.reasons.length - 3} alasan lain` }}
        </button>

        <footer class="mt-auto flex items-center gap-2 pt-4">
          <template v-if="c.status === 'tracked' && c.token_id">
            <RecommendationBadge :value="c.token?.recommendation" />
            <span v-if="c.token?.final_score !== null && c.token?.final_score !== undefined" class="num text-xs text-muted">{{ c.token.final_score }}/100</span>
            <RouterLink :to="`/tokens/${c.token_id}`" class="btn-primary ml-auto py-1.5 text-xs">Lihat analisis →</RouterLink>
          </template>
          <template v-else-if="c.status === 'candidate'">
            <a v-if="c.url" :href="c.url" target="_blank" rel="noopener" class="text-xs text-muted transition-colors hover:text-brand">DEX Screener ↗</a>
            <button class="btn-ghost ml-auto py-1.5 text-xs" :disabled="tracking === c.id" @click="track(c)">
              {{ tracking === c.id ? 'Menambahkan…' : 'Tambah ke Market' }}
            </button>
          </template>
          <span v-else class="text-xs text-down">Tidak direkomendasikan</span>
        </footer>
      </article>
    </TransitionGroup>
  </div>
</template>
