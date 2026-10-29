import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface Toast {
  id: number
  tone: 'success' | 'error' | 'info'
  title: string
  body?: string
}

export const useToastStore = defineStore('toast', () => {
  const toasts = ref<Toast[]>([])
  let nextId = 1

  function push(tone: Toast['tone'], title: string, body?: string, timeoutMs = 4500) {
    const id = nextId++
    toasts.value.push({ id, tone, title, body })
    setTimeout(() => dismiss(id), timeoutMs)
  }

  function dismiss(id: number) {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  return {
    toasts,
    dismiss,
    success: (title: string, body?: string) => push('success', title, body),
    error: (title: string, body?: string) => push('error', title, body, 6000),
    info: (title: string, body?: string) => push('info', title, body),
  }
})
