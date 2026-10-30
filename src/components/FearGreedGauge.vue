<script setup lang="ts">
import { computed, toRef } from 'vue'
import { useTween } from '@/composables/useTween'

const props = defineProps<{ value: number; classification: string }>()

const animated = useTween(toRef(props, 'value'), 1200, { fromZero: true })

const color = computed(() => {
  if (props.value <= 25) return '#ef4444'
  if (props.value <= 45) return '#f97316'
  if (props.value <= 55) return '#f59e0b'
  if (props.value <= 75) return '#84cc16'
  return '#22c55e'
})

// Semicircle arc length for r=40 is π·40 ≈ 125.66.
const dash = computed(() => `${((animated.value ?? 0) / 100) * 125.66} 125.66`)
</script>

<template>
  <div class="flex flex-col items-center">
    <svg viewBox="0 0 100 56" class="w-40">
      <path d="M10 50 A40 40 0 0 1 90 50" fill="none" style="stroke: var(--color-line)" stroke-width="9" stroke-linecap="round" />
      <path d="M10 50 A40 40 0 0 1 90 50" fill="none" :stroke="color" stroke-width="9" stroke-linecap="round" :stroke-dasharray="dash" />
      <text x="50" y="47" text-anchor="middle" class="num" style="fill: var(--color-text)" font-size="18" font-weight="600">{{ Math.round(animated ?? 0) }}</text>
    </svg>
    <div class="text-sm font-medium" :style="{ color }">{{ classification }}</div>
  </div>
</template>
