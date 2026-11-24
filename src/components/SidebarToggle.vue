<script setup lang="ts">
import { type SidebarMode, useSidebar } from '@/composables/useSidebar'

const { mode } = useSidebar()

const OPTIONS: { value: SidebarMode; label: string; icon: string }[] = [
  { value: 'full', label: 'Sidebar penuh', icon: 'M4 5h16v14H4zM10 5v14M6 9h2M6 12h2M6 15h2' },
  { value: 'mini', label: 'Sidebar mini (ikon saja)', icon: 'M4 5h16v14H4zM8 5v14M6 9h0M6 12h0M6 15h0' },
  { value: 'hide', label: 'Sembunyikan sidebar', icon: 'M4 5h16v14H4zM8 5v14M14 10l-2 2 2 2' },
]
</script>

<template>
  <div class="hidden shrink-0 items-center rounded-lg border border-line bg-panel p-0.5 lg:flex" role="group" aria-label="Tampilan sidebar">
    <button
      v-for="option in OPTIONS"
      :key="option.value"
      type="button"
      class="grid h-7 w-7 place-items-center rounded-md transition-colors"
      :class="mode === option.value ? 'bg-brand/15 text-brand' : 'text-muted hover:text-text'"
      :title="option.label"
      :aria-label="option.label"
      :aria-pressed="mode === option.value"
      @click="mode = option.value"
    >
      <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="option.icon" /></svg>
    </button>
  </div>
</template>
