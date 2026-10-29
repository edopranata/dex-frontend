<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AnimatedNumber from '@/components/AnimatedNumber.vue'
import AppIcon, { type IconName } from '@/components/AppIcon.vue'
import Toaster from '@/components/Toaster.vue'
import { changeClass, pct, usd } from '@/lib/format'
import { useAuthStore } from '@/stores/auth'
import { usePortfolioStore } from '@/stores/portfolio'

const auth = useAuthStore()
const portfolio = usePortfolioStore()
const router = useRouter()
const route = useRoute()
const menuOpen = ref(false)

interface NavItem {
  to: string
  label: string
  icon: IconName
  exact?: boolean
}

const trading: NavItem[] = [
  { to: '/', label: 'Ringkasan', icon: 'home', exact: true },
  { to: '/markets', label: 'Market', icon: 'market' },
  { to: '/discover', label: 'Temukan', icon: 'discover' },
  { to: '/signals', label: 'Sinyal', icon: 'signals' },
  { to: '/whales', label: 'Whale Tracker', icon: 'whale' },
  { to: '/news', label: 'Berita', icon: 'news' },
  { to: '/portfolio', label: 'Portofolio', icon: 'portfolio' },
]

const account = computed<NavItem[]>(() => [
  { to: '/profile', label: 'Profil & Pengaturan', icon: 'user' },
  ...(auth.user?.is_admin ? [{ to: '/admin', label: 'Admin', icon: 'admin' as const }] : []),
])

const initials = computed(() =>
  (auth.user?.name ?? '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join(''),
)

/** Share of equity held in tokens, for the allocation bar. */
const holdingsShare = computed(() => {
  const s = portfolio.summary
  return s && s.equity_usd > 0 ? Math.min(100, Math.max(0, (s.holdings_value_usd / s.equity_usd) * 100)) : 0
})

function isActive(item: NavItem): boolean {
  return item.exact ? route.path === item.to : route.path.startsWith(item.to)
}

async function logout() {
  portfolio.stop()
  await auth.logout()
  router.push('/login')
}

watch(
  () => route.fullPath,
  () => {
    menuOpen.value = false
    portfolio.refresh()
  },
)

onMounted(() => portfolio.start())
onBeforeUnmount(() => portfolio.stop())
</script>

<template>
  <div class="min-h-screen lg:flex">
    <!-- Mobile / tablet top bar -->
    <header class="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-bg/85 px-4 backdrop-blur-md lg:hidden">
      <button class="btn-ghost p-1.5" :aria-expanded="menuOpen" aria-label="Buka menu" @click="menuOpen = true">
        <AppIcon name="menu" class="h-5 w-5" />
      </button>
      <RouterLink to="/" class="flex items-center gap-2 font-semibold">
        <img src="/favicon.svg" alt="" class="h-6 w-6" />
        <span>DEX Simulator</span>
      </RouterLink>
      <RouterLink v-if="portfolio.summary" to="/portfolio" class="ml-auto text-right text-xs leading-tight">
        <AnimatedNumber class="num block font-semibold" :value="portfolio.summary.equity_usd" :format="usd" />
        <span class="num" :class="changeClass(portfolio.summary.total_pnl)">{{ pct(portfolio.summary.total_pnl_pct) }}</span>
      </RouterLink>
    </header>

    <Transition name="fade">
      <div v-if="menuOpen" class="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" @click="menuOpen = false" />
    </Transition>

    <aside
      class="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-line bg-panel transition-transform duration-300 ease-(--ease-out-soft) lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:max-w-none lg:translate-x-0 3xl:w-72"
      :class="menuOpen ? 'translate-x-0 shadow-2xl shadow-black/60' : '-translate-x-full'"
    >
      <div class="flex h-14 shrink-0 items-center gap-2 px-4">
        <RouterLink to="/" class="group flex items-center gap-2 font-semibold">
          <img src="/favicon.svg" alt="" class="h-6 w-6 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[-8deg]" />
          <span>DEX Simulator</span>
        </RouterLink>
        <button class="btn-ghost ml-auto p-1.5 lg:hidden" aria-label="Tutup menu" @click="menuOpen = false">
          <AppIcon name="close" class="h-5 w-5" />
        </button>
      </div>

      <div class="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-3">
        <nav class="space-y-0.5">
          <RouterLink
            v-for="item in trading"
            :key="item.to"
            :to="item.to"
            class="nav-item"
            :class="isActive(item) ? 'nav-item-active' : ''"
          >
            <AppIcon :name="item.icon" class="h-[18px] w-[18px] shrink-0" />
            {{ item.label }}
          </RouterLink>
        </nav>

        <p class="mt-5 mb-1 px-3 text-[10px] font-semibold tracking-wider text-muted uppercase">Akun</p>
        <nav class="space-y-0.5">
          <RouterLink v-for="item in account" :key="item.to" :to="item.to" class="nav-item" :class="isActive(item) ? 'nav-item-active' : ''">
            <AppIcon :name="item.icon" class="h-[18px] w-[18px] shrink-0" />
            {{ item.label }}
          </RouterLink>
        </nav>

        <!-- Portfolio snapshot -->
        <RouterLink to="/portfolio" class="mt-5 block rounded-xl border border-line bg-panel-2/50 p-3 transition-colors hover:border-brand/40">
          <template v-if="portfolio.summary">
            <p class="text-[11px] text-muted">Ekuitas</p>
            <AnimatedNumber class="num block text-xl font-semibold" :value="portfolio.summary.equity_usd" :format="usd" />
            <p class="num mt-0.5 text-xs" :class="changeClass(portfolio.summary.total_pnl)">
              {{ portfolio.summary.total_pnl >= 0 ? '+' : '' }}{{ usd(portfolio.summary.total_pnl) }} ({{ pct(portfolio.summary.total_pnl_pct) }})
              <span class="text-muted">total P&amp;L</span>
            </p>

            <div class="mt-3 h-1.5 overflow-hidden rounded-full bg-bg" :title="`${holdingsShare.toFixed(0)}% di token`">
              <div class="h-full rounded-full bg-brand transition-[width] duration-700" :style="{ width: `${holdingsShare}%` }" />
            </div>
            <p class="mt-1 flex justify-between text-[10px] text-muted">
              <span>Token {{ holdingsShare.toFixed(0) }}%</span>
              <span>Kas {{ (100 - holdingsShare).toFixed(0) }}%</span>
            </p>

            <dl class="mt-3 space-y-1.5 text-xs">
              <div class="flex justify-between gap-2">
                <dt class="text-muted">P&amp;L terealisasi</dt>
                <dd class="num" :class="changeClass(portfolio.summary.realized_pnl)">{{ usd(portfolio.summary.realized_pnl) }}</dd>
              </div>
              <div class="flex justify-between gap-2">
                <dt class="text-muted">P&amp;L belum terealisasi</dt>
                <dd class="num" :class="changeClass(portfolio.summary.unrealized_pnl)">{{ usd(portfolio.summary.unrealized_pnl) }}</dd>
              </div>
              <div class="flex justify-between gap-2">
                <dt class="text-muted">Saldo kas</dt>
                <dd class="num">{{ usd(portfolio.summary.balance_usd) }}</dd>
              </div>
              <div class="flex justify-between gap-2">
                <dt class="text-muted">Nilai token</dt>
                <dd class="num">{{ usd(portfolio.summary.holdings_value_usd) }}</dd>
              </div>
              <div class="flex justify-between gap-2">
                <dt class="text-muted">Posisi · order pending</dt>
                <dd class="num">{{ portfolio.summary.open_positions }} · {{ portfolio.summary.pending_orders }}</dd>
              </div>
              <div class="flex justify-between gap-2">
                <dt class="text-muted">Transaksi · fee</dt>
                <dd class="num">{{ portfolio.summary.trades }} · {{ usd(portfolio.summary.fees_paid) }}</dd>
              </div>
            </dl>
          </template>
          <div v-else class="space-y-2">
            <div class="skeleton h-3 w-16" />
            <div class="skeleton h-6 w-32" />
            <div class="skeleton h-3 w-full" />
            <div class="skeleton h-3 w-full" />
          </div>
        </RouterLink>
      </div>

      <!-- User -->
      <div class="flex shrink-0 items-center gap-2 border-t border-line p-3">
        <RouterLink to="/profile" class="flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1.5 transition-colors hover:bg-panel-2" title="Profil & pengaturan">
          <span class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand/20 text-sm font-semibold text-brand">{{ initials }}</span>
          <span class="min-w-0">
            <span class="block truncate text-sm font-medium">{{ auth.user?.name }}</span>
            <span class="block truncate text-[11px] text-muted">{{ auth.user?.email }}</span>
            <span class="mt-0.5 flex gap-1">
              <span v-if="auth.user?.is_admin" class="badge-mini bg-brand/15 text-brand">Admin</span>
              <span class="badge-mini" :class="auth.user?.two_factor_enabled ? 'bg-up/15 text-up' : 'bg-warn/15 text-warn'">{{ auth.user?.two_factor_enabled ? '2FA' : 'Tanpa 2FA' }}</span>
              <span v-if="auth.user?.telegram_linked" class="badge-mini bg-sky-500/15 text-sky-400">Telegram</span>
            </span>
          </span>
        </RouterLink>
        <button class="btn-ghost shrink-0 p-2" title="Keluar" aria-label="Keluar" @click="logout">
          <AppIcon name="logout" class="h-[18px] w-[18px]" />
        </button>
      </div>
    </aside>

    <div class="min-w-0 flex-1">
      <main class="px-4 py-6 sm:px-6 lg:px-8 3xl:px-12">
        <RouterView v-slot="{ Component, route: current }">
          <Transition name="page" mode="out-in">
            <component :is="Component" :key="current.matched[1]?.path ?? current.path" />
          </Transition>
        </RouterView>
      </main>

      <footer class="px-4 pb-8 text-xs text-muted sm:px-6 lg:px-8 3xl:px-12">
        Simulasi dengan uang virtual. Harga real dari DEX Screener &amp; GeckoTerminal. Sinyal adalah hasil algoritma, bukan nasihat keuangan.
      </footer>
    </div>

    <Toaster />
  </div>
</template>
