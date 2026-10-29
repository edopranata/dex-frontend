<script setup lang="ts">
import { ref } from 'vue'
import EmptyState from '@/components/EmptyState.vue'
import FearGreedGauge from '@/components/FearGreedGauge.vue'
import NewsList from '@/components/NewsList.vue'
import RecommendationBadge from '@/components/RecommendationBadge.vue'
import Skeleton from '@/components/Skeleton.vue'
import StatCard from '@/components/StatCard.vue'
import TokenAvatar from '@/components/TokenAvatar.vue'
import WhaleTable from '@/components/WhaleTable.vue'
import { usePolling } from '@/composables/usePolling'
import { api } from '@/lib/api'
import { changeClass, pct, price, usd } from '@/lib/format'
import type { Analysis, Candidate, NewsItem, Portfolio, Recommendation, WhaleTrade } from '@/lib/types'

interface Overview {
  fear_greed: { value: number; classification: string } | null
  recommendation_counts: Record<Recommendation, number>
  top_picks: Analysis[]
  warnings: Analysis[]
  whales: WhaleTrade[]
  news: NewsItem[]
  discoveries: Candidate[]
}

const overview = ref<Overview | null>(null)
const portfolio = ref<Portfolio | null>(null)

usePolling(async () => {
  const [o, p] = await Promise.all([api.get<Overview>('/market/overview'), api.get<Portfolio>('/portfolio')])
  overview.value = o.data
  portfolio.value = p.data
}, 15000)

const order: Recommendation[] = ['STRONG_BUY', 'BUY', 'HOLD', 'SELL', 'STRONG_SELL', 'AVOID']
</script>

<template>
  <div class="space-y-6">
    <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard label="Ekuitas" :amount="portfolio?.equity_usd" :format="usd" :hint="`Modal awal ${usd(portfolio?.starting_balance)}`" />
      <StatCard
        label="Total P&L"
        :amount="portfolio?.total_pnl"
        :format="usd"
        :hint="pct(portfolio?.total_pnl_pct)"
        :tone="(portfolio?.total_pnl ?? 0) >= 0 ? 'up' : 'down'"
        style="animation-delay: 60ms"
      />
      <StatCard label="Saldo USD" :amount="portfolio?.balance_usd" :format="usd" :hint="`${portfolio?.positions.length ?? 0} posisi terbuka`" style="animation-delay: 120ms" />
      <StatCard label="Nilai aset" :amount="portfolio?.holdings_value_usd" :format="usd" :hint="`Fee dibayar ${usd(portfolio?.fees_paid)}`" style="animation-delay: 180ms" />
    </div>

    <div class="grid gap-6 lg:grid-cols-3 3xl:grid-cols-4">
      <section class="card animate-fade-up min-w-0 p-4 lg:col-span-2 3xl:col-span-3" style="animation-delay: 120ms">
        <div class="flex items-center justify-between">
          <h2 class="card-title">Rekomendasi teratas</h2>
          <RouterLink to="/signals" class="text-xs text-brand hover:underline">Rekam jejak sinyal →</RouterLink>
        </div>
        <div class="mt-3 flex flex-wrap gap-2">
          <span v-for="r in order" :key="r" class="flex items-center gap-1.5 text-xs text-muted">
            <RecommendationBadge :value="r" /> <span class="num">{{ overview?.recommendation_counts[r] ?? 0 }}</span>
          </span>
        </div>

        <Skeleton v-if="!overview" class="mt-4" :rows="3" height="h-14" />
        <EmptyState
          v-else-if="!overview.top_picks.length"
          title="Belum ada setup beli"
          description="Mesin analisis belum menemukan token dengan skor gabungan cukup tinggi. Ini normal saat pasar tidak jelas arahnya."
        />
        <ul v-else class="mt-3 divide-y divide-line">
          <li v-for="(a, i) in overview?.top_picks" :key="a.id" class="animate-fade-up" :style="{ animationDelay: `${i * 50}ms` }">
            <RouterLink :to="`/tokens/${a.token_id}`" class="-mx-2 flex items-center gap-3 rounded-lg px-2 py-3 transition-colors duration-200 hover:bg-panel-2/50">
              <TokenAvatar :src="a.token?.image_url" :symbol="a.token?.symbol ?? '?'" :size="32" />
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2 font-medium">
                  {{ a.token?.symbol }} <RecommendationBadge :value="a.recommendation" />
                  <span v-if="a.token?.is_new" class="rounded bg-up/15 px-1.5 text-[10px] font-semibold text-up">BARU</span>
                </div>
                <p class="mt-0.5 line-clamp-2 text-xs text-muted">{{ a.summary }}</p>
              </div>
              <div class="num shrink-0 text-right text-xs">
                <div class="text-lg font-bold">{{ a.final_score }}</div>
                <div v-if="a.levels" class="text-muted">Entry {{ price(a.levels.entry_low) }}</div>
                <div v-if="a.levels" class="text-down">SL {{ price(a.levels.stop_loss) }}</div>
              </div>
            </RouterLink>
          </li>
        </ul>

        <template v-if="overview?.warnings.length">
          <h3 class="card-title mt-5">Peringatan</h3>
          <ul class="mt-2 space-y-2">
            <li v-for="a in overview.warnings" :key="a.id">
              <RouterLink :to="`/tokens/${a.token_id}`" class="flex items-center gap-2 rounded-lg bg-down/5 p-2 text-sm hover:bg-down/10">
                <RecommendationBadge :value="a.recommendation" />
                <span class="font-medium">{{ a.token?.symbol }}</span>
                <span class="truncate text-xs text-muted">{{ a.summary }}</span>
              </RouterLink>
            </li>
          </ul>
        </template>
      </section>

      <section class="card animate-fade-up p-4" style="animation-delay: 180ms">
        <h2 class="card-title">Fear & Greed Index</h2>
        <div class="mt-4">
          <FearGreedGauge v-if="overview?.fear_greed" :value="overview.fear_greed.value" :classification="overview.fear_greed.classification" />
          <p v-else class="text-sm text-muted">Tidak tersedia.</p>
        </div>
        <p class="mt-4 text-xs leading-relaxed text-muted">
          Indeks sentimen pasar kripto secara umum (0 = ketakutan ekstrem, 100 = keserakahan ekstrem). Dipakai 20% dalam skor sentimen.
        </p>
      </section>
    </div>

    <section class="card animate-fade-up p-4" style="animation-delay: 220ms">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="card-title">Ditemukan otomatis: trending + whale</h2>
          <p class="mt-0.5 text-xs text-muted">Token yang tidak Anda input, dipilih dari trending DEX & pencarian, lalu disaring keamanan dan arus whale.</p>
        </div>
        <RouterLink to="/discover" class="shrink-0 text-xs text-brand hover:underline">Semua →</RouterLink>
      </div>
      <Skeleton v-if="!overview" class="mt-3" :rows="2" height="h-12" />
      <EmptyState v-else-if="!overview.discoveries.length" title="Belum ada temuan" description="Discovery berjalan setiap 30 menit." />
      <div v-else class="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <RouterLink
          v-for="(c, i) in overview.discoveries"
          :key="c.id"
          :to="c.token_id ? `/tokens/${c.token_id}` : '/discover'"
          class="card-hover animate-fade-up rounded-lg border border-line bg-panel-2/40 p-3"
          :style="{ animationDelay: `${i * 50}ms` }"
        >
          <div class="flex items-center gap-2">
            <TokenAvatar :src="c.image_url" :symbol="c.symbol" :size="24" />
            <span class="truncate font-medium">{{ c.symbol }}</span>
            <span class="num ml-auto text-sm font-bold" :class="(c.scores.discovery ?? 0) >= 65 ? 'text-up' : 'text-warn'">{{ c.scores.discovery }}</span>
          </div>
          <div class="mt-2 flex justify-between text-[11px]">
            <span class="text-muted">{{ c.chain_label }}</span>
            <span class="num" :class="changeClass(c.price_change.h24)">{{ pct(c.price_change.h24, 1) }}</span>
          </div>
          <div v-if="c.whale" class="mt-1 text-[11px] text-muted">
            Whale net <span class="num" :class="c.whale.buy_usd >= c.whale.sell_usd ? 'text-up' : 'text-down'">{{ usd(c.whale.buy_usd - c.whale.sell_usd, true) }}</span>
          </div>
          <div class="mt-1 text-[11px]" :class="c.status === 'tracked' ? 'text-brand' : 'text-muted'">{{ c.status === 'tracked' ? 'Sudah masuk Market' : 'Kandidat' }}</div>
        </RouterLink>
      </div>
    </section>

    <div class="grid gap-6 lg:grid-cols-2">
      <section class="card animate-fade-up min-w-0" style="animation-delay: 260ms">
        <div class="flex items-center justify-between p-4 pb-2">
          <h2 class="card-title">Transaksi whale terbaru</h2>
          <RouterLink to="/whales" class="text-xs text-brand hover:underline">Semua →</RouterLink>
        </div>
        <WhaleTable v-if="overview?.whales.length" :trades="overview.whales" show-token />
        <EmptyState v-else title="Belum ada transaksi whale" />
      </section>

      <section class="card animate-fade-up p-4" style="animation-delay: 300ms">
        <div class="flex items-center justify-between">
          <h2 class="card-title">Berita & sentimen</h2>
          <RouterLink to="/news" class="text-xs text-brand hover:underline">Semua →</RouterLink>
        </div>
        <NewsList v-if="overview?.news.length" :items="overview.news" />
        <EmptyState v-else title="Belum ada berita" />
      </section>
    </div>
  </div>
</template>
