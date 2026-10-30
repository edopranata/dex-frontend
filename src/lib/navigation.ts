import type { IconName } from '@/components/AppIcon.vue'

export interface NavItem {
  to: string
  label: string
  icon: IconName
  exact?: boolean
  /** Opens outside the SPA (served by Laravel), in a new tab. */
  external?: boolean
}

/** Sidebar menu and the toolbar's search (⌘K). */
export const tradingNav: NavItem[] = [
  { to: '/', label: 'Ringkasan', icon: 'home', exact: true },
  { to: '/markets', label: 'Market', icon: 'market' },
  { to: '/discover', label: 'Temukan', icon: 'discover' },
  { to: '/signals', label: 'Sinyal', icon: 'signals' },
  { to: '/whales', label: 'Whale Tracker', icon: 'whale' },
  { to: '/news', label: 'Berita', icon: 'news' },
  { to: '/portfolio', label: 'Portofolio', icon: 'portfolio' },
]

export const adminNav: NavItem[] = [
  { to: '/admin/info', label: 'General Information', icon: 'info' },
  { to: '/admin/settings', label: 'Pengaturan', icon: 'settings' },
  { to: '/admin/users', label: 'Pengguna', icon: 'users' },
  { to: '/admin/backups', label: 'Backup', icon: 'database' },
  { to: '/admin/logs', label: 'Log', icon: 'file' },
  { to: '/admin/tasks', label: 'Tugas terjadwal', icon: 'clock' },
  { to: '/admin/system', label: 'Sistem', icon: 'server' },
  { to: '/horizon', label: 'Horizon', icon: 'layers', external: true },
]

export const profileNav: NavItem = { to: '/profile', label: 'Profil & pengaturan akun', icon: 'user' }
