<script setup lang="ts">
/** On/off toggle for boolean settings (role="switch"). */
defineProps<{ disabled?: boolean; label?: string }>()

const model = defineModel<boolean>({ default: false })
</script>

<template>
  <button
    type="button"
    role="switch"
    class="switch"
    :aria-checked="!!model"
    :aria-label="label"
    :disabled="disabled"
    @click="model = !model"
  >
    <span class="switch-thumb" />
  </button>
</template>
