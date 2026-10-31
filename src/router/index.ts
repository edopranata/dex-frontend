import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useProgressStore } from '@/stores/progress'

declare module 'vue-router' {
  interface RouteMeta {
    guest?: boolean
    admin?: boolean
    /** Page title and subtitle shown by the admin layout. */
    title?: string
    description?: string
  }
}

const router = createRouter({
  history: createWebHistory(),
  scrollBehavior: (_to, _from, saved) => saved ?? { top: 0, behavior: 'smooth' },
  routes: [
    { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue'), meta: { guest: true } },
    { path: '/forgot-password', name: 'forgot-password', component: () => import('@/views/ForgotPasswordView.vue'), meta: { guest: true } },
    { path: '/reset-password', name: 'reset-password', component: () => import('@/views/ResetPasswordView.vue'), meta: { guest: true } },
    { path: '/reset-2fa', name: 'reset-2fa', component: () => import('@/views/ResetTwoFactorView.vue'), meta: { guest: true } },
    { path: '/change-password', name: 'change-password', component: () => import('@/views/ChangePasswordView.vue') },
    {
      path: '/',
      component: () => import('@/layouts/AppLayout.vue'),
      children: [
        { path: '', name: 'dashboard', component: () => import('@/views/DashboardView.vue'), meta: { title: 'Ringkasan' } },
        { path: 'markets', name: 'markets', component: () => import('@/views/MarketsView.vue'), meta: { title: 'Market' } },
        { path: 'discover', name: 'discover', component: () => import('@/views/DiscoverView.vue'), meta: { title: 'Temukan' } },
        { path: 'tokens/:id', name: 'token', component: () => import('@/views/TokenView.vue'), props: true, meta: { title: 'Token' } },
        { path: 'portfolio', name: 'portfolio', component: () => import('@/views/PortfolioView.vue'), meta: { title: 'Portofolio' } },
        { path: 'signals', name: 'signals', component: () => import('@/views/SignalsView.vue'), meta: { title: 'Sinyal' } },
        { path: 'whales', name: 'whales', component: () => import('@/views/WhalesView.vue'), meta: { title: 'Whale Tracker' } },
        { path: 'news', name: 'news', component: () => import('@/views/NewsView.vue'), meta: { title: 'Berita' } },
        { path: 'profile/:tab?', name: 'profile', component: () => import('@/views/ProfileView.vue'), props: true, meta: { title: 'Profil' } },
        {
          path: 'admin',
          component: () => import('@/views/admin/AdminLayout.vue'),
          meta: { admin: true },
          children: [
            { path: '', redirect: '/admin/info' },
            { path: 'info', name: 'admin-info', component: () => import('@/views/admin/AdminInfo.vue'), meta: { title: 'General Information', description: 'Layanan pihak ke-3 yang dipakai aplikasi: alamat dashboard, biaya, tempat pengaturan, dan statusnya.' } },
            { path: 'settings', name: 'admin-settings', component: () => import('@/views/admin/AdminSettings.vue'), meta: { title: 'Pengaturan', description: 'Pengaturan aplikasi yang berlaku untuk semua pengguna. Perubahan langsung dipakai tanpa deploy ulang.' } },
            { path: 'users', name: 'admin-users', component: () => import('@/views/admin/AdminUsers.vue'), meta: { title: 'Pengguna', description: 'Buat akun (password sementara dikirim ke email), atur peran admin, reset password atau 2FA.' } },
            { path: 'backups', name: 'admin-backups', component: () => import('@/views/admin/AdminBackups.vue'), meta: { title: 'Backup', description: 'Backup database harian otomatis, backup manual, dan unduhan file.' } },
            { path: 'logs', name: 'admin-logs', component: () => import('@/views/admin/AdminLogs.vue'), meta: { title: 'Log', description: 'Log aplikasi Laravel per hari.' } },
            { path: 'tasks', name: 'admin-tasks', component: () => import('@/views/admin/AdminTasks.vue'), meta: { title: 'Tugas terjadwal', description: 'Jadwal cron aplikasi, riwayat eksekusi, dan jalankan manual.' } },
            { path: 'containers', name: 'admin-containers', component: () => import('@/views/admin/AdminContainers.vue'), meta: { title: 'Container', description: 'Status, CPU, memori, dan riwayat setiap container di VPS.' } },
            { path: 'system', name: 'admin-system', component: () => import('@/views/admin/AdminSystem.vue'), meta: { title: 'Sistem', description: 'Status scheduler, antrean job, database, disk, dan job gagal.' } },
          ],
        },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

// Top loading bar: from leaving a page until the new page's first API calls are answered. One hold per
// navigation: a guard redirect runs beforeEach again but afterEach only once.
let navigationHold = false

function releaseNavigationHold(delayMs: number) {
  if (!navigationHold) return
  navigationHold = false
  setTimeout(() => useProgressStore().done(), delayMs)
}

router.beforeEach((to, from) => {
  if (to.path !== from.path && !navigationHold) {
    navigationHold = true
    useProgressStore().start()
  }
})
// Pages start loading on mount, after the page transition; give their requests time to register.
router.afterEach(() => releaseNavigationHold(300))
router.onError(() => releaseNavigationHold(0))

router.afterEach((to) => {
  const title = [...to.matched].reverse().find((record) => record.meta.title)?.meta.title
  document.title = title ? `${title} · DEX Simulator` : 'DEX Simulator'
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (!auth.checked) await auth.fetchUser()

  if (!to.meta.guest && !auth.user) return { name: 'login', query: { redirect: to.fullPath } }
  if (to.meta.guest && auth.user) return { name: 'dashboard' }
  // A temporary password from an admin must be replaced before anything else.
  if (auth.user?.must_change_password && to.name !== 'change-password') return { name: 'change-password', query: { redirect: to.fullPath } }
  if (to.name === 'change-password' && auth.user && !auth.user.must_change_password) return { name: 'dashboard' }
  if (to.matched.some((record) => record.meta.admin) && !auth.user?.is_admin) return { name: 'dashboard' }
})

export default router
