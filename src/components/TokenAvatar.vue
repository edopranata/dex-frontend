<script setup lang="ts">
import { ref } from 'vue'

defineProps<{ src?: string | null; symbol: string; size?: number }>()
const failed = ref(false)
</script>

<template>
  <img
    v-if="src && !failed"
    :src="src"
    :alt="symbol"
    class="shrink-0 rounded-full bg-panel-2 object-cover"
    :style="{ width: `${size ?? 28}px`, height: `${size ?? 28}px` }"
    loading="lazy"
    @error="failed = true"
  />
  <span
    v-else
    class="inline-flex shrink-0 items-center justify-center rounded-full bg-panel-2 text-[10px] font-bold text-muted"
    :style="{ width: `${size ?? 28}px`, height: `${size ?? 28}px` }"
  >
    {{ symbol.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase() }}
  </span>
</template>
