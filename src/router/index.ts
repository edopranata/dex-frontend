import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

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
        { path: 'profile', name: 'profile', component: () => import('@/views/ProfileView.vue') },
        {
          path: 'admin',
          component: () => import('@/views/admin/AdminLayout.vue'),
          meta: { admin: true },
          children: [
            { path: '', redirect: '/admin/settings' },
            { path: 'settings', name: 'admin-settings', component: () => import('@/views/admin/AdminSettings.vue') },
            { path: 'users', name: 'admin-users', component: () => import('@/views/admin/AdminUsers.vue') },
            { path: 'backups', name: 'admin-backups', component: () => import('@/views/admin/AdminBackups.vue') },
            { path: 'logs', name: 'admin-logs', component: () => import('@/views/admin/AdminLogs.vue') },
            { path: 'tasks', name: 'admin-tasks', component: () => import('@/views/admin/AdminTasks.vue') },
            { path: 'system', name: 'admin-system', component: () => import('@/views/admin/AdminSystem.vue') },
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
