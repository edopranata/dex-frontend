<script setup lang="ts">
import PwaUpdate from '@/components/PwaUpdate.vue'
import TopProgress from '@/components/TopProgress.vue'
</script>

<template>
  <TopProgress />
  <RouterView />
  <PwaUpdate />
</template>
