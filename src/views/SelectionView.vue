<script setup lang="ts">
import { computed, ref } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import EmptyState from '@/components/EmptyState.vue'
import Skeleton from '@/components/Skeleton.vue'
import StatCard from '@/components/StatCard.vue'
import { usePolling } from '@/composables/usePolling'
import { api } from '@/lib/api'
import { changeClass } from '@/lib/format'
import type { Selection, SelectionRow } from '@/lib/types'

const selection = ref<Selection | null>(null)

async function load() {
  selection.value = (await api.get<Selection>('/reports/selection')).data
}

usePolling(load, 60000)

const counts = computed(() => {
  const rows = selection.value?.accounts ?? []
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

function number(value: number, digits: number): string {
  return value.toLocaleString('id-ID', { maximumFractionDigits: digits })
}

function r(value: number | null): string {
  return value === null ? '–' : `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(2).replace('.', ',')}R`
}

function rate(value: number | null): string {
  return value === null ? '–' : `${number(value, 1)}%`
}
</script>

<template>
  <div class="stack-section">
    <div class="grid grid-cols-1 gap-section sm:grid-cols-3">
      <StatCard label="Aktif" :loading="!selection" :value="String(counts.active)" hint="Lolos semua batas, bisa diikuti dari Portofolio (tahap 2)" tone="up" />
      <StatCard label="Tidak lolos" :loading="!selection" :value="String(counts.failed)" :hint="selection ? `Sudah ≥ ${selection.limits.min_trades} lot, ada batas yang gagal` : ''" />
      <StatCard label="Belum cukup data" :loading="!selection" :value="String(counts.insufficient)" :hint="selection ? `Kurang dari ${selection.limits.min_trades} lot selesai di versi ${selection.version}` : ''" />
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

    <p v-if="selection" class="flex items-start gap-2 text-xs text-muted">
      <AppIcon name="info" class="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        Aktif bila minimal {{ selection.limits.min_trades }} lot selesai di versi strategi sekarang, win rate ≥ {{ number(selection.limits.min_win_rate, 1) }}%,
        rata-rata ≥ {{ r(selection.limits.min_avg_r) }} per lot, dan drawdown ekuitas &lt; {{ number(selection.limits.max_drawdown_pct, 1) }}%. Hasil setelah fee,
        gas, dan price impact. R = hasil bersih dibagi risiko awal (jumlah × jarak harga beli ke stop sinyal). Menang di atas +0,05R, impas antara −0,05R dan
        +0,05R; impas tetap dihitung di pembagi win rate. Drawdown memakai ekuitas akun sejak awal (semua versi) dan ekuitas sekarang, termasuk posisi terbuka.
        Kolom "Semua versi" hanya pembanding. Rincian tiap akun ada di Laporan; batas diubah di Admin → Pengaturan → Seleksi akun.
      </span>
    </p>
  </div>
</template>
