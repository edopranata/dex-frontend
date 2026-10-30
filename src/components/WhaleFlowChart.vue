<script setup lang="ts">
import { computed, ref } from 'vue'
import { usd } from '@/lib/format'
import { tokenPath } from '@/lib/links'

/**
 * Whale buy/sell pressure per token: one 100% bar per row (buy share from the left, sell share
 * from the right, 50% marked), so a $20K token reads as clearly as a $200M one. Net flow,
 * volume and trade count stay as numbers; rows with few trades are faded as a small sample.
 */
export interface WhaleFlowSummary {
  token_id: number
  symbol: string | null
  slug: string | null
  chain: string | null
  buy_usd: string
  sell_usd: string
  trades: number
}

const props = defineProps<{ summary: WhaleFlowSummary[] }>()

type Sort = 'net' | 'volume' | 'share'

const SMALL_SAMPLE = 5
const LIMIT = 12

const sort = ref<Sort>('net')
const minTrades = ref(1)
const showAll = ref(false)

const sorts: { value: Sort; label: string }[] = [
  { value: 'net', label: 'Net' },
  { value: 'volume', label: 'Volume' },
  { value: 'share', label: '% beli' },
]
const minTradeOptions = [1, 5, 20]

const flows = computed(() => {
  const rows = props.summary
    .map((s) => {
      const buy = Number(s.buy_usd)
      const sell = Number(s.sell_usd)
      const volume = buy + sell
      return {
        id: s.token_id,
        symbol: s.symbol ?? `#${s.token_id}`,
        chain: s.chain,
        link: tokenPath({ id: s.token_id, slug: s.slug }),
        buy,
        sell,
        volume,
        net: buy - sell,
        share: volume > 0 ? (buy / volume) * 100 : 50,
        trades: Number(s.trades),
      }
    })
    .filter((f) => f.trades >= minTrades.value)

  const key: Record<Sort, (f: (typeof rows)[number]) => number> = { net: (f) => f.net, volume: (f) => f.volume, share: (f) => f.share }
  return rows.sort((a, b) => key[sort.value](b) - key[sort.value](a))
})

const visible = computed(() => (showAll.value ? flows.value : flows.value.slice(0, LIMIT)))

/** $119,171.50 → $119.2K: rows compare orders of magnitude, the cents are noise. */
function money(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: Math.abs(value) >= 10_000 ? 'compact' : 'standard', maximumFractionDigits: Math.abs(value) >= 10_000 ? 1 : 0 }).format(value)
}

function signed(value: number): string {
  return `${value > 0 ? '+' : ''}${money(value)}`
}
</script>

<template>
  <section class="card p-4">
    <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
      <h2 class="card-title mr-auto">Tekanan beli/jual whale per token</h2>
      <div class="flex items-center gap-3 text-xs text-muted" aria-hidden="true">
        <span class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-sm bg-up" /> Beli</span>
        <span class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-sm bg-down" /> Jual</span>
        <span class="flex items-center gap-1.5"><span class="h-3 w-px bg-text/60" /> 50%</span>
      </div>
      <div class="inline-flex rounded-lg border border-line bg-panel-2/60 p-0.5 text-xs" role="group" aria-label="Urutkan">
        <button
          v-for="s in sorts"
          :key="s.value"
          type="button"
          class="rounded-md px-2.5 py-1 transition-colors duration-150"
          :class="sort === s.value ? 'bg-brand/20 font-medium text-text' : 'text-muted hover:text-text'"
          :aria-pressed="sort === s.value"
          @click="sort = s.value"
        >
          {{ s.label }}
        </button>
      </div>
      <div class="inline-flex rounded-lg border border-line bg-panel-2/60 p-0.5 text-xs" role="group" aria-label="Minimal transaksi">
        <button
          v-for="n in minTradeOptions"
          :key="n"
          type="button"
          class="rounded-md px-2.5 py-1 transition-colors duration-150"
          :class="minTrades === n ? 'bg-brand/20 font-medium text-text' : 'text-muted hover:text-text'"
          :aria-pressed="minTrades === n"
          @click="minTrades = n"
        >
          {{ n === 1 ? 'Semua' : `≥${n} trx` }}
        </button>
      </div>
    </div>

    <div class="mt-3 hidden grid-cols-[6rem_minmax(0,1fr)_3rem_6.5rem_6rem_3.5rem] gap-3 border-b border-line pb-1.5 text-[11px] text-muted md:grid">
      <span>Token</span>
      <span>Porsi beli ◀ ▶ jual</span>
      <span class="text-right">Beli</span>
      <span class="text-right">Net</span>
      <span class="text-right">Volume</span>
      <span class="text-right">Trx</span>
    </div>

    <ul v-if="visible.length" class="divide-y divide-line/50">
      <li
        v-for="f in visible"
        :key="f.id"
        class="group relative grid grid-cols-[4.5rem_minmax(0,1fr)_2.75rem] items-center gap-x-3 gap-y-1 py-2 text-sm md:grid-cols-[6rem_minmax(0,1fr)_3rem_6.5rem_6rem_3.5rem]"
        :class="{ 'opacity-50 hover:opacity-100': f.trades < SMALL_SAMPLE }"
      >
        <RouterLink :to="f.link" class="flex min-w-0 items-baseline gap-1 hover:text-brand" :title="f.chain ? `${f.symbol} (${f.chain})` : f.symbol">
          <span class="truncate font-medium">{{ f.symbol }}</span>
          <span v-if="f.chain" class="shrink-0 text-[10px] text-muted">{{ f.chain }}</span>
        </RouterLink>

        <div
          class="relative flex h-2.5 gap-0.5"
          role="img"
          :aria-label="`${f.symbol}: beli ${money(f.buy)} (${f.share.toFixed(0)}%), jual ${money(f.sell)}, net ${signed(f.net)}, ${f.trades} transaksi`"
        >
          <div v-if="f.buy > 0" class="h-full rounded-l-[4px] bg-up/85 transition-[width] duration-500" :class="{ 'rounded-r-[4px]': f.sell === 0 }" :style="{ width: `${f.share}%` }" />
          <div v-if="f.sell > 0" class="h-full flex-1 rounded-r-[4px] bg-down/85" :class="{ 'rounded-l-[4px]': f.buy === 0 }" />
          <div class="pointer-events-none absolute -inset-y-1 left-1/2 w-px bg-text/60" />

          <div
            class="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden w-max -translate-x-1/2 rounded-lg border border-line bg-panel-2 px-3 py-2 text-xs shadow-xl shadow-black/40 group-hover:block"
          >
            <div class="mb-1 font-medium">{{ f.symbol }} <span v-if="f.chain" class="text-muted">· {{ f.chain }}</span></div>
            <div class="num grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5">
              <span class="flex items-center gap-1.5 text-muted"><span class="h-2 w-2 rounded-sm bg-up" /> Beli</span><span class="text-right">{{ usd(f.buy, true) }} · {{ f.share.toFixed(0) }}%</span>
              <span class="flex items-center gap-1.5 text-muted"><span class="h-2 w-2 rounded-sm bg-down" /> Jual</span><span class="text-right">{{ usd(f.sell, true) }} · {{ (100 - f.share).toFixed(0) }}%</span>
              <span class="text-muted">Net</span><span class="text-right">{{ signed(f.net) }}</span>
              <span class="text-muted">Transaksi</span><span class="text-right">{{ f.trades }}</span>
            </div>
            <div v-if="f.trades < SMALL_SAMPLE" class="mt-1 text-[11px] text-warn">Sampel kecil: kurang dari {{ SMALL_SAMPLE }} transaksi</div>
          </div>
        </div>

        <span class="num text-right text-xs">{{ f.share.toFixed(0) }}%</span>

        <div class="num col-span-3 flex justify-end gap-3 text-xs text-muted md:contents">
          <span class="text-right md:text-sm" :class="f.net > 0 ? 'text-up' : f.net < 0 ? 'text-down' : 'text-muted'">{{ signed(f.net) }}</span>
          <span class="text-right">{{ money(f.volume) }}<span class="md:hidden"> vol</span></span>
          <span class="text-right">{{ f.trades }}<span class="md:hidden"> trx</span></span>
        </div>
      </li>
    </ul>
    <p v-else class="py-6 text-center text-sm text-muted">Tidak ada token dengan minimal {{ minTrades }} transaksi.</p>

    <div class="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
      <span>Pudar = kurang dari {{ SMALL_SAMPLE }} transaksi (sinyal lemah).</span>
      <button v-if="flows.length > LIMIT" type="button" class="text-brand hover:underline" @click="showAll = !showAll">
        {{ showAll ? 'Tampilkan lebih sedikit' : `Tampilkan semua (${flows.length})` }}
      </button>
    </div>
  </section>
</template>
