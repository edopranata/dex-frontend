<script setup lang="ts">
import { useProgressStore } from '@/stores/progress'

/** Thin loading bar along the top edge (page changes and the refresh button). */
const progress = useProgressStore()
</script>

<template>
  <div class="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5" role="progressbar" aria-label="Memuat halaman" :aria-hidden="!progress.visible" :aria-valuenow="Math.round(progress.value)">
    <div
      class="h-full bg-brand shadow-[0_0_8px_var(--color-brand)] transition-[width,opacity] duration-200 ease-out"
      :style="{ width: `${progress.value}%`, opacity: progress.visible ? 1 : 0 }"
    />
  </div>
</template>
