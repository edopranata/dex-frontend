<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useConfirmStore } from '@/stores/confirm'

/** Answers the confirm store: Escape or a click outside cancels, and focus returns where it was. */
const dialog = useConfirmStore()
const panel = ref<HTMLElement | null>(null)
const input = ref<HTMLInputElement | null>(null)
const cancelButton = ref<HTMLButtonElement | null>(null)
const confirmButton = ref<HTMLButtonElement | null>(null)
const value = ref('')
let previousFocus: HTMLElement | null = null

const pending = computed(() => dialog.pending)
const valid = computed(() => !pending.value?.isPrompt || value.value.length >= Math.max(pending.value.minLength ?? 1, 1))

watch(pending, async (current, previous) => {
  if (current && !previous) previousFocus = document.activeElement as HTMLElement | null
  if (!current) {
    previousFocus?.focus?.()
    return
  }
  value.value = ''
  await nextTick()
  if (current.isPrompt) input.value?.focus()
  // On a dangerous action the safe button has the focus, so a stray Enter cancels.
  else if (current.tone === 'danger') cancelButton.value?.focus()
  else confirmButton.value?.focus()
})

function cancel() {
  dialog.answer(pending.value?.isPrompt ? null : false)
}

function submit() {
  if (valid.value) dialog.answer(pending.value?.isPrompt ? value.value : true)
}

/** Keeps Tab inside the dialog. */
function onTab(event: KeyboardEvent) {
  const items = panel.value?.querySelectorAll<HTMLElement>('input, button:not(:disabled)')
  if (!items?.length) return
  const first = items[0]
  const last = items[items.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="pending" class="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" @click.self="cancel" @keydown.esc.stop.prevent="cancel" @keydown.tab="onTab">
        <form ref="panel" class="modal-panel card w-full max-w-md p-5 shadow-2xl shadow-black/50" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" :aria-describedby="pending.message ? 'confirm-message' : undefined" @submit.prevent="submit">
          <h2 id="confirm-title" class="text-base font-semibold">{{ pending.title }}</h2>
          <p v-if="pending.message" id="confirm-message" class="mt-1.5 text-sm text-muted">{{ pending.message }}</p>
          <label v-if="pending.isPrompt" class="mt-4 block">
            <span class="mb-1 block text-xs text-muted">{{ pending.inputLabel }}</span>
            <input ref="input" v-model="value" :type="pending.inputType ?? 'text'" class="w-full" autocomplete="new-password" />
            <span v-if="pending.minLength" class="mt-1 block text-[11px] text-muted">Minimal {{ pending.minLength }} karakter.</span>
          </label>
          <div class="mt-5 flex justify-end gap-2">
            <button ref="cancelButton" type="button" class="btn-ghost" @click="cancel">{{ pending.cancelLabel ?? 'Batal' }}</button>
            <button ref="confirmButton" class="btn-primary" :class="{ '!bg-down !text-white hover:!bg-down/90': pending.tone === 'danger' }" :disabled="!valid">{{ pending.confirmLabel ?? 'Lanjutkan' }}</button>
          </div>
        </form>
      </div>
    </Transition>
  </Teleport>
</template>
