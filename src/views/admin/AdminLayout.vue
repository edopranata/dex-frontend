<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()
</script>

<template>
  <div class="stack-section">
    <div>
      <h1 class="text-xl font-semibold">{{ route.meta.title ?? 'Admin' }}</h1>
      <p v-if="route.meta.description" class="mt-1 text-sm text-muted">{{ route.meta.description }}</p>
    </div>

    <RouterView v-slot="{ Component }">
      <Transition name="page" mode="out-in">
        <component :is="Component" :key="route.path" />
      </Transition>
    </RouterView>
  </div>
</template>
