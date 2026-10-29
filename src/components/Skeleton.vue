<script setup lang="ts">
defineProps<{ rows?: number; height?: string }>()
</script>

<template>
  <div class="space-y-2" aria-busy="true" aria-label="Memuat">
    <div v-for="i in rows ?? 3" :key="i" class="skeleton" :class="height ?? 'h-10'" :style="{ opacity: 1 - (i - 1) * 0.12 }" />
  </div>
</template>
