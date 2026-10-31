<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { usd } from '@/lib/format'

/** Equity over time, with the starting balance as the reference line. */
const props = defineProps<{ points: { t: number; equity: number }[]; baseline: number }>()

const HEIGHT = 220
const PAD = { top: 12, right: 12, bottom: 24, left: 60 }

const box = ref<HTMLElement | null>(null)
const width = ref(640)
let observer: ResizeObserver | undefined

onMounted(() => {
  observer = new ResizeObserver(([entry]) => (width.value = entry.contentRect.width))
  if (box.value) observer.observe(box.value)
})
onBeforeUnmount(() => observer?.disconnect())

const range = computed(() => {
  const values = [...props.points.map((p) => p.equity), props.baseline]
  const min = Math.min(...values)
  const max = Math.max(...values)
  // A flat account should not look like it swings: at least 1% of the balance from top to bottom.
  const margin = Math.max((max - min) * 0.1, props.baseline * 0.005)
  return { min: min - margin, max: max + margin }
})

function x(t: number): number {
  const first = props.points[0].t
  const span = props.points[props.points.length - 1].t - first || 1
  return PAD.left + ((t - first) / span) * (width.value - PAD.left - PAD.right)
}

function y(value: number): number {
  return PAD.top + (1 - (value - range.value.min) / (range.value.max - range.value.min)) * (HEIGHT - PAD.top - PAD.bottom)
}

const path = computed(() => props.points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.equity).toFixed(1)}`).join(' '))
const ticks = computed(() => [range.value.max, (range.value.max + range.value.min) / 2, range.value.min])

/** Whole dollars: cents do not fit beside the chart and add nothing at this scale. */
function axisLabel(value: number): string {
  return `$${Math.round(value).toLocaleString('en-US')}`
}

const dates = computed(() => {
  const label = (t: number) => new Date(t * 1000).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  return [label(props.points[0].t), label(props.points[props.points.length - 1].t)]
})

const hover = ref<{ t: number; equity: number } | null>(null)

function onMove(event: PointerEvent) {
  const left = (event.currentTarget as SVGElement).getBoundingClientRect().left
  const position = event.clientX - left
  hover.value = props.points.reduce((best, p) => (Math.abs(x(p.t) - position) < Math.abs(x(best.t) - position) ? p : best))
}

const hoverLabel = computed(() => (hover.value ? new Date(hover.value.t * 1000).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''))
const tooltipLeft = computed(() => (hover.value ? Math.min(Math.max(x(hover.value.t), 80), width.value - 80) : 0))
</script>

<template>
  <div ref="box" class="relative w-full">
    <svg :width="width" :height="HEIGHT" class="block touch-pan-y" role="img" :aria-label="`Kurva ekuitas Auto-follow, ${dates[0]} sampai ${dates[1]}`" @pointermove="onMove" @pointerleave="hover = null">
      <g v-for="tick in ticks" :key="tick">
        <line :x1="PAD.left" :x2="width - PAD.right" :y1="y(tick)" :y2="y(tick)" stroke="var(--color-line)" stroke-opacity="0.5" />
        <text :x="PAD.left - 8" :y="y(tick) + 4" text-anchor="end" class="num fill-muted text-[11px]">{{ axisLabel(tick) }}</text>
      </g>
      <line :x1="PAD.left" :x2="width - PAD.right" :y1="y(baseline)" :y2="y(baseline)" stroke="var(--color-muted)" stroke-dasharray="4 4" />
      <path :d="path" fill="none" stroke="var(--color-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      <text :x="PAD.left" :y="HEIGHT - 6" class="fill-muted text-[11px]">{{ dates[0] }}</text>
      <text :x="width - PAD.right" :y="HEIGHT - 6" text-anchor="end" class="fill-muted text-[11px]">{{ dates[1] }}</text>
      <template v-if="hover">
        <line :x1="x(hover.t)" :x2="x(hover.t)" :y1="PAD.top" :y2="HEIGHT - PAD.bottom" stroke="var(--color-line)" />
        <circle :cx="x(hover.t)" :cy="y(hover.equity)" r="4" fill="var(--color-brand)" stroke="var(--color-panel)" stroke-width="2" />
      </template>
    </svg>
    <div v-if="hover" class="pointer-events-none absolute top-0 -translate-x-1/2 rounded-md border border-line bg-panel px-2 py-1 text-xs whitespace-nowrap shadow-lg" :style="{ left: `${tooltipLeft}px` }">
      <span class="text-muted">{{ hoverLabel }}</span>
      <span class="num ml-1.5 font-medium">{{ usd(hover.equity) }}</span>
    </div>
  </div>
</template>
