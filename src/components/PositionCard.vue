<script setup lang="ts">
import { computed, ref } from 'vue'
import PriceFlash from '@/components/PriceFlash.vue'
import TokenAvatar from '@/components/TokenAvatar.vue'
import { changeClass, dateTime, pct, price, qty, usd } from '@/lib/format'
import { tokenPath } from '@/lib/links'
import type { PastTrade, PositionCardData } from '@/lib/types'

/**
 * One open position: where the price sits between the stop and the targets, refreshed with every poll,
 * and the earlier trades in the same token underneath.
 */
const props = defineProps<{ card: PositionCardData; linkLots?: boolean; canShowOrders?: boolean }>()
const emit = defineEmits<{ showOrders: [tokenId: number] }>()

const plan = computed(() => props.card.plan)
const current = computed(() => props.card.current_price)
const entry = computed(() => plan.value.entry)

type Kind = 'stop' | 'stop-original' | 'entry' | 'target' | 'target-filled'
interface Mark {
  key: string
  label: string
  value: number
  kind: Kind
}

const marks = computed<Mark[]>(() => {
  const list: Mark[] = []
  const p = plan.value
  if (p.stop_original !== null && p.stop !== null && Math.abs(p.stop_original - p.stop) > p.stop * 1e-9) {
    list.push({ key: 'sl0', label: 'SL awal', value: p.stop_original, kind: 'stop-original' })
  }
  if (p.stop !== null) list.push({ key: 'sl', label: p.stop_breakeven ? 'SL (BE)' : 'SL', value: p.stop, kind: 'stop' })
  list.push({ key: 'entry', label: 'Beli', value: p.entry, kind: 'entry' })
  p.targets.forEach((t, i) => list.push({ key: `tp${i}`, label: t.label, value: t.price, kind: t.filled ? 'target-filled' : 'target' }))
  return list
})

/** The scale covers every level and the price, with a little room at both ends. */
const range = computed(() => {
  const values = [...marks.value.map((m) => m.value), current.value].filter((v) => v > 0)
  let lo = Math.min(...values)
  let hi = Math.max(...values)
  // Without a stop or a target, show the price against the entry within at least ±5%.
  if (hi - lo < entry.value * 0.1) {
    lo = Math.min(lo, entry.value * 0.95)
    hi = Math.max(hi, entry.value * 1.05)
  }
  const pad = (hi - lo) * 0.04
  return { lo: lo - pad, hi: hi + pad }
})

function at(value: number): number {
  const { lo, hi } = range.value
  return Math.min(100, Math.max(0, ((value - lo) / (hi - lo)) * 100))
}

/** Labels that would overlap move to a second row. */
const placed = computed(() => {
  const lastLeft = [-100, -100]
  return [...marks.value]
    .sort((a, b) => a.value - b.value)
    .map((m) => {
      const left = at(m.value)
      const row = left - lastLeft[0] >= 9 ? 0 : left - lastLeft[1] >= 9 ? 1 : 0
      lastLeft[row] = left
      return { ...m, left, row }
    })
})

const stopValue = computed(() => plan.value.stop)
const lastTarget = computed(() => (plan.value.targets.length ? plan.value.targets[plan.value.targets.length - 1].price : null))

const markClass: Record<Kind, string> = {
  stop: 'bg-down',
  'stop-original': 'bg-down/40',
  entry: 'bg-brand',
  target: 'bg-up/60',
  'target-filled': 'bg-up',
}
const labelClass: Record<Kind, string> = {
  stop: 'text-down',
  'stop-original': 'text-down/60 line-through',
  entry: 'text-brand',
  target: 'text-up/80',
  'target-filled': 'text-up font-semibold',
}

const up = computed(() => current.value >= entry.value)
const nowLeft = computed(() => at(current.value))

function fromEntry(value: number | null | undefined): number | null {
  return value && entry.value > 0 ? (value / entry.value - 1) * 100 : null
}

/** Rows under the bar: every level with its distance from the entry and, for targets, when it filled. */
const rows = computed(() => {
  const p = plan.value
  const list: { label: string; value: number; tone: string; note: string | null }[] = []
  if (p.stop !== null) {
    list.push({ label: p.stop_breakeven ? 'Stop loss (dipindah ke entry)' : 'Stop loss', value: p.stop, tone: 'text-down', note: p.stop_original !== null && p.stop_breakeven ? `awal ${price(p.stop_original)}` : null })
  }
  list.push({ label: 'Harga beli rata-rata', value: p.entry, tone: 'text-brand', note: p.opened_at ? dateTime(p.opened_at) : null })
  for (const t of p.targets) {
    list.push({ label: t.label, value: t.price, tone: t.filled ? 'text-up' : 'text-muted', note: t.filled ? `terisi ${price(t.filled_price)} · ${dateTime(t.filled_at)}` : 'menunggu' })
  }
  return list
})

const heldFor = computed(() => duration(plan.value.opened_at, null))

function duration(from: string | null, to: string | null): string | null {
  if (!from) return null
  const minutes = Math.max(0, Math.round(((to ? Date.parse(to) : Date.now()) - Date.parse(from)) / 60000))
  if (minutes < 60) return `${minutes} mnt`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return `${hours} j ${minutes % 60} mnt`
  return `${Math.floor(hours / 24)} hari ${hours % 24} j`
}

const showAll = ref(false)
const history = computed(() => (showAll.value ? props.card.history : props.card.history.slice(0, 3)))

function chartLink(trade: { lot_id: number | null }): string {
  const path = tokenPath(props.card.token)
  return props.linkLots && trade.lot_id ? `${path}?lot=${trade.lot_id}` : path
}

function exitTone(exit: PastTrade['exits'][number]): string {
  if (exit.type === 'stop_loss') return (exit.pnl ?? 0) >= 0 ? 'bg-muted/15 text-muted' : 'bg-down/15 text-down'
  return (exit.pnl ?? 0) >= 0 ? 'bg-up/15 text-up' : 'bg-down/15 text-down'
}

function shortTime(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '–'
}
</script>

<template>
  <article class="card flex flex-col">
    <header class="flex flex-wrap items-start gap-3 p-4 pb-3">
      <RouterLink :to="chartLink(plan)" class="flex min-w-0 items-center gap-2.5 hover:text-brand">
        <TokenAvatar :src="card.token.image_url" :symbol="card.token.symbol" :size="32" />
        <span class="min-w-0">
          <span class="block font-semibold">{{ card.token.symbol }}</span>
          <span class="block text-xs text-muted">
            {{ card.token.chain_label }}
            <template v-if="plan.signal_id"> · Sinyal #{{ plan.signal_id }}</template>
            <template v-if="heldFor"> · dipegang {{ heldFor }}</template>
          </span>
        </span>
      </RouterLink>
      <div class="ml-auto text-right">
        <div class="num font-semibold">{{ usd(card.value_usd) }}</div>
        <div class="num text-xs" :class="changeClass(card.unrealized_pnl)">{{ usd(card.unrealized_pnl) }} ({{ pct(card.unrealized_pnl_pct) }})</div>
      </div>
    </header>

    <div class="px-4">
      <div class="relative h-9" aria-hidden="true">
        <span
          v-for="m in placed"
          :key="m.key"
          class="absolute -translate-x-1/2 text-[11px] leading-none whitespace-nowrap"
          :class="[labelClass[m.kind], m.row === 0 ? 'bottom-0' : 'bottom-4']"
          :style="{ left: `${m.left}%` }"
        >
          {{ m.label }}
        </span>
      </div>

      <div class="relative my-1.5 h-2 rounded-full bg-panel-2" role="img" :aria-label="`Harga ${price(current)}, beli ${price(entry)}${stopValue !== null ? `, stop ${price(stopValue)}` : ''}${lastTarget !== null ? `, target terakhir ${price(lastTarget)}` : ''}`">
        <!-- Risk zone: stop to entry. Reward zone: entry to the last target. -->
        <div v-if="stopValue !== null" class="absolute inset-y-0 rounded-l-full bg-down/15" :style="{ left: `${at(stopValue)}%`, width: `${Math.max(0, at(entry) - at(stopValue))}%` }" />
        <div v-if="lastTarget !== null" class="absolute inset-y-0 rounded-r-full bg-up/15" :style="{ left: `${at(entry)}%`, width: `${Math.max(0, at(lastTarget) - at(entry))}%` }" />
        <!-- How far the price has moved from the entry. -->
        <div
          class="absolute inset-y-0 transition-all duration-700 ease-out"
          :class="up ? 'bg-up/70' : 'bg-down/70'"
          :style="{ left: `${Math.min(at(entry), nowLeft)}%`, width: `${Math.abs(nowLeft - at(entry))}%` }"
        />
        <span v-for="m in placed" :key="m.key" class="absolute -top-1 h-4 w-0.5 -translate-x-1/2 rounded-full" :class="markClass[m.kind]" :style="{ left: `${m.left}%` }" />
        <span
          class="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-panel shadow transition-all duration-700 ease-out"
          :class="up ? 'bg-up' : 'bg-down'"
          :style="{ left: `${nowLeft}%` }"
        />
      </div>

      <div class="relative h-6">
        <span
          class="absolute top-1 text-xs whitespace-nowrap transition-all duration-700 ease-out"
          :class="nowLeft > 80 ? '-translate-x-full' : nowLeft > 20 ? '-translate-x-1/2' : ''"
          :style="{ left: `${nowLeft}%` }"
        >
          <span class="text-muted">Sekarang </span>
          <PriceFlash :value="current"><span class="num font-medium">{{ price(current) }}</span></PriceFlash>
          <span class="num ml-1" :class="changeClass(fromEntry(current))">{{ pct(fromEntry(current)) }}</span>
        </span>
      </div>
    </div>

    <dl class="mx-4 mt-2 divide-y divide-line/60 rounded-lg border border-line/70 text-xs">
      <div v-for="r in rows" :key="r.label" class="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-3 py-1.5">
        <dt :class="r.tone">{{ r.label }}</dt>
        <dd class="num ml-auto">{{ price(r.value) }}</dd>
        <dd class="num w-16 text-right" :class="r.label.startsWith('Harga beli') ? 'text-muted' : changeClass(fromEntry(r.value))">
          {{ r.label.startsWith('Harga beli') ? qty(card.quantity) : pct(fromEntry(r.value), 1) }}
        </dd>
        <dd v-if="r.note" class="basis-full text-[11px] text-muted">{{ r.note }}</dd>
      </div>
    </dl>
    <p v-if="!plan.stop && !plan.targets.length" class="mx-4 mt-2 text-xs text-muted">Posisi ini tidak punya stop loss atau take profit yang menunggu.</p>

    <section class="mt-4 border-t border-line px-4 py-3">
      <div class="mb-2 flex items-center gap-2">
        <h3 class="text-xs font-medium text-muted">Riwayat {{ card.token.symbol }}</h3>
        <span class="badge-mini bg-panel-2 text-muted">{{ card.history_total }}</span>
        <button v-if="canShowOrders && card.history_total" type="button" class="ml-auto text-xs text-brand hover:underline" @click="emit('showOrders', card.token_id)">Semua order →</button>
      </div>

      <p v-if="!card.history.length" class="text-xs text-muted">Belum pernah dibeli sebelumnya.</p>
      <ol v-else class="space-y-2">
        <li v-for="t in history" :key="t.id" class="rounded-lg bg-panel-2/40 px-3 py-2 text-xs">
          <div class="flex flex-wrap items-baseline gap-x-2">
            <RouterLink :to="chartLink(t)" class="font-medium hover:text-brand" :title="linkLots && t.lot_id ? 'Buka lot ini di grafik' : 'Buka grafik token'">
              Beli {{ shortTime(t.opened_at) }}
            </RouterLink>
            <span class="text-muted">di <span class="num">{{ price(t.entry) }}</span> · {{ usd(t.invested_usd) }}<template v-if="t.buys > 1"> ({{ t.buys }}× beli)</template></span>
            <span class="num ml-auto font-medium" :class="changeClass(t.pnl)">{{ usd(t.pnl) }} <span class="font-normal">({{ pct(t.pnl_pct, 1) }})</span></span>
          </div>
          <div class="mt-1.5 flex flex-wrap gap-1.5">
            <span v-for="(e, i) in t.exits" :key="i" class="badge-mini" :class="exitTone(e)" :title="dateTime(e.at)">
              {{ e.label }} <span class="num">{{ price(e.price) }}</span> · {{ shortTime(e.at) }}
            </span>
          </div>
          <div v-if="t.closed_at" class="mt-1 text-[11px] text-muted">Selesai {{ shortTime(t.closed_at) }} · {{ duration(t.opened_at, t.closed_at) }}</div>
        </li>
      </ol>
      <button v-if="card.history.length > 3" type="button" class="mt-2 text-xs text-muted hover:text-text" @click="showAll = !showAll">
        {{ showAll ? 'Tampilkan lebih sedikit' : `Tampilkan ${card.history.length - 3} lagi` }}
      </button>
    </section>
  </article>
</template>
