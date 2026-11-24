import { ref, watch } from 'vue'

export type SidebarMode = 'full' | 'mini' | 'hide'

const STORAGE_KEY = 'sidebar:v1'

function initial(): SidebarMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'full' || saved === 'mini' || saved === 'hide') return saved
  } catch {
    // Blocked storage: the full sidebar.
  }
  return 'full'
}

/** The desktop sidebar: full, icons only (mini), or hidden. Kept in this browser; phones keep the slide-in menu. */
const mode = ref<SidebarMode>(initial())

watch(mode, (value) => {
  try {
    localStorage.setItem(STORAGE_KEY, value)
  } catch {
    // Not kept in this browser.
  }
})

export function useSidebar() {
  return { mode }
}
