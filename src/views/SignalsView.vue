<script setup lang="ts">
import { ref, watch } from 'vue'
import EmptyState from '@/components/EmptyState.vue'
import RecommendationBadge from '@/components/RecommendationBadge.vue'
import StatCard from '@/components/StatCard.vue'
import TokenAvatar from '@/components/TokenAvatar.vue'
import { usePolling } from '@/composables/usePolling'
import { api } from '@/lib/api'
import { dateTime, price } from '@/lib/format'
import type { Paginated, Signal } from '@/lib/types'
import { tokenPath } from '@/lib/links'

interface Stats {
  total: number
  open: number
  closed: number
  entered: number
  not_entered: number
  wins: number
  losses: number
  win_rate: number | null
  total_r: number
  avg_r: number | null
  tp_hits: { tp1: number; tp2: number; tp3: number }
}

const stats = ref<Stats | null>(null)
const signals = ref<Signal[]>([])
const status = ref<'' | 'open' | 'closed'>('')

async function load() {
  const [s, l] = await Promise.all([
    api.get<Stats>('/signals/stats'),
    api.get<Paginated<Signal>>('/signals', { params: status.value ? { status: status.value } : {} }),
  ])
  stats.value = s.data
  signals.value = l.data.data
}

usePolling(load, 30000)
watch(status, load)

const statusLabel: Record<string, [string, string]> = {
  pending: ['Menunggu entry', 'text-warn'],
  active: ['Aktif', 'text-brand'],
  take_profit: ['Take profit', 'text-up'],
  stop_loss: ['Stop loss', 'text-down'],
  invalidated: ['Batal (SL sebelum entry)', 'text-muted'],
  expired: ['Kedaluwarsa', 'text-muted'],
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-xl font-semibold">Sinyal & rekam jejak</h1>
      <p class="mt-1 text-sm text-muted">
        Setiap sinyal beli dilacak otomatis: entry di zona, ambil 1/3 di tiap TP, stop pindah ke breakeven setelah TP1. Hasil dalam satuan R (1R = jarak entry ke stop loss).
        Pantau angka ini minimal beberapa minggu sebelum memakai sinyal dengan uang sungguhan.
      </p>
    </div>

    <div class="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <StatCard label="Win rate" :value="stats?.win_rate !== null && stats?.win_rate !== undefined ? `${stats.win_rate}%` : '–'" :hint="`${stats?.wins ?? 0} menang / ${stats?.losses ?? 0} kalah`" />
      <StatCard label="Total R" :value="stats ? `${stats.total_r > 0 ? '+' : ''}${stats.total_r}R` : '–'" :tone="(stats?.total_r ?? 0) >= 0 ? 'up' : 'down'" />
      <StatCard label="Rata-rata per trade" :value="stats?.avg_r !== null && stats?.avg_r !== undefined ? `${stats.avg_r}R` : '–'" />
      <StatCard label="Kena TP1 / TP2 / TP3" :value="stats ? `${stats.tp_hits.tp1} / ${stats.tp_hits.tp2} / ${stats.tp_hits.tp3}` : '–'" :hint="`dari ${stats?.entered ?? 0} sinyal selesai`" />
      <StatCard label="Sinyal terbuka" :value="String(stats?.open ?? 0)" :hint="`${stats?.not_entered ?? 0} tidak pernah entry`" />
    </div>

    <div class="card overflow-x-auto">
      <div class="flex gap-1 p-3">
        <button
          v-for="(label, key) in { '': 'Semua', open: 'Terbuka', closed: 'Selesai' }"
          :key="key"
          class="rounded px-3 py-1 text-sm transition-colors duration-200"
          :class="status === key ? 'bg-panel-2' : 'text-muted'"
          @click="status = key as typeof status"
        >
          {{ label }}
        </button>
      </div>
      <table v-if="signals.length" class="table">
        <thead>
          <tr>
            <th>Dibuat</th>
            <th>Token</th>
            <th>Sinyal</th>
            <th class="text-right!">Zona entry</th>
            <th class="text-right!">SL</th>
            <th class="text-right!">TP1 / TP2 / TP3</th>
            <th class="text-right!">Entry → keluar</th>
            <th>Status</th>
            <th class="text-right!">Hasil</th>
          </tr>
        </thead>
        <TransitionGroup tag="tbody" name="row">
          <tr v-for="s in signals" :key="s.id" class="transition-colors hover:bg-panel-2/50">
            <td class="text-xs whitespace-nowrap text-muted">{{ dateTime(s.created_at) }}</td>
            <td>
              <RouterLink :to="tokenPath(s.token, s.token_id)" class="flex items-center gap-2 hover:text-brand">
                <TokenAvatar :src="s.token?.image_url" :symbol="s.token?.symbol ?? '?'" :size="20" />{{ s.token?.symbol }}
              </RouterLink>
            </td>
            <td><RecommendationBadge :value="s.recommendation" /></td>
            <td class="num text-right text-xs">{{ price(s.entry_low) }} – {{ price(s.entry_high) }}</td>
            <td class="num text-right text-xs text-down">{{ price(s.stop_loss) }}</td>
            <td class="num text-right text-xs text-up">{{ price(s.take_profit_1) }} / {{ price(s.take_profit_2) }} / {{ price(s.take_profit_3) }}</td>
            <td class="num text-right text-xs">{{ price(s.entry_price) }} → {{ price(s.exit_price) }}</td>
            <td class="text-xs whitespace-nowrap" :class="statusLabel[s.status][1]">
              {{ statusLabel[s.status][0] }}<span v-if="s.max_tp_hit"> · TP{{ s.max_tp_hit }}</span>
            </td>
            <td class="num text-right font-semibold" :class="(s.result_r ?? 0) > 0 ? 'text-up' : (s.result_r ?? 0) < 0 ? 'text-down' : 'text-muted'">
              {{ s.result_r !== null ? `${s.result_r > 0 ? '+' : ''}${s.result_r}R` : '' }}
            </td>
          </tr>
        </TransitionGroup>
      </table>
      <EmptyState v-else title="Belum ada sinyal" description="Sinyal muncul saat skor gabungan ≥ 60 dan analisis teknikal mengonfirmasi." />
    </div>
  </div>
</template>
