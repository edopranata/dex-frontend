import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

export type ThemeMode = 'dark' | 'light' | 'system'

const STORAGE_KEY = 'theme'
const lightQuery = window.matchMedia('(prefers-color-scheme: light)')

function stored(): ThemeMode {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === 'dark' || value === 'light' ? value : 'system'
  } catch {
    return 'system'
  }
}

/**
 * Dark, light or follow the operating system. The resolved theme is set as data-theme on <html>
 * (index.html does the same before the first paint) and as the browser's theme-color.
 */
export const useThemeStore = defineStore('theme', () => {
  const mode = ref<ThemeMode>(stored())
  const systemLight = ref(lightQuery.matches)
  const resolved = computed<'dark' | 'light'>(() => (mode.value === 'system' ? (systemLight.value ? 'light' : 'dark') : mode.value))

  lightQuery.addEventListener('change', (event) => (systemLight.value = event.matches))

  watch(
    resolved,
    (theme) => {
      document.documentElement.dataset.theme = theme
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#f4f6fa' : '#0b1018')
    },
    { immediate: true },
  )

  watch(mode, (value) => {
    try {
      localStorage.setItem(STORAGE_KEY, value)
    } catch {
      // Private mode: the choice lasts for this tab only.
    }
  })

  return { mode, resolved }
})

/** A theme token ("text", "line", …) as a color string, for canvas charts that cannot use CSS variables. */
export function themeColor(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(`--color-${name}`).trim()
}
