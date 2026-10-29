<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

const props = defineProps<{ label: string; score: number; weight?: number }>()

// Grow from zero on first render so the bars animate in.
const mounted = ref(false)
onMounted(() => requestAnimationFrame(() => (mounted.value = true)))

const color = computed(() => {
  if (props.score >= 60) return 'bg-up'
  if (props.score >= 42) return 'bg-warn'
  return 'bg-down'
})
</script>

<template>
  <div>
    <div class="mb-1 flex items-baseline justify-between text-xs">
      <span class="text-muted">
        {{ label }}
        <span v-if="weight" class="text-muted/60">· bobot {{ Math.round(weight * 100) }}%</span>
      </span>
      <span class="num font-semibold">{{ score }}</span>
    </div>
    <div class="h-1.5 overflow-hidden rounded-full bg-panel-2">
      <div class="h-full rounded-full transition-[width,background-color] duration-700 ease-out" :class="color" :style="{ width: mounted ? `${score}%` : '0%' }" />
    </div>
  </div>
</template>
