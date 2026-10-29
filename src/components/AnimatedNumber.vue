<script setup lang="ts">
import { computed, toRef } from 'vue'
import { useTween } from '@/composables/useTween'

const props = defineProps<{ value: number | null | undefined; format: (value: number | null) => string; duration?: number }>()

const tweened = useTween(toRef(props, 'value'), props.duration ?? 700, { fromZero: true })
const text = computed(() => props.format(tweened.value ?? props.value ?? null))
</script>

<template>
  <span>{{ text }}</span>
</template>
