<script setup lang="ts">
import { computed } from 'vue'

/** Tiny line of daily average scores (0–100) with the 7-day change. */
const props = defineProps<{ points: { day: string; score: number }[]; declining?: boolean; change?: number | null }>()

const WIDTH = 72
const HEIGHT = 22

const path = computed(() => {
  const scores = props.points.map((p) => p.score)
  if (scores.length < 2) return ''
  const min = Math.min(...scores) - 2
  const max = Math.max(...scores) + 2
  return scores
    .map((s, i) => {
      const x = (i / (scores.length - 1)) * WIDTH
      const y = HEIGHT - ((s - min) / (max - min || 1)) * HEIGHT
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
})

const color = computed(() => {
  if (props.declining) return 'var(--color-down)'
  if ((props.change ?? 0) > 0) return 'var(--color-up)'
  return 'var(--color-muted)'
})
</script>

<template>
  <div class="flex items-center justify-end gap-2" :title="points.map((p) => `${p.day}: ${p.score}`).join('\n')">
    <svg v-if="path" :width="WIDTH" :height="HEIGHT" :viewBox="`-1 -1 ${WIDTH + 2} ${HEIGHT + 2}`" class="overflow-visible">
      <path :d="path" fill="none" :style="{ stroke: color }" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" class="sparkline" />
    </svg>
    <span v-else class="text-[11px] text-muted">{{ points.length ? '1 hari' : '–' }}</span>
    <span v-if="change !== null && change !== undefined" class="num w-9 text-right text-[11px]" :style="{ color }">
      {{ change > 0 ? '+' : '' }}{{ Math.round(change) }}
    </span>
  </div>
</template>

<style scoped>
.sparkline {
  stroke-dasharray: 200;
  stroke-dashoffset: 200;
  animation: draw 0.9s ease-out forwards;
}

@keyframes draw {
  to {
    stroke-dashoffset: 0;
  }
}
</style>
