<script setup lang="ts">
import { usePwaStore } from '@/stores/pwa'

/** Bottom banner when a newer version of the app was deployed. */
const pwa = usePwaStore()
</script>

<template>
  <Transition name="toast">
    <div
      v-if="pwa.needRefresh"
      class="fixed inset-x-4 bottom-4 z-[70] flex items-center gap-3 rounded-xl border border-brand/40 bg-panel p-3 shadow-2xl shadow-black/40 sm:left-auto sm:w-96"
      role="status"
    >
      <span class="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand/15 text-brand">
        <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5" stroke-linecap="round" stroke-linejoin="round" /></svg>
      </span>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium">Versi baru tersedia</p>
        <p class="text-xs text-muted">Muat ulang untuk memakai pembaruan terbaru.</p>
      </div>
      <button class="btn-ghost px-2.5 py-1.5 text-xs" @click="pwa.needRefresh = false">Nanti</button>
      <button class="btn-primary px-2.5 py-1.5 text-xs" :disabled="pwa.updating" @click="pwa.update()">{{ pwa.updating ? 'Memuat…' : 'Muat ulang' }}</button>
    </div>
  </Transition>
</template>
