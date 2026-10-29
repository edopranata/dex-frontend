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
})

export default router
