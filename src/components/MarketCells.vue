<script setup lang="ts">
import { computed } from 'vue'
import { dateTime } from '@/lib/format'

/** BTC price, BTC 4h trend and Fear & Greed when a trade entered, from the analysis snapshot nearest before it. */
export interface MarketAt {
  at: string | null
  btc_price: number | null
  btc_trend: string | null
  /** BTC rebuilt from stored candles: snapshots before 15 Nov 2026 did not keep BTC. */
  btc_derived?: boolean
  fear_greed: number | null
  fear_greed_label: string | null
}

const props = defineProps<{ market: MarketAt }>()

const derived = 'Dihitung ulang dari candle BTC tersimpan; snapshot analisa saat itu belum menyimpan BTC'
const source = computed(() => (props.market.btc_derived ? derived : props.market.at ? `Dari analisa ${dateTime(props.market.at)}` : undefined))

const trend: Record<string, { label: string; class: string }> = {
  bullish: { label: 'Naik', class: 'text-up' },
  bearish: { label: 'Turun', class: 'text-down' },
  sideways: { label: 'Datar', class: 'text-muted' },
}

function btc(value: number | null): string {
  return value === null ? '–' : '$' + Math.round(value).toLocaleString('en-US')
}
</script>

<template>
  <td class="num whitespace-nowrap text-right" :title="source">{{ market.btc_derived && market.btc_price !== null ? '≈' : '' }}{{ btc(market.btc_price) }}</td>
  <td class="whitespace-nowrap" :class="trend[market.btc_trend ?? '']?.class ?? 'text-muted'" :title="source">
    {{ trend[market.btc_trend ?? '']?.label ?? '–' }}<span v-if="market.btc_derived && market.btc_trend" class="text-muted">*</span>
  </td>
  <td class="num whitespace-nowrap text-right" :title="market.fear_greed_label ?? undefined">{{ market.fear_greed ?? '–' }}</td>
</template>
