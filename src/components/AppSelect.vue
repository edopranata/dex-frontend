<script setup lang="ts" generic="T extends string | number">
import { computed, nextTick, ref, useId, watch } from 'vue'
import { usePopover } from '@/composables/usePopover'

export interface SelectOption<V> {
  value: V
  label: string
  /** Second line in the list, e.g. what the choice means. */
  hint?: string
}

/**
 * Drop-in for <select>: the same look and keyboard behaviour in every browser
 * (arrows, Home/End, Enter, Escape and type-ahead), with the list rendered by us instead of the OS.
 */
const props = withDefaults(
  defineProps<{
    options: SelectOption<T>[]
    placeholder?: string
    disabled?: boolean
    ariaLabel?: string
  }>(),
  { placeholder: 'Pilih…', disabled: false, ariaLabel: undefined },
)

const model = defineModel<T>()

const id = useId()
const trigger = ref<HTMLButtonElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const { open, placement, style } = usePopover(trigger, panel)
const active = ref(-1)

const selectedIndex = computed(() => props.options.findIndex((o) => o.value === model.value))
const selected = computed(() => props.options[selectedIndex.value] ?? null)

watch(open, async (isOpen) => {
  if (!isOpen) return
  active.value = Math.max(0, selectedIndex.value)
  await nextTick()
  scrollActiveIntoView()
})

function scrollActiveIntoView() {
  panel.value?.querySelector<HTMLElement>(`[data-index="${active.value}"]`)?.scrollIntoView({ block: 'nearest' })
}

function choose(index: number) {
  const option = props.options[index]
  if (!option) return
  model.value = option.value
  open.value = false
}

function move(to: number) {
  active.value = Math.max(0, Math.min(props.options.length - 1, to))
  nextTick(scrollActiveIntoView)
}

let typed = ''
let typedTimer: ReturnType<typeof setTimeout> | undefined

/** Jump to the first option starting with what was just typed, like a native select. */
function typeAhead(key: string) {
  typed += key.toLowerCase()
  clearTimeout(typedTimer)
  typedTimer = setTimeout(() => (typed = ''), 600)
  const index = props.options.findIndex((o) => o.label.toLowerCase().startsWith(typed))
  if (index < 0) return
  if (open.value) move(index)
  else model.value = props.options[index]!.value
}

function onKeydown(event: KeyboardEvent) {
  if (props.disabled) return

  if (!open.value) {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
      event.preventDefault()
      open.value = true
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
      typeAhead(event.key)
    }
    return
  }

  const handled: Record<string, () => void> = {
    ArrowDown: () => move(active.value + 1),
    ArrowUp: () => move(active.value - 1),
    Home: () => move(0),
    End: () => move(props.options.length - 1),
    PageDown: () => move(active.value + 8),
    PageUp: () => move(active.value - 8),
    Enter: () => choose(active.value),
    ' ': () => (typed ? typeAhead(' ') : choose(active.value)),
    Escape: () => (open.value = false),
  }

  if (event.key === 'Tab') {
    open.value = false
  } else if (handled[event.key]) {
    event.preventDefault()
    // Escape inside a dialog closes the list, not the dialog.
    event.stopPropagation()
    handled[event.key]!()
  } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
    typeAhead(event.key)
  }
}
</script>

<template>
  <div class="relative inline-flex min-w-0">
    <button
      ref="trigger"
      type="button"
      class="field field-select w-full"
      role="combobox"
      aria-haspopup="listbox"
      :aria-expanded="open"
      :aria-controls="`${id}-list`"
      :aria-activedescendant="open && active >= 0 ? `${id}-${active}` : undefined"
      :aria-label="ariaLabel"
      :disabled="disabled"
      :data-open="open || undefined"
      @click="open = !open"
      @keydown="onKeydown"
    >
      <span class="min-w-0 flex-1 truncate text-left" :class="{ 'text-muted': !selected }">{{ selected?.label ?? placeholder }}</span>
      <svg class="field-chevron" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
        <path d="m6 8 4 4 4-4" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>

    <Teleport to="body">
      <Transition name="pop">
        <ul
          v-if="open"
          :id="`${id}-list`"
          ref="panel"
          role="listbox"
          class="popover-panel max-h-72 max-w-[min(24rem,calc(100vw-1rem))] overflow-y-auto p-1"
          :data-placement="placement"
          :style="style"
          @pointerdown.prevent
        >
          <li
            v-for="(option, index) in options"
            :id="`${id}-${index}`"
            :key="String(option.value)"
            role="option"
            :data-index="index"
            :aria-selected="index === selectedIndex"
            class="option"
            :class="{ 'option-active': index === active }"
            @pointermove="active = index"
            @click="choose(index)"
          >
            <span class="min-w-0 flex-1">
              <span class="block truncate">{{ option.label }}</span>
              <span v-if="option.hint" class="block truncate text-[11px] text-muted">{{ option.hint }}</span>
            </span>
            <svg v-if="index === selectedIndex" class="h-4 w-4 shrink-0 text-brand" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="m5 10.5 3.2 3L15 7" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </li>
          <li v-if="!options.length" class="px-3 py-2 text-sm text-muted">Tidak ada pilihan</li>
        </ul>
      </Transition>
    </Teleport>
  </div>
</template>
