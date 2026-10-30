<script setup lang="ts">
import { ref } from 'vue'
import AppIcon, { type IconName } from '@/components/AppIcon.vue'
import { usePopover } from '@/composables/usePopover'
import { type ThemeMode, useThemeStore } from '@/stores/theme'

/** Toolbar button: dark, light, or follow the system setting. */
const theme = useThemeStore()
const trigger = ref<HTMLButtonElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const { open, placement, style } = usePopover(trigger, panel)

const options: { value: ThemeMode; label: string; icon: IconName }[] = [
  { value: 'light', label: 'Terang', icon: 'sun' },
  { value: 'dark', label: 'Gelap', icon: 'moon' },
  { value: 'system', label: 'Ikuti sistem', icon: 'monitor' },
]

function choose(mode: ThemeMode) {
  theme.mode = mode
  open.value = false
  trigger.value?.focus()
}
</script>

<template>
  <button
    ref="trigger"
    type="button"
    class="icon-btn h-9 w-9"
    aria-haspopup="menu"
    :aria-expanded="open"
    :aria-label="`Tema: ${options.find((o) => o.value === theme.mode)?.label}`"
    title="Tema tampilan"
    @click="open = !open"
  >
    <AppIcon :name="theme.mode === 'system' ? 'monitor' : theme.resolved === 'light' ? 'sun' : 'moon'" class="h-[18px] w-[18px]" />
  </button>
  <Teleport to="body">
    <Transition name="pop">
      <div v-if="open" ref="panel" role="menu" class="popover-panel w-44 p-1" :data-placement="placement" :style="style" @keydown.esc="open = false">
        <button
          v-for="o in options"
          :key="o.value"
          type="button"
          role="menuitemradio"
          :aria-checked="theme.mode === o.value"
          class="option w-full hover:bg-panel-2"
          :class="{ 'option-active': theme.mode === o.value }"
          @click="choose(o.value)"
        >
          <AppIcon :name="o.icon" class="h-4 w-4 shrink-0" />
          <span class="flex-1 text-left">{{ o.label }}</span>
          <span v-if="theme.mode === o.value" class="text-brand" aria-hidden="true">✓</span>
        </button>
      </div>
    </Transition>
  </Teleport>
</template>
