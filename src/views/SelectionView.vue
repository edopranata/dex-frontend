<script setup lang="ts">
import { computed, ref } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import EmptyState from '@/components/EmptyState.vue'
import Skeleton from '@/components/Skeleton.vue'
import StatCard from '@/components/StatCard.vue'
import { usePolling } from '@/composables/usePolling'
import { api } from '@/lib/api'
import { changeClass } from '@/lib/format'
import type { Selection, SelectionRow, StrategyKind } from '@/lib/types'

const selection = ref<Selection | null>(null)

async function load() {
  selection.value = (await api.get<Selection>('/reports/selection')).data
}

usePolling(load, 60000)

const counts = computed(() => {
  const rows = [...(selection.value?.accounts ?? []), ...(selection.value?.strategy_accounts ?? [])]
  return {
    active: rows.filter((r) => r.status === 'active').length,
    failed: rows.filter((r) => r.status === 'failed').length,
    insufficient: rows.filter((r) => r.status === 'insufficient').length,
  }
})

const statusLabel: Record<SelectionRow['status'], string> = { active: 'Aktif', failed: 'Tidak lolos', insufficient: 'Belum cukup data' }
const statusClass: Record<SelectionRow['status'], string> = {
  active: 'bg-up/15 text-up',
  failed: 'bg-down/15 text-down',
  insufficient: 'bg-panel-2 text-muted',
}
const kindLabel: Record<StrategyKind, string> = { main: 'Utama', shadow: 'Bayangan', experiment: 'Eksperimen', benchmark: 'Pembanding' }
const kindClass: Record<StrategyKind, string> = {
  main: 'bg-brand/15 text-brand',
  shadow: 'bg-panel-2 text-muted',
  experiment: 'bg-warn/15 text-warn',
  benchmark: 'bg-panel-2 text-muted',
}

function number(value: number, digits: number): string {
  return value.toLocaleString('id-ID', { maximumFractionDigits: digits })
}

function r(value: number | null): string {
  return value === null ? '–' : `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(2).replace('.', ',')}R`
}

function rate(value: number | null): string {
  return value === null ? '–' : `${number(value, 1)}%`
}

function day(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '–'
}
</script>

<template>
  <div class="stack-section">
    <div class="grid grid-cols-1 gap-section sm:grid-cols-3">
      <StatCard label="Aktif" :loading="!selection" :value="String(counts.active)" hint="Lolos semua batas, bisa diikuti dari Portofolio (tahap 2)" tone="up" />
      <StatCard label="Tidak lolos" :loading="!selection" :value="String(counts.failed)" :hint="selection ? `Sudah ≥ ${selection.limits.min_trades} trade, ada batas yang gagal` : ''" />
      <StatCard label="Belum cukup data" :loading="!selection" :value="String(counts.insufficient)" :hint="selection ? `Kurang dari ${selection.limits.min_trades} trade selesai` : ''" />
    </div>

    <section class="card animate-fade-up overflow-x-auto">
      <h2 class="card-title p-4 pb-2">Akun auto-follow · versi {{ selection?.version ?? '…' }}</h2>
      <Skeleton v-if="!selection" class="p-3" :rows="6" />
      <EmptyState v-else-if="!selection.accounts.length" title="Belum ada akun auto-follow" description="Akun dibuat saat sinyal pertama diikuti." />
      <table v-else class="table">
        <thead>
          <tr>
            <th>Akun</th>
            <th>Status</th>
            <th>Mulai dinilai</th>
            <th class="text-right!">Lot selesai</th>
            <th class="text-right!">Win rate</th>
            <th class="text-right!">R per lot</th>
            <th class="text-right!">Drawdown</th>
            <th class="text-right!">Semua versi</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="a in selection.accounts" :key="a.key" class="hover:bg-panel-2/40">
            <td class="font-medium">{{ a.label }}</td>
            <td class="text-xs">
              <span class="rounded px-1.5 py-0.5 font-medium whitespace-nowrap" :class="statusClass[a.status]">{{ statusLabel[a.status] }}</span>
              <p v-for="reason in a.reasons" :key="reason" class="mt-1 text-muted">{{ reason }}</p>
            </td>
            <td class="text-xs whitespace-nowrap">
              {{ day(selection.version_started_at) }}
              <p class="text-muted">akun sejak {{ day(a.account_started_at) }}</p>
            </td>
            <td class="num text-right text-xs whitespace-nowrap">
              {{ a.closed }}
              <span class="text-muted">({{ a.wins }} menang · {{ a.even }} impas · {{ a.losses }} kalah)</span>
              <p v-if="a.open" class="text-muted">{{ a.open }} masih terbuka</p>
            </td>
            <td class="num text-right">{{ rate(a.win_rate) }}</td>
            <td class="num text-right" :class="changeClass(a.avg_r)">{{ r(a.avg_r) }}</td>
            <td class="num text-right" :class="a.drawdown_pct >= selection.limits.max_drawdown_pct ? 'text-down' : 'text-muted'">{{ number(a.drawdown_pct, 2) }}%</td>
            <td class="num text-right text-xs whitespace-nowrap text-muted">
              {{ a.all_versions.closed }} lot · {{ rate(a.all_versions.win_rate) }} · <span :class="changeClass(a.all_versions.avg_r)">{{ r(a.all_versions.avg_r) }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="card animate-fade-up overflow-x-auto">
      <h2 class="card-title p-4 pb-2">Akun strategi dari FutureSim (long, candle DEX)</h2>
      <Skeleton v-if="!selection" class="p-3" :rows="6" />
      <EmptyState
        v-else-if="!selection.strategy_accounts.length"
        title="Belum ada akun strategi"
        description="Akun dibuat saat strategies:run pertama kali berjalan."
      />
      <table v-else class="table">
        <thead>
          <tr>
            <th>Akun</th>
            <th>Status</th>
            <th>Mulai</th>
            <th class="text-right!">Trade selesai</th>
            <th class="text-right!">Win rate</th>
            <th class="text-right!">R per trade</th>
            <th class="text-right!">Hasil per trade</th>
            <th class="text-right!">Drawdown</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="a in selection.strategy_accounts" :key="a.key" class="hover:bg-panel-2/40">
            <td>
              <RouterLink :to="{ name: 'strategy-accounts', query: { account: a.key } }" class="font-medium hover:text-brand">{{ a.label }}</RouterLink>
              <span class="ml-2 rounded px-1.5 py-0.5 text-[10px] font-medium" :class="kindClass[a.kind]">{{ kindLabel[a.kind] }}</span>
            </td>
            <td class="text-xs">
              <span class="rounded px-1.5 py-0.5 font-medium whitespace-nowrap" :class="statusClass[a.status]">{{ statusLabel[a.status] }}</span>
              <p v-for="reason in a.reasons" :key="reason" class="mt-1 text-muted">{{ reason }}</p>
            </td>
            <td class="text-xs whitespace-nowrap">{{ day(a.started_at) }}</td>
            <td class="num text-right text-xs whitespace-nowrap">
              {{ a.closed }}
              <span class="text-muted">({{ a.wins }} menang · {{ a.even }} impas · {{ a.losses }} kalah)</span>
              <p v-if="a.open || a.pending" class="text-muted">
                {{ a.open }} masih terbuka<template v-if="a.pending"> · {{ a.pending }} order limit</template>
              </p>
            </td>
            <td class="num text-right">{{ rate(a.win_rate) }}</td>
            <td class="num text-right" :class="changeClass(a.avg_r)">
              {{ r(a.avg_r) }}
              <p v-if="a.avg_r !== null && a.r_trades < a.closed" class="text-xs text-muted">dari {{ a.r_trades }} trade ber-stop</p>
            </td>
            <td class="num text-right" :class="changeClass(a.avg_pct)">{{ a.avg_pct === null ? '–' : `${a.avg_pct > 0 ? '+' : ''}${number(a.avg_pct, 2)}%` }}</td>
            <td class="num text-right" :class="a.drawdown_pct >= selection.limits.max_drawdown_pct ? 'text-down' : 'text-muted'">{{ number(a.drawdown_pct, 2) }}%</td>
          </tr>
        </tbody>
      </table>
    </section>

    <p v-if="selection" class="flex items-start gap-2 text-xs text-muted">
      <AppIcon name="info" class="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        Aktif bila minimal {{ selection.limits.min_trades }} trade selesai, win rate ≥ {{ number(selection.limits.min_win_rate, 1) }}%, rata-rata ≥
        {{ r(selection.limits.min_avg_r) }} per trade, dan drawdown ekuitas &lt; {{ number(selection.limits.max_drawdown_pct, 1) }}%. Hasil setelah fee 0,3%, gas,
        dan price impact. R = hasil bersih dibagi risiko awal (jumlah × jarak harga beli ke stop awal). Menang di atas +0,05R, impas antara −0,05R dan +0,05R;
        impas tetap dihitung di pembagi win rate. Akun auto-follow dinilai dari lot versi strategi sekarang ("Mulai dinilai" = sinyal pertama versi ini); kolom
        "Semua versi" hanya pembanding. Akun strategi menjalankan strategi long FutureSim di candle DEX sejak tanggal mulainya; akun tanpa stop (tren, martingale)
        hanya punya hasil per trade dan tidak bisa lolos lewat R. Drawdown memakai ekuitas sejak awal akun dan ekuitas sekarang, termasuk posisi terbuka. Batas
        diubah di Admin → Pengaturan → Seleksi akun.
      </span>
    </p>
  </div>
</template>
