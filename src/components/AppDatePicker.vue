<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { usePopover } from '@/composables/usePopover'

/**
 * Date field with our own calendar, so it looks the same in every browser. The value is a local
 * "YYYY-MM-DD" string (or null); arrow keys move by day/week, PageUp/PageDown by month.
 */
const props = withDefaults(defineProps<{ placeholder?: string; min?: string | null; max?: string | null; disabled?: boolean; ariaLabel?: string }>(), {
  placeholder: 'Pilih tanggal',
  min: null,
  max: null,
  disabled: false,
  ariaLabel: undefined,
})

const model = defineModel<string | null>({ default: null })

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const WEEKDAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']

const trigger = ref<HTMLButtonElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const { open, placement, style } = usePopover(trigger, panel)

/** Day that has keyboard focus inside the grid; the shown month follows it. */
const cursor = ref(new Date())

function toKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function fromKey(key: string | null | undefined): Date | null {
  if (!key) return null
  const [y, m, d] = key.split('-').map(Number)
  return y && m && d ? new Date(y, m - 1, d) : null
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

function addMonths(date: Date, months: number): Date {
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1)
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  return new Date(target.getFullYear(), target.getMonth(), Math.min(date.getDate(), lastDay))
}

const todayKey = toKey(new Date())

const label = computed(() => {
  const date = fromKey(model.value)
  return date ? `${date.getDate()} ${MONTHS[date.getMonth()]!.slice(0, 3)} ${date.getFullYear()}` : null
})

/** Six Monday-first weeks covering the cursor's month. */
const days = computed(() => {
  const first = new Date(cursor.value.getFullYear(), cursor.value.getMonth(), 1)
  const start = addDays(first, -((first.getDay() + 6) % 7))
  return Array.from({ length: 42 }, (_, i) => {
    const date = addDays(start, i)
    const key = toKey(date)
    return {
      key,
      day: date.getDate(),
      inMonth: date.getMonth() === cursor.value.getMonth(),
      disabled: (!!props.min && key < props.min) || (!!props.max && key > props.max),
    }
  })
})

watch(open, (isOpen) => {
  if (!isOpen) return
  cursor.value = fromKey(model.value) ?? fromKey(props.max && todayKey > props.max ? props.max : todayKey)!
  focusCursor()
})

function focusCursor() {
  nextTick(() => panel.value?.querySelector<HTMLButtonElement>(`[data-key="${toKey(cursor.value)}"]`)?.focus())
}

function pick(key: string) {
  model.value = key
  open.value = false
  trigger.value?.focus()
}

function clear() {
  model.value = null
  open.value = false
  trigger.value?.focus()
}

function shiftMonth(months: number) {
  cursor.value = addMonths(cursor.value, months)
}

function onGridKeydown(event: KeyboardEvent) {
  const moves: Record<string, () => Date> = {
    ArrowLeft: () => addDays(cursor.value, -1),
    ArrowRight: () => addDays(cursor.value, 1),
    ArrowUp: () => addDays(cursor.value, -7),
    ArrowDown: () => addDays(cursor.value, 7),
    PageUp: () => addMonths(cursor.value, -1),
    PageDown: () => addMonths(cursor.value, 1),
    Home: () => addDays(cursor.value, -((cursor.value.getDay() + 6) % 7)),
    End: () => addDays(cursor.value, 6 - ((cursor.value.getDay() + 6) % 7)),
  }
  const move = moves[event.key]
  if (!move) return
  event.preventDefault()
  cursor.value = move()
  focusCursor()
}

function onPanelKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  // Escape inside a dialog closes the calendar, not the dialog.
  event.stopPropagation()
  open.value = false
  trigger.value?.focus()
}
</script>

<template>
  <div class="relative inline-flex min-w-0">
    <button
      ref="trigger"
      type="button"
      class="field field-select w-full"
      aria-haspopup="dialog"
      :aria-expanded="open"
      :aria-label="ariaLabel"
      :disabled="disabled"
      :data-open="open || undefined"
      @click="open = !open"
      @keydown.down.prevent="open = true"
    >
      <svg class="h-4 w-4 shrink-0 text-muted" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
        <rect x="3" y="4.5" width="14" height="12" rx="2" />
        <path d="M3 8.5h14M7 3v3M13 3v3" stroke-linecap="round" />
      </svg>
      <span class="num min-w-0 flex-1 truncate text-left" :class="{ 'font-sans text-muted': !label }">{{ label ?? placeholder }}</span>
    </button>

    <Teleport to="body">
      <Transition name="pop">
        <div
          v-if="open"
          ref="panel"
          role="dialog"
          aria-label="Pilih tanggal"
          class="popover-panel w-72 p-3"
          :data-placement="placement"
          :style="style"
          @keydown="onPanelKeydown"
        >
          <div class="mb-2 flex items-center gap-1">
            <button type="button" class="icon-btn" aria-label="Bulan sebelumnya" @click="shiftMonth(-1)">
              <svg class="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m12 5-5 5 5 5" stroke-linecap="round" stroke-linejoin="round" /></svg>
            </button>
            <p class="flex-1 text-center text-sm font-medium" aria-live="polite">{{ MONTHS[cursor.getMonth()] }} {{ cursor.getFullYear() }}</p>
            <button type="button" class="icon-btn" aria-label="Bulan berikutnya" @click="shiftMonth(1)">
              <svg class="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m8 5 5 5-5 5" stroke-linecap="round" stroke-linejoin="round" /></svg>
            </button>
          </div>

          <div class="grid grid-cols-7 text-center text-[10px] font-medium text-muted" aria-hidden="true">
            <span v-for="w in WEEKDAYS" :key="w" class="py-1">{{ w }}</span>
          </div>
          <div class="grid grid-cols-7 gap-0.5" role="grid" @keydown="onGridKeydown">
            <button
              v-for="d in days"
              :key="d.key"
              type="button"
              class="calendar-day"
              :class="{
                'calendar-day-outside': !d.inMonth,
                'calendar-day-today': d.key === todayKey,
                'calendar-day-selected': d.key === model,
              }"
              :data-key="d.key"
              :tabindex="d.key === toKey(cursor) ? 0 : -1"
              :disabled="d.disabled"
              :aria-pressed="d.key === model"
              :aria-label="d.key"
              @click="pick(d.key)"
            >
              {{ d.day }}
            </button>
          </div>

          <div class="mt-2 flex justify-between border-t border-line pt-2 text-xs">
            <button type="button" class="text-muted transition-colors hover:text-text" @click="clear">Hapus</button>
            <button
              type="button"
              class="text-brand transition-colors hover:text-blue-400 disabled:opacity-40"
              :disabled="(!!min && todayKey < min) || (!!max && todayKey > max)"
              @click="pick(todayKey)"
            >
              Hari ini
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
