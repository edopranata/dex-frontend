<script setup lang="ts">
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import PwaUpdate from '@/components/PwaUpdate.vue'
import TopProgress from '@/components/TopProgress.vue'
</script>

<template>
  <TopProgress />
  <RouterView />
  <PwaUpdate />
  <ConfirmDialog />
</template>
