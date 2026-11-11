<script setup lang="ts">
/**
 * Links to the four simulators, each with its own favicon mark. The same file lives in every app's
 * frontend; only `current` differs. Each app still has its own login until the central account.
 */
type AppKey = 'us' | 'idx' | 'dex' | 'fx'

defineProps<{ current: AppKey }>()

const APPS: { key: AppKey; name: string; short: string; url: string; color: string }[] = [
  { key: 'us', name: 'US Stock Analyzer', short: 'US', url: 'https://ussim.tune-in.trade', color: '#0ea5e9' },
  { key: 'idx', name: 'IDX Stock Analyzer', short: 'IDX', url: 'https://stocksim.tune-in.trade', color: '#8b5cf6' },
  { key: 'dex', name: 'DEX Simulator', short: 'DEX', url: 'https://dexsim.tune-in.trade', color: '#22c55e' },
  { key: 'fx', name: 'Forex Simulator', short: 'FX', url: 'https://fxsim.tune-in.trade', color: '#14b8a6' },
]

/** Keeps the end tooltips inside the sidebar instead of centring them past its edge. */
function tooltipPlace(index: number): string {
  if (index === 0) return 'left-0'
  if (index === APPS.length - 1) return 'right-0'
  return 'left-1/2 -translate-x-1/2'
}
</script>

<template>
  <nav class="flex shrink-0 items-center justify-between gap-1 border-t border-line px-4 py-2" aria-label="Simulator lain">
    <component
      :is="app.key === current ? 'span' : 'a'"
      v-for="(app, index) in APPS"
      :key="app.key"
      :href="app.key === current ? undefined : app.url"
      :aria-label="app.name"
      :aria-current="app.key === current ? 'page' : undefined"
      :tabindex="app.key === current ? 0 : undefined"
      class="group relative flex w-12 flex-col items-center gap-1 rounded-lg py-1 outline-none transition focus-visible:ring-2 focus-visible:ring-brand"
      :class="app.key === current ? 'bg-panel-2' : 'opacity-70 hover:bg-panel-2/60 hover:opacity-100 focus-visible:opacity-100'"
    >
      <svg viewBox="0 0 32 32" class="h-7 w-7" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="#0b1220" />
        <path d="M8.43 8.27V5.5h11.2v2.77h-3.97V19h-3.26V8.27Z" fill="#e6ebf2" />
        <path d="M20.45 19V9.43h3.12V19Z" fill="#e6ebf2" />
        <circle cx="22.01" cy="6.71" r="1.72" :fill="app.color" />
        <path d="M5.5 27l5.5-4 4.5 2.4L26.5 20.8" fill="none" :stroke="app.color" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      <span class="text-[10px] leading-none font-semibold" :style="{ color: app.color }">{{ app.short }}</span>
      <span
        role="tooltip"
        class="pointer-events-none absolute bottom-full z-20 mb-1.5 rounded-md border border-line bg-panel px-2 py-1 text-xs whitespace-nowrap text-text opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        :class="tooltipPlace(index)"
      >
        {{ app.name }}<span v-if="app.key === current" class="text-muted"> · sedang dibuka</span>
      </span>
    </component>
  </nav>
</template>
