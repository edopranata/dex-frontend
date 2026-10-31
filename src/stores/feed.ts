import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { api } from '@/lib/api'
import type { Recommendation } from '@/lib/types'

export type FeedCategory = 'signal' | 'market' | 'whale' | 'order'

export interface FeedEvent {
  id: string
  category: FeedCategory
  tone: 'up' | 'down' | 'warn' | 'info'
  title: string
  body: string
  token: { slug: string; symbol: string; image_url: string | null }
}

export interface TickerItem {
  id: number
  recommendation: Recommendation
  status: 'pending' | 'active'
  score: number | null
  token: { id: number; slug: string; symbol: string; image_url: string | null; price_usd: number | null; change_h24: number | null }
}

/** What each user wants to see on this device. */
export interface FeedPreferences {
  ticker: boolean
  signal: boolean
  market: boolean
  whale: boolean
  order: boolean
}

const STORAGE_KEY = 'dex-feed-preferences'
const MAX_WAITING = 12

/** Browser storage can be blocked; the defaults still work then. */
function loadPreferences(): FeedPreferences {
  const defaults: FeedPreferences = { ticker: true, signal: true, market: true, whale: true, order: true }
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') }
  } catch {
    return defaults
  }
}

/**
 * Running text and floating notices around every page. The server tells the time, so events are
 * neither missed nor repeated when the device's clock is off.
 */
export const useFeedStore = defineStore('feed', () => {
  const ticker = ref<TickerItem[]>([])
  const notices = ref<FeedEvent[]>([])
  const preferences = ref<FeedPreferences>(loadPreferences())
  let since: number | null = null

  const visibleTicker = computed(() => (preferences.value.ticker ? ticker.value : []))

  watch(
    preferences,
    (value) => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
      } catch {
        // Not remembered on this device; it still applies until the page is closed.
      }
    },
    { deep: true },
  )

  async function poll() {
    const { data } = await api.get<{ server_time: number; ticker: TickerItem[]; events: FeedEvent[] }>('/feed', { params: since === null ? {} : { since } })
    since = data.server_time
    ticker.value = data.ticker
    const wanted = data.events.filter((event) => preferences.value[event.category])
    notices.value = [...notices.value, ...wanted].slice(0, MAX_WAITING)
  }

  function dismiss(id: string) {
    notices.value = notices.value.filter((notice) => notice.id !== id)
  }

  function clear() {
    notices.value = []
  }

  return { ticker: visibleTicker, notices, preferences, poll, dismiss, clear }
})
