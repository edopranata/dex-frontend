<script setup lang="ts">
import { useToastStore } from '@/stores/toast'

const toast = useToastStore()
</script>

<template>
  <div class="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2">
    <TransitionGroup name="toast">
      <div
        v-for="t in toast.toasts"
        :key="t.id"
        class="pointer-events-auto flex gap-3 rounded-xl border bg-panel/95 p-3 shadow-xl shadow-black/40 backdrop-blur"
        :class="{ 'border-up/40': t.tone === 'success', 'border-down/40': t.tone === 'error', 'border-brand/40': t.tone === 'info' }"
        role="status"
      >
        <span
          class="mt-1 h-2 w-2 shrink-0 rounded-full"
          :class="{ 'bg-up': t.tone === 'success', 'bg-down': t.tone === 'error', 'bg-brand': t.tone === 'info' }"
        />
        <div class="min-w-0 flex-1">
          <div class="text-sm font-medium">{{ t.title }}</div>
          <div v-if="t.body" class="mt-0.5 text-xs text-muted">{{ t.body }}</div>
        </div>
        <button class="text-muted transition hover:text-text" aria-label="Tutup" @click="toast.dismiss(t.id)">✕</button>
      </div>
    </TransitionGroup>
  </div>
</template>
