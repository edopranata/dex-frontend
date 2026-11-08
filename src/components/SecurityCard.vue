<script setup lang="ts">
import { computed, ref } from 'vue'
import { compact, explorerUrl, shortAddress, timeAgo } from '@/lib/format'
import type { SecurityCheck, TopHolder } from '@/lib/types'

const props = defineProps<{ security: SecurityCheck | null | undefined; chain?: string }>()

const showHolders = ref(false)

/** One wallet that can sell this much can take most of the liquidity out at any moment. */
const dominance = computed(() => {
  const top = props.security?.top1_percent
  if (top === null || top === undefined) return null
  if (top >= 60) return { label: 'Holder dominan', tone: 'bg-down/15 text-down', hint: 'Satu dompet memegang lebih dari 60% supply dan bisa menjual seluruhnya kapan saja.' }
  if (top >= 30) return { label: 'Waspada', tone: 'bg-warn/15 text-warn', hint: 'Satu dompet memegang lebih dari 30% supply.' }
  return null
})

function kind(holder: TopHolder): string | null {
  if (holder.is_burn) return 'Burn'
  if (holder.is_pool) return 'Pool'
  if (holder.is_locked) return holder.tag ? `Terkunci · ${holder.tag}` : 'Terkunci'
  if (holder.is_contract) return 'Kontrak'
  return holder.tag
}

function percent(value: number): string {
  return value.toLocaleString('id-ID', { maximumFractionDigits: 2 })
}
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
        <div class="col-span-2 rounded bg-panel-2 p-2">
          <dt class="text-muted">Holder terbesar yang bisa menjual</dt>
          <dd class="mt-0.5 flex flex-wrap items-center gap-2">
            <span class="num font-medium">{{ security.top1_percent === null ? '–' : `${percent(security.top1_percent)}%` }}</span>
            <span v-if="dominance" class="rounded px-1.5 py-0.5 text-[11px] font-semibold" :class="dominance.tone" :title="dominance.hint">{{ dominance.label }}</span>
            <span v-if="security.creator_percent !== null" class="text-[11px] text-muted">Creator {{ percent(security.creator_percent) }}% · owner {{ percent(security.owner_percent ?? 0) }}%</span>
          </dd>
          <p v-if="dominance" class="mt-1 text-[11px] text-muted">{{ dominance.hint }}</p>
        </div>
      </dl>

      <div v-if="security.top_holders?.length" class="mt-3">
        <button type="button" class="text-xs text-brand hover:underline" :aria-expanded="showHolders" @click="showHolders = !showHolders">
          {{ showHolders ? 'Sembunyikan' : 'Lihat' }} 10 holder teratas
        </button>
        <ol v-if="showHolders" class="mt-2 space-y-1 text-xs">
          <li v-for="(h, i) in security.top_holders" :key="h.address" class="flex items-center gap-2">
            <span class="num w-4 text-right text-muted">{{ i + 1 }}</span>
            <a
              v-if="chain && explorerUrl(chain, 'address', h.address)"
              :href="explorerUrl(chain, 'address', h.address)!"
              target="_blank"
              rel="noopener"
              class="num hover:text-brand"
              :title="h.address"
              >{{ shortAddress(h.address) }}</a
            >
            <span v-else class="num" :title="h.address">{{ shortAddress(h.address) }}</span>
            <span v-if="kind(h)" class="rounded bg-panel px-1 text-[10px] text-muted ring-1 ring-line">{{ kind(h) }}</span>
            <span class="num ml-auto font-medium">{{ percent(h.percent) }}%</span>
          </li>
        </ol>
        <p v-if="showHolders && chain === 'solana'" class="mt-1 text-[11px] text-muted">Di Solana, dompet bursa dan vault pool belum bisa dikenali, jadi bisa terlihat sebagai holder biasa.</p>
      </div>

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
