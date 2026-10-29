<script setup lang="ts">
defineProps<{ title: string; description?: string }>()
</script>

<template>
  <div class="px-4 py-10 text-center">
    <div class="text-sm font-medium">{{ title }}</div>
    <p v-if="description" class="mx-auto mt-1 max-w-md text-xs text-muted">{{ description }}</p>
    <div class="mt-3"><slot /></div>
  </div>
</template>
