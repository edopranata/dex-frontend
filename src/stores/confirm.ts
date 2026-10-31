import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface DialogOptions {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  /** Danger for what cannot be undone: a red button, and Enter does not confirm by accident. */
  tone?: 'danger' | 'primary'
}

export interface PromptOptions extends DialogOptions {
  inputLabel: string
  inputType?: 'text' | 'password'
  minLength?: number
}

interface Pending extends PromptOptions {
  isPrompt: boolean
  resolve: (answer: string | boolean | null) => void
}

/**
 * The app's own confirm and prompt dialogs. Both wait for the answer, like the browser's versions:
 * `if (!(await dialog.confirm({ title: 'Hapus?' }))) return`
 */
export const useConfirmStore = defineStore('confirm', () => {
  const pending = ref<Pending | null>(null)

  function open(options: Partial<PromptOptions> & DialogOptions, isPrompt: boolean): Promise<string | boolean | null> {
    // A second dialog replaces the first, which then counts as cancelled.
    pending.value?.resolve(pending.value.isPrompt ? null : false)
    return new Promise((resolve) => {
      pending.value = { inputLabel: '', ...options, isPrompt, resolve }
    })
  }

  function answer(value: string | boolean | null) {
    pending.value?.resolve(value)
    pending.value = null
  }

  return {
    pending,
    answer,
    confirm: (options: DialogOptions) => open(options, false) as Promise<boolean>,
    prompt: (options: PromptOptions) => open(options, true) as Promise<string | null>,
  }
})
