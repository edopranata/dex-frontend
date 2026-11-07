<script setup lang="ts">
import { computed, ref } from 'vue'
import EmptyState from '@/components/EmptyState.vue'
import Skeleton from '@/components/Skeleton.vue'
import StatCard from '@/components/StatCard.vue'
import { usePolling } from '@/composables/usePolling'
import { api } from '@/lib/api'
import { dateTime, timeAgo } from '@/lib/format'

interface TokenRow {
  id: number
  symbol: string
  name: string
  slug: string
  chain_label: string
  in_market: boolean
  pinned: boolean
  entries: number
  first_added_at: string | null
  last_removed_at: string | null
  last_removed_reason: string | null
  out_days: number | null
  candles: Record<string, number>
  candle_rows: number
  latest_15m_at: string | null
  fetch: 'every_15m' | 'rotation'
  signals: number
}

interface Summary {
  tokens: number
  in_market: number
  out_of_market: number
  out_groups: { under_7: number; '7_to_30': number; over_30: number }
  rotation_per_hour: number
  rotation_hours: number | null
  rotation_limit_hours: number
  candle_rows: number
  candle_rows_out_of_market: number
  requests_per_hour: number
  request_limit_per_hour: number
}

const summary = ref<Summary | null>(null)
const tokens = ref<TokenRow[]>([])
const filter = ref<'all' | 'in' | 'out'>('all')
const search = ref('')

async function load() {
  const { data } = await api.get<{ summary: Summary; tokens: TokenRow[] }>('/admin/tokens')
  summary.value = data.summary
  tokens.value = data.tokens
}

usePolling(load, 60000)

const rows = computed(() => {
  const term = search.value.trim().toLowerCase()
  return tokens.value.filter(
    (t) =>
      (filter.value === 'all' || (filter.value === 'in') === t.in_market) &&
      (!term || t.symbol.toLowerCase().includes(term) || t.name.toLowerCase().includes(term)),
  )
})

const load_pct = computed(() => (summary.value ? Math.round((summary.value.requests_per_hour / summary.value.request_limit_per_hour) * 100) : 0))
const rotationLate = computed(() => !!summary.value?.rotation_hours && summary.value.rotation_hours >= summary.value.rotation_limit_hours)

const number = (value: number) => value.toLocaleString('id-ID')
const days = (value: number) => (value < 1 ? `${Math.round(value * 24)} jam` : `${value.toLocaleString('id-ID', { maximumFractionDigits: 1 })} hari`)
const timeframes = ['15m', '1h', '4h', '1d']
</script>

<template>
  <div class="stack-section">
    <Skeleton v-if="!summary" :rows="3" height="h-24" />

    <template v-else>
      <div class="grid grid-cols-2 gap-section lg:grid-cols-4">
        <StatCard label="Pernah di Market" :value="number(summary.tokens)" :hint="`${summary.in_market} di Market · ${summary.out_of_market} sudah keluar`" />
        <StatCard
          label="Permintaan GeckoTerminal"
          :value="`±${number(summary.requests_per_hour)}/jam`"
          :hint="`${load_pct}% dari batas ${number(summary.request_limit_per_hour)}/jam · candle dan whale, tanpa discover`"
          :tone="load_pct >= 85 ? 'down' : undefined"
        />
        <StatCard
          label="Giliran token keluar"
          :value="`${summary.rotation_per_hour} token/jam`"
          :hint="summary.rotation_hours === null ? 'Belum ada token yang keluar' : `Tiap token diperbarui ±${days(summary.rotation_hours / 24)} sekali; aman sampai ${days(summary.rotation_limit_hours / 24)}`"
          :tone="rotationLate ? 'down' : undefined"
        />
        <StatCard label="Candle tersimpan" :value="number(summary.candle_rows)" :hint="`${number(summary.candle_rows_out_of_market)} milik token yang sudah keluar`" />
      </div>

      <p v-if="rotationLate" class="rounded-lg border border-down/40 bg-down/10 px-3 py-2 text-sm text-down">
        Giliran sudah lebih lama dari jangkauan isi celah (7 hari), jadi data 15m token yang keluar mulai bolong. Naikkan jumlah token per jam atau berhenti mengambil token yang sudah lama keluar.
      </p>

      <section class="card p-4">
        <div class="flex flex-wrap items-center gap-2">
          <div class="inline-flex rounded-lg border border-line bg-panel-2/60 p-0.5 text-xs" role="tablist" aria-label="Status token">
            <button
              v-for="f in [{ value: 'all', label: `Semua (${summary.tokens})` }, { value: 'in', label: `Di Market (${summary.in_market})` }, { value: 'out', label: `Keluar (${summary.out_of_market})` }] as const"
              :key="f.value"
              type="button"
              role="tab"
              class="rounded-md px-3 py-1 transition-colors duration-150"
              :class="filter === f.value ? 'bg-brand/20 font-medium text-text' : 'text-muted hover:text-text'"
              :aria-selected="filter === f.value"
              @click="filter = f.value"
            >
              {{ f.label }}
            </button>
          </div>
          <span class="text-xs text-muted">
            Sudah keluar: {{ summary.out_groups.under_7 }} kurang dari 7 hari · {{ summary.out_groups['7_to_30'] }} 7–30 hari · {{ summary.out_groups.over_30 }} lebih dari 30 hari
          </span>
          <input v-model="search" type="search" class="ml-auto w-48" placeholder="Cari token…" aria-label="Cari token" />
        </div>

        <div class="mt-3 overflow-x-auto">
          <table v-if="rows.length" class="table">
            <thead>
              <tr>
                <th>Token</th>
                <th>Status</th>
                <th>Masuk Market</th>
                <th>Keluar terakhir</th>
                <th class="text-right">Candle tersimpan</th>
                <th>15m terakhir</th>
                <th>Pengambilan</th>
                <th class="text-right">Sinyal</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="t in rows" :key="t.id">
                <td class="whitespace-nowrap">
                  <RouterLink :to="`/tokens/${t.slug}`" class="font-medium hover:text-brand">{{ t.symbol }}</RouterLink>
                  <span class="block max-w-48 truncate text-[11px] text-muted" :title="t.name">{{ t.chain_label }} · {{ t.name }}</span>
                </td>
                <td class="whitespace-nowrap">
                  <span v-if="t.in_market" class="text-xs font-medium text-up">Di Market{{ t.pinned ? ' · dikunci' : '' }}</span>
                  <span v-else class="text-xs text-muted">Keluar {{ t.out_days === null ? '' : days(t.out_days) }}</span>
                </td>
                <td class="whitespace-nowrap">
                  <span class="num">{{ t.entries }}×</span>
                  <span class="block text-[11px] text-muted">sejak {{ dateTime(t.first_added_at) }}</span>
                </td>
                <td>
                  <template v-if="t.last_removed_at">
                    <span class="whitespace-nowrap">{{ dateTime(t.last_removed_at) }}</span>
                    <span v-if="t.last_removed_reason" class="block max-w-64 truncate text-[11px] text-muted" :title="t.last_removed_reason">{{ t.last_removed_reason }}</span>
                  </template>
                  <span v-else class="text-muted">–</span>
                </td>
                <td class="num text-right whitespace-nowrap">
                  {{ number(t.candle_rows) }}
                  <span class="block text-[11px] text-muted">{{ timeframes.map((tf) => `${tf} ${number(t.candles[tf] ?? 0)}`).join(' · ') }}</span>
                </td>
                <td class="whitespace-nowrap">{{ t.latest_15m_at ? timeAgo(t.latest_15m_at) : '–' }}</td>
                <td class="text-xs whitespace-nowrap">{{ t.fetch === 'every_15m' ? 'Tiap 15 menit' : 'Bergiliran' }}</td>
                <td class="num text-right">{{ t.signals }}</td>
              </tr>
            </tbody>
          </table>
          <EmptyState v-else title="Tidak ada token" description="Tidak ada token untuk pilihan atau pencarian ini." />
        </div>
      </section>
    </template>
  </div>
</template>
