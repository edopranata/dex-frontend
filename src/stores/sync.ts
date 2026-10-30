import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * When the app last heard from the server, for the toolbar's live indicator. Every successful API
 * response (including background polling) counts; a request that gets no response marks the
 * connection as lost until the next success.
 */
export const useSyncStore = defineStore('sync', () => {
  const lastSyncAt = ref<number | null>(null)
  const connectionLost = ref(false)
  const online = ref(navigator.onLine)

  window.addEventListener('online', () => (online.value = true))
  window.addEventListener('offline', () => (online.value = false))

  function succeeded() {
    lastSyncAt.value = Date.now()
    connectionLost.value = false
  }

  function failedWithoutResponse() {
    connectionLost.value = true
  }

  return { lastSyncAt, connectionLost, online, succeeded, failedWithoutResponse }
})
