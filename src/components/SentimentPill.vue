<script setup lang="ts">
defineProps<{ label: 'bullish' | 'neutral' | 'bearish' | null; score: number | null }>()
</script>

<template>
  <span
    class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium"
    :class="{
      'bg-up/10 text-up': label === 'bullish',
      'bg-down/10 text-down': label === 'bearish',
      'bg-panel-2 text-muted': label === 'neutral' || !label,
    }"
  >
    {{ label ?? 'belum dinilai' }}<span v-if="score !== null" class="num">{{ score }}</span>
  </span>
</template>
