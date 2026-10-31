<script setup lang="ts">
import { computed, ref } from 'vue'

/** Tiny line of one measure over the last hour, with the value of the hovered minute. */
const props = defineProps<{ points: { t: number; value: number | null }[]; label: string; format: (value: number) => string; fromZero?: boolean }>()

const WIDTH = 96
const HEIGHT = 24

const known = computed(() => props.points.filter((p): p is { t: number; value: number } => p.value !== null))

const scale = computed(() => {
  const values = known.value.map((p) => p.value)
  const max = Math.max(...values)
  // Small changes must not look dramatic: the line uses at least a tenth of the highest value as its range.
  const min = props.fromZero ? 0 : Math.min(Math.min(...values), max * 0.9)
  return { min, range: max - min || 1 }
})

const coordinates = computed(() =>
  known.value.map((p, i) => ({
    ...p,
    x: known.value.length > 1 ? (i / (known.value.length - 1)) * WIDTH : WIDTH,
    y: HEIGHT - ((p.value - scale.value.min) / scale.value.range) * HEIGHT,
  })),
)

const path = computed(() => coordinates.value.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' '))

const hovered = ref<{ point: { t: number; value: number; x: number; y: number }; left: number; top: number } | null>(null)

function onMove(event: PointerEvent) {
  const box = (event.currentTarget as SVGElement).getBoundingClientRect()
  const index = Math.round(((event.clientX - box.left) / box.width) * (coordinates.value.length - 1))
  const point = coordinates.value[Math.min(Math.max(index, 0), coordinates.value.length - 1)]
  if (point) hovered.value = { point, left: event.clientX, top: box.top }
}

function time(seconds: number): string {
  return new Date(seconds * 1000).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <span v-if="coordinates.length < 2" class="inline-block w-24 text-[11px] whitespace-nowrap text-muted">{{ coordinates.length ? 'Mengumpulkan…' : '–' }}</span>
  <svg
    v-else
    :width="WIDTH"
    :height="HEIGHT"
    :viewBox="`-1 -2 ${WIDTH + 2} ${HEIGHT + 4}`"
    class="block overflow-visible"
    role="img"
    :aria-label="`${label}, 1 jam terakhir`"
    @pointermove="onMove"
    @pointerleave="hovered = null"
  >
    <rect x="-1" y="-2" :width="WIDTH + 2" :height="HEIGHT + 4" fill="transparent" />
    <path :d="path" fill="none" stroke="var(--color-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <template v-if="hovered">
      <line :x1="hovered.point.x" :x2="hovered.point.x" y1="-2" :y2="HEIGHT + 2" stroke="var(--color-line)" />
      <circle :cx="hovered.point.x" :cy="hovered.point.y" r="3" fill="var(--color-brand)" stroke="var(--color-panel)" stroke-width="2" />
    </template>
  </svg>
  <Teleport to="body">
    <div
      v-if="hovered"
      class="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-md border border-line bg-panel px-2 py-1 text-xs whitespace-nowrap shadow-lg"
      :style="{ left: `${hovered.left}px`, top: `${hovered.top - 6}px` }"
    >
      <span class="text-muted">{{ time(hovered.point.t) }} · {{ label }}</span>
      <span class="num ml-1.5 font-medium">{{ format(hovered.point.value) }}</span>
    </div>
  </Teleport>
</template>
