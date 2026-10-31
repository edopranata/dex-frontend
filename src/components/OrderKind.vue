<script setup lang="ts">
import { computed } from 'vue'

/**
 * "Beli Limit", "Jual ▲ Take Profit": exits stand out by color and arrow, so a take profit and a
 * stop loss can be told apart at a glance. "Jual" stays neutral there, or a red word would sit
 * next to a green take profit.
 */
const props = defineProps<{ side: string; type: string }>()

const labels: Record<string, string> = { market: 'Market', limit: 'Limit', stop_loss: 'Stop Loss', take_profit: 'Take Profit' }

const exit = computed(() => {
  if (props.type === 'take_profit') return { arrow: '▲', class: 'bg-up/15 text-up' }
  if (props.type === 'stop_loss') return { arrow: '▼', class: 'bg-down/15 text-down' }
  return null
})
</script>

<template>
  <span class="inline-flex items-center gap-1.5">
    <span :class="exit ? 'text-muted' : side === 'buy' ? 'text-up' : 'text-down'">{{ side === 'buy' ? 'Beli' : 'Jual' }}</span>
    <span v-if="exit" class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium" :class="exit.class">
      <span aria-hidden="true" class="text-[9px]">{{ exit.arrow }}</span>
      {{ labels[type] }}
    </span>
    <template v-else>{{ labels[type] }}</template>
  </span>
</template>
