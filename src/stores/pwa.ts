import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { registerSW } from 'virtual:pwa-register'

/** Chrome/Edge/Android only: the event that lets the app show its own "Install" button. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/** How often an open app asks the server whether a new version was deployed. */
const UPDATE_CHECK_MS = 5 * 60 * 1000

/** Coming back to the app also checks, but switching windows quickly should not repeat it. */
const MIN_CHECK_GAP_MS = 60 * 1000

const standaloneQuery = window.matchMedia('(display-mode: standalone)')

/**
 * Installable app (PWA): the "Install aplikasi" button while it is not installed yet, and the
 * "versi baru" prompt when a new version was deployed. Created in main.ts before mounting, so the
 * browser's one-time install event is never missed.
 */
export const usePwaStore = defineStore('pwa', () => {
  const installEvent = ref<BeforeInstallPromptEvent | null>(null)
  const installed = ref(standaloneQuery.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true)
  const needRefresh = ref(false)
  const updating = ref(false)

  /** iPhone/iPad Safari has no install event: the user adds it via Share → Add to Home Screen. */
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const canInstall = computed(() => !installed.value && (installEvent.value !== null || isIos))

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    installEvent.value = event as BeforeInstallPromptEvent
  })
  window.addEventListener('appinstalled', () => {
    installed.value = true
    installEvent.value = null
  })
  standaloneQuery.addEventListener('change', (event) => (installed.value = event.matches))

  const updateServiceWorker = registerSW({
    immediate: true,
    onNeedRefresh: () => (needRefresh.value = true),
    onRegisteredSW(_url, registration) {
      if (!registration) return
      let lastCheck = 0
      const check = () => {
        const now = Date.now()
        if (document.visibilityState !== 'visible' || !navigator.onLine || registration.installing || now - lastCheck < MIN_CHECK_GAP_MS) return
        lastCheck = now
        // A failed check is not a problem: the next one tries again.
        registration.update().catch(() => {})
      }
      setInterval(check, UPDATE_CHECK_MS)
      document.addEventListener('visibilitychange', check)
      window.addEventListener('focus', check)
    },
  })

  /**
   * Shows the browser's install dialog. Returns 'ios' when the user has to add it by hand.
   */
  async function install(): Promise<'accepted' | 'dismissed' | 'ios'> {
    if (!installEvent.value) return 'ios'
    await installEvent.value.prompt()
    const { outcome } = await installEvent.value.userChoice
    installEvent.value = null
    return outcome
  }

  /** Switch to the waiting new version and reload. */
  async function update() {
    updating.value = true
    await updateServiceWorker(true)
  }

  return { installed, canInstall, isIos, needRefresh, updating, install, update }
})
