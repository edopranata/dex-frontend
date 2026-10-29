<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import AnimatedNumber from '@/components/AnimatedNumber.vue'
import Toaster from '@/components/Toaster.vue'
import { usd } from '@/lib/format'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const menuOpen = ref(false)

const nav = [
  { to: '/', label: 'Ringkasan', exact: true },
  { to: '/markets', label: 'Market' },
  { to: '/discover', label: 'Temukan' },
  { to: '/signals', label: 'Sinyal' },
  { to: '/whales', label: 'Whale Tracker' },
  { to: '/news', label: 'Berita' },
  { to: '/portfolio', label: 'Portofolio' },
]

async function logout() {
  await auth.logout()
  router.push('/login')
}
</script>

<template>
  <div class="min-h-screen">
    <header class="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-md">
      <div class="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4">
        <RouterLink to="/" class="group flex items-center gap-2 font-semibold">
          <img src="/favicon.svg" alt="" class="h-6 w-6 transition-transform duration-300 group-hover:rotate-[-8deg] group-hover:scale-110" />
          <span>DEX Simulator</span>
        </RouterLink>

        <nav class="hidden gap-1 lg:flex">
          <RouterLink
            v-for="item in nav"
            :key="item.to"
            :to="item.to"
            class="relative rounded-md px-3 py-1.5 text-sm text-muted transition-colors duration-200 hover:bg-panel-2/60 hover:text-text"
            :exact-active-class="item.exact ? 'bg-panel-2 text-text!' : ''"
            :active-class="item.exact ? '' : 'bg-panel-2 text-text!'"
          >
            {{ item.label }}
          </RouterLink>
        </nav>

        <div class="ml-auto flex items-center gap-3">
          <RouterLink to="/portfolio" class="hidden rounded-md bg-panel-2 px-3 py-1.5 text-xs transition-colors hover:bg-line sm:block">
            <span class="text-muted">Saldo virtual</span>
            <AnimatedNumber class="num ml-2 font-semibold" :value="auth.user?.balance_usd" :format="usd" />
          </RouterLink>
          <button class="hidden text-sm text-muted transition-colors hover:text-text lg:block" @click="logout">Keluar</button>
          <button class="btn-ghost px-2 py-1 lg:hidden" :aria-expanded="menuOpen" aria-label="Menu" @click="menuOpen = !menuOpen">
            <span class="inline-block transition-transform duration-200" :class="menuOpen ? 'rotate-90' : ''">{{ menuOpen ? '✕' : '☰' }}</span>
          </button>
        </div>
      </div>

      <Transition name="drop">
        <nav v-if="menuOpen" class="border-t border-line px-4 py-2 lg:hidden" @click="menuOpen = false">
          <RouterLink
            v-for="(item, i) in nav"
            :key="item.to"
            :to="item.to"
            class="animate-fade-up block rounded px-2 py-2 text-sm"
            :style="{ animationDelay: `${i * 30}ms` }"
          >
            {{ item.label }}
          </RouterLink>
          <button class="block px-2 py-2 text-sm text-muted" @click="logout">Keluar</button>
        </nav>
      </Transition>
    </header>

    <main class="mx-auto max-w-7xl px-4 py-6">
      <RouterView v-slot="{ Component, route }">
        <Transition name="page" mode="out-in">
          <component :is="Component" :key="route.path" />
        </Transition>
      </RouterView>
    </main>

    <footer class="mx-auto max-w-7xl px-4 pb-8 text-xs text-muted">
      Simulasi dengan uang virtual. Harga real dari DEX Screener &amp; GeckoTerminal. Sinyal adalah hasil algoritma, bukan nasihat keuangan.
    </footer>

    <Toaster />
  </div>
</template>
