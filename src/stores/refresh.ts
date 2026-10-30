import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useProgressStore } from './progress'

type Loader = () => unknown

/**
 * Loaders of the current page (registered by usePolling / usePageData), so the toolbar's refresh
 * button reloads everything on screen without a full page reload.
 */
export const useRefreshStore = defineStore('refresh', () => {
  const loaders = new Set<Loader>()
  const refreshing = ref(false)
  const lastRefreshedAt = ref<number | null>(null)

  function register(loader: Loader): () => void {
    loaders.add(loader)
    return () => loaders.delete(loader)
  }

  async function refreshAll(extra: Loader[] = []) {
    if (refreshing.value) return
    const progress = useProgressStore()
    refreshing.value = true
    progress.start()
    try {
      await Promise.allSettled([...loaders, ...extra].map((load) => load()))
      lastRefreshedAt.value = Date.now()
    } finally {
      refreshing.value = false
      progress.done()
    }
  }

  return { refreshing, lastRefreshedAt, register, refreshAll }
})
