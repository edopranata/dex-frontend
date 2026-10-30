import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

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
    { path: '/register', name: 'register', component: () => import('@/views/RegisterView.vue'), meta: { guest: true } },
    {
      path: '/',
      component: () => import('@/layouts/AppLayout.vue'),
      children: [
        { path: '', name: 'dashboard', component: () => import('@/views/DashboardView.vue') },
        { path: 'markets', name: 'markets', component: () => import('@/views/MarketsView.vue') },
        { path: 'discover', name: 'discover', component: () => import('@/views/DiscoverView.vue') },
        { path: 'tokens/:id', name: 'token', component: () => import('@/views/TokenView.vue'), props: true },
        { path: 'portfolio', name: 'portfolio', component: () => import('@/views/PortfolioView.vue') },
        { path: 'signals', name: 'signals', component: () => import('@/views/SignalsView.vue') },
        { path: 'whales', name: 'whales', component: () => import('@/views/WhalesView.vue') },
        { path: 'news', name: 'news', component: () => import('@/views/NewsView.vue') },
        { path: 'profile/:tab?', name: 'profile', component: () => import('@/views/ProfileView.vue'), props: true },
        {
          path: 'admin',
          component: () => import('@/views/admin/AdminLayout.vue'),
          meta: { admin: true },
          children: [
            { path: '', redirect: '/admin/settings' },
            { path: 'settings', name: 'admin-settings', component: () => import('@/views/admin/AdminSettings.vue'), meta: { title: 'Pengaturan', description: 'Pengaturan aplikasi yang berlaku untuk semua pengguna. Perubahan langsung dipakai tanpa deploy ulang.' } },
            { path: 'users', name: 'admin-users', component: () => import('@/views/admin/AdminUsers.vue'), meta: { title: 'Pengguna', description: 'Tambah akun, atur peran admin, reset password atau 2FA.' } },
            { path: 'backups', name: 'admin-backups', component: () => import('@/views/admin/AdminBackups.vue'), meta: { title: 'Backup', description: 'Backup database harian otomatis, backup manual, dan unduhan file.' } },
            { path: 'logs', name: 'admin-logs', component: () => import('@/views/admin/AdminLogs.vue'), meta: { title: 'Log', description: 'Log aplikasi Laravel per hari.' } },
            { path: 'tasks', name: 'admin-tasks', component: () => import('@/views/admin/AdminTasks.vue'), meta: { title: 'Tugas terjadwal', description: 'Jadwal cron aplikasi, riwayat eksekusi, dan jalankan manual.' } },
            { path: 'system', name: 'admin-system', component: () => import('@/views/admin/AdminSystem.vue'), meta: { title: 'Sistem', description: 'Status scheduler, antrean job, database, disk, dan job gagal.' } },
          ],
        },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (!auth.checked) await auth.fetchUser()

  if (!to.meta.guest && !auth.user) return { name: 'login', query: { redirect: to.fullPath } }
  if (to.meta.guest && auth.user) return { name: 'dashboard' }
  if (to.matched.some((record) => record.meta.admin) && !auth.user?.is_admin) return { name: 'dashboard' }
})

export default router
