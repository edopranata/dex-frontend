<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'

/**
 * Six boxes, one digit each. Typing moves on, Backspace moves back, and pasting or an autofilled
 * code fills every box. Emits `complete` once all digits are there.
 */
const props = withDefaults(defineProps<{ length?: number; autofocus?: boolean; disabled?: boolean; label?: string }>(), { length: 6, autofocus: false, disabled: false, label: 'Kode autentikasi' })
const emit = defineEmits<{ complete: [code: string] }>()

const model = defineModel<string>({ default: '' })
const boxes = ref<HTMLInputElement[]>([])

const digitsOf = (text: string) => text.replace(/\D/g, '').slice(0, props.length)

function focusBox(index: number) {
  const box = boxes.value[Math.min(Math.max(index, 0), props.length - 1)]
  box?.focus()
  box?.select()
}

function setDigits(digits: string) {
  const previous = model.value
  model.value = digits
  if (digits.length === props.length && digits !== previous) emit('complete', digits)
}

/** Insert at a box: one digit from typing, or several from autofill. */
function place(index: number, text: string) {
  const digits = digitsOf(text)
  if (!digits) return
  const chars = model.value.split('')
  // Digits stay contiguous, so a box further on than the end writes at the end.
  const start = Math.min(index, chars.length)
  const next = (chars.slice(0, start).join('') + digits + chars.slice(start + digits.length).join('')).slice(0, props.length)
  setDigits(next)
  nextTick(() => focusBox(start + digits.length))
}

function onInput(index: number, event: Event) {
  const box = event.target as HTMLInputElement
  const text = box.value
  // The box shows the model again: only digits ever stay in it.
  box.value = model.value[index] ?? ''
  place(index, text)
}

function onPaste(event: ClipboardEvent) {
  event.preventDefault()
  const digits = digitsOf(event.clipboardData?.getData('text') ?? '')
  if (!digits) return
  setDigits(digits)
  nextTick(() => focusBox(digits.length))
}

function onKeydown(index: number, event: KeyboardEvent) {
  if (event.key === 'Backspace') {
    event.preventDefault()
    const chars = model.value.split('')
    const target = index < chars.length ? index : index - 1
    if (target < 0) return
    chars.splice(target, 1)
    model.value = chars.join('')
    nextTick(() => focusBox(target))
  } else if (event.key === 'Delete') {
    event.preventDefault()
    const chars = model.value.split('')
    chars.splice(index, 1)
    model.value = chars.join('')
  } else if (event.key === 'ArrowLeft') {
    event.preventDefault()
    focusBox(index - 1)
  } else if (event.key === 'ArrowRight') {
    event.preventDefault()
    focusBox(Math.min(index + 1, model.value.length))
  }
}

watch(model, (value) => {
  // Cleared from outside, such as after a wrong code.
  if (!value && boxes.value.length) nextTick(() => focusBox(0))
})

onMounted(() => {
  if (props.autofocus) focusBox(0)
})
</script>

<template>
  <div class="flex justify-center gap-1.5 sm:gap-2" role="group" :aria-label="label">
    <input
      v-for="i in length"
      :key="i"
      :ref="(el) => { if (el) boxes[i - 1] = el as HTMLInputElement }"
      :value="model[i - 1] ?? ''"
      class="num h-12 w-full max-w-11 min-w-0 px-0 text-center text-lg font-semibold"
      type="text"
      inputmode="numeric"
      pattern="[0-9]*"
      :autocomplete="i === 1 ? 'one-time-code' : 'off'"
      :aria-label="`Digit ${i} dari ${length}`"
      :disabled="disabled"
      @input="onInput(i - 1, $event)"
      @paste="onPaste"
      @keydown="onKeydown(i - 1, $event)"
      @focus="($event.target as HTMLInputElement).select()"
    />
  </div>
</template>
