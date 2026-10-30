<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useSyncStore } from '@/stores/sync'

/** "Live · 5 dtk lalu" in the toolbar: how fresh the data on screen is. */
const sync = useSyncStore()
const now = ref(Date.now())
const timer = setInterval(() => (now.value = Date.now()), 1000)
onBeforeUnmount(() => clearInterval(timer))

/** Prices poll every 15 seconds; well past that the data is stale. */
const STALE_MS = 2 * 60 * 1000

const age = computed(() => (sync.lastSyncAt ? Math.max(0, now.value - sync.lastSyncAt) : null))
const state = computed<'live' | 'stale' | 'offline'>(() => {
  if (!sync.online || sync.connectionLost) return 'offline'
  return age.value !== null && age.value < STALE_MS ? 'live' : 'stale'
})

const label = computed(() => {
  if (state.value === 'offline') return 'Offline'
  if (age.value === null) return 'Menghubungkan…'
  const seconds = Math.round(age.value / 1000)
  return seconds < 60 ? `${seconds} dtk lalu` : `${Math.round(seconds / 60)} mnt lalu`
})

const dotClass = { live: 'bg-up', stale: 'bg-warn', offline: 'bg-down' }
</script>

<template>
  <div
    class="flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs whitespace-nowrap text-muted"
    :title="state === 'offline' ? 'Tidak terhubung ke server; data di layar mungkin sudah lama.' : 'Waktu data terakhir diterima dari server'"
  >
    <span class="relative flex h-2 w-2">
      <span v-if="state === 'live'" class="absolute inline-flex h-full w-full animate-ping rounded-full bg-up opacity-60" />
      <span class="relative inline-flex h-2 w-2 rounded-full" :class="dotClass[state]" />
    </span>
    <span class="hidden font-medium sm:inline" :class="{ 'text-up': state === 'live', 'text-warn': state === 'stale', 'text-down': state === 'offline' }">
      {{ state === 'live' ? 'Live' : state === 'stale' ? 'Tertunda' : 'Offline' }}
    </span>
    <span class="num hidden md:inline">{{ state === 'offline' ? '' : label }}</span>
  </div>
</template>
