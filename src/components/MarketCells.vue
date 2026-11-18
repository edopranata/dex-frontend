<script setup lang="ts">
import { dateTime } from '@/lib/format'

/** BTC price, BTC 4h trend and Fear & Greed when a trade entered, from the analysis snapshot nearest before it. */
export interface MarketAt {
  at: string | null
  btc_price: number | null
  btc_trend: string | null
  fear_greed: number | null
  fear_greed_label: string | null
}

defineProps<{ market: MarketAt }>()

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
  <td class="num whitespace-nowrap text-right" :title="market.at ? `Dari analisa ${dateTime(market.at)}` : undefined">{{ btc(market.btc_price) }}</td>
  <td class="whitespace-nowrap" :class="trend[market.btc_trend ?? '']?.class ?? 'text-muted'">{{ trend[market.btc_trend ?? '']?.label ?? '–' }}</td>
  <td class="num whitespace-nowrap text-right" :title="market.fear_greed_label ?? undefined">{{ market.fear_greed ?? '–' }}</td>
</template>
