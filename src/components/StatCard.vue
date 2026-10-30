<script setup lang="ts">
import AnimatedNumber from './AnimatedNumber.vue'

defineProps<{
  label: string
  value?: string
  amount?: number | null
  format?: (value: number | null) => string
  hint?: string
  tone?: 'up' | 'down' | 'muted'
  /** First load: placeholders instead of "–" or $0.00. */
  loading?: boolean
}>()
</script>

<template>
  <div class="card card-hover animate-fade-up p-4">
    <div class="card-title">{{ label }}</div>
    <template v-if="loading">
      <div class="skeleton mt-2.5 h-6 w-28" />
      <div v-if="hint !== undefined" class="skeleton mt-2 h-3 w-20" />
    </template>
    <template v-else>
      <div class="num mt-2 text-xl font-semibold transition-colors duration-500" :class="{ 'text-up': tone === 'up', 'text-down': tone === 'down' }">
        <AnimatedNumber v-if="format" :value="amount" :format="format" />
        <template v-else>{{ value }}</template>
      </div>
      <div v-if="hint" class="mt-1 text-xs text-muted">{{ hint }}</div>
    </template>
  </div>
</template>
