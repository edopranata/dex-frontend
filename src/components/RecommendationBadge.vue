<script setup lang="ts">
import { computed } from 'vue'
import type { Recommendation } from '@/lib/types'

const props = defineProps<{ value: Recommendation | null | undefined; label?: string; size?: 'sm' | 'lg' }>()

const styles: Record<Recommendation, string> = {
  STRONG_BUY: 'bg-up/20 text-up ring-up/40',
  BUY: 'bg-up/10 text-up ring-up/30',
  HOLD: 'bg-warn/10 text-warn ring-warn/30',
  SELL: 'bg-down/10 text-down ring-down/30',
  STRONG_SELL: 'bg-down/20 text-down ring-down/40',
  AVOID: 'bg-fuchsia-500/15 text-fuchsia-300 ring-fuchsia-400/40',
}

const labels: Record<Recommendation, string> = {
  STRONG_BUY: 'Strong Buy',
  BUY: 'Buy',
  HOLD: 'Hold',
  SELL: 'Sell',
  STRONG_SELL: 'Strong Sell',
  AVOID: 'Hindari',
}

const classes = computed(() => (props.value ? styles[props.value] : 'bg-panel-2 text-muted ring-line'))
</script>

<template>
  <span
    class="inline-flex items-center rounded-md font-semibold whitespace-nowrap ring-1 ring-inset transition-colors duration-500"
    :class="[classes, size === 'lg' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs', value === 'STRONG_BUY' ? 'animate-glow' : '']"
  >
    {{ value ? (label ?? labels[value]) : 'Belum dianalisis' }}
  </span>
</template>
