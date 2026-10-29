<script setup lang="ts">
import { compact, timeAgo } from '@/lib/format'
import type { SecurityCheck } from '@/lib/types'

defineProps<{ security: SecurityCheck | null | undefined }>()
</script>

<template>
  <div class="card p-4">
    <div class="flex items-center justify-between">
      <div class="card-title">Keamanan kontrak</div>
      <span v-if="security" class="text-[11px] text-muted">GoPlus · {{ timeAgo(security.checked_at) }}</span>
    </div>

    <p v-if="!security" class="mt-3 text-sm text-muted">Belum dicek. Pengecekan berjalan setiap 6 jam.</p>

    <template v-else>
      <div class="mt-3 flex items-baseline gap-2">
        <span
          class="num text-3xl font-bold"
          :class="security.risk_score >= 70 ? 'text-up' : security.risk_score >= 40 ? 'text-warn' : 'text-down'"
        >
          {{ security.risk_score }}
        </span>
        <span class="text-sm text-muted">/100 skor keamanan</span>
      </div>
      <p v-if="security.is_honeypot" class="mt-2 rounded bg-down/15 px-2 py-1 text-sm font-semibold text-down">HONEYPOT: token tidak bisa dijual.</p>

      <dl class="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div class="rounded bg-panel-2 p-2"><dt class="text-muted">Holder</dt><dd class="num mt-0.5 font-medium">{{ compact(security.holder_count) }}</dd></div>
        <div class="rounded bg-panel-2 p-2"><dt class="text-muted">Top 10 holder</dt><dd class="num mt-0.5 font-medium">{{ security.top10_percent ?? '–' }}%</dd></div>
        <div class="rounded bg-panel-2 p-2"><dt class="text-muted">LP terkunci/burn</dt><dd class="num mt-0.5 font-medium">{{ security.lp_locked_percent ?? '–' }}%</dd></div>
        <div class="rounded bg-panel-2 p-2">
          <dt class="text-muted">Pajak beli/jual</dt>
          <dd class="num mt-0.5 font-medium">{{ security.buy_tax ?? '–' }}% / {{ security.sell_tax ?? '–' }}%</dd>
        </div>
      </dl>

      <ul v-if="security.flags.length" class="mt-3 space-y-1.5 text-xs">
        <li v-for="(flag, i) in security.flags" :key="i" class="flex gap-2">
          <span
            class="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
            :class="{ 'bg-down': flag.level === 'danger', 'bg-warn': flag.level === 'warning', 'bg-muted': flag.level === 'info' }"
          />
          <span>{{ flag.message }}</span>
        </li>
      </ul>
      <p v-else class="mt-3 text-xs text-up">Tidak ada temuan risiko.</p>
    </template>
  </div>
</template>
