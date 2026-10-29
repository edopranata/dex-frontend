<script setup lang="ts">
import { ref, watch } from 'vue'

/** Flashes green/red briefly whenever the value moves up or down. */
const props = defineProps<{ value: number | null | undefined }>()

const direction = ref<'up' | 'down' | null>(null)
const tick = ref(0)

watch(
  () => props.value,
  (next, previous) => {
    if (next === null || next === undefined || previous === null || previous === undefined || next === previous) return
    direction.value = next > previous ? 'up' : 'down'
    tick.value++
  },
)
</script>

<template>
  <span
    :key="tick"
    class="-mx-1 inline-block rounded px-1"
    :class="{ 'animate-flash-up': direction === 'up', 'animate-flash-down': direction === 'down' }"
  >
    <slot />
  </span>
</template>
