<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import AppIcon, { type IconName } from '@/components/AppIcon.vue'
import NotificationsCard from '@/components/profile/NotificationsCard.vue'
import TelegramCard from '@/components/profile/TelegramCard.vue'
import TwoFactorCard from '@/components/profile/TwoFactorCard.vue'
import Skeleton from '@/components/Skeleton.vue'
import { api, errorMessage } from '@/lib/api'
import { dateTime } from '@/lib/format'
import type { Profile, User } from '@/lib/types'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'

const props = defineProps<{ tab?: string }>()

type TabKey = 'akun' | 'password' | 'keamanan' | 'telegram' | 'notifikasi'

const tabs: { key: TabKey; label: string; icon: IconName }[] = [
  { key: 'akun', label: 'Data diri', icon: 'user' },
  { key: 'password', label: 'Password', icon: 'key' },
  { key: 'keamanan', label: 'Keamanan (2FA)', icon: 'shield' },
  { key: 'telegram', label: 'Telegram', icon: 'send' },
  { key: 'notifikasi', label: 'Notifikasi', icon: 'bell' },
]

const active = computed<TabKey>(() => (tabs.some((t) => t.key === props.tab) ? (props.tab as TabKey) : 'akun'))

/** Small status next to a tab, so problems are visible without opening it. */
function badge(key: TabKey): { text: string; tone: string } | null {
  if (!profile.value) return null
  if (key === 'keamanan') return profile.value.two_factor.enabled ? { text: 'Aktif', tone: 'bg-up/15 text-up' } : { text: 'Mati', tone: 'bg-warn/15 text-warn' }
  if (key === 'telegram' && profile.value.telegram.available) {
    return profile.value.telegram.linked ? { text: 'Terhubung', tone: 'bg-sky-500/15 text-sky-400' } : { text: 'Belum', tone: 'bg-panel-2 text-muted' }
  }
  return null
}

const auth = useAuthStore()
const toast = useToastStore()
const profile = ref<Profile | null>(null)
const info = reactive({ name: '', email: '' })
const passwords = reactive({ current_password: '', password: '', password_confirmation: '' })
const saving = ref<'info' | 'password' | null>(null)

const initials = computed(() =>
  (profile.value?.user.name ?? '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join(''),
)

async function load() {
  const { data } = await api.get<Profile>('/profile')
  profile.value = data
  auth.user = data.user
  Object.assign(info, { name: data.user.name, email: data.user.email })
}

onMounted(load)

async function saveInfo() {
  saving.value = 'info'
  try {
    const { data } = await api.put<{ data: User }>('/profile', info)
    auth.user = data.data
    if (profile.value) profile.value.user = data.data
    toast.success('Profil disimpan')
  } catch (error) {
    toast.error('Gagal menyimpan', errorMessage(error))
  } finally {
    saving.value = null
  }
}

async function savePassword() {
  saving.value = 'password'
  try {
    await api.put('/profile/password', passwords)
    Object.assign(passwords, { current_password: '', password: '', password_confirmation: '' })
    toast.success('Password diganti')
  } catch (error) {
    toast.error('Gagal mengganti password', errorMessage(error))
  } finally {
    saving.value = null
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center gap-4">
      <span class="grid h-14 w-14 place-items-center rounded-2xl bg-brand/20 text-xl font-semibold text-brand">{{ initials }}</span>
      <div>
        <h1 class="text-xl font-semibold">{{ profile?.user.name ?? 'Profil' }}</h1>
        <p class="text-sm text-muted">
          {{ profile?.user.email }}
          <span v-if="profile?.user.created_at"> · bergabung {{ dateTime(profile.user.created_at) }}</span>
        </p>
      </div>
    </div>

    <div class="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
      <!-- Tabs: a column on large screens, a scrollable row on phones -->
      <nav class="-mx-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0" aria-label="Bagian profil">
        <RouterLink
          v-for="t in tabs"
          :key="t.key"
          :to="`/profile/${t.key}`"
          replace
          class="nav-item shrink-0 whitespace-nowrap"
          :class="active === t.key ? 'nav-item-active' : ''"
        >
          <AppIcon :name="t.icon" class="h-[18px] w-[18px] shrink-0" />
          {{ t.label }}
          <span v-if="badge(t.key)" class="badge-mini ml-auto" :class="badge(t.key)!.tone">{{ badge(t.key)!.text }}</span>
        </RouterLink>
      </nav>

      <div class="max-w-3xl min-w-0">
        <Skeleton v-if="!profile" :rows="1" height="h-56" />

        <Transition v-else name="page" mode="out-in">
          <form v-if="active === 'akun'" key="akun" class="card p-5" @submit.prevent="saveInfo">
            <h2 class="font-semibold">Data diri</h2>
            <div class="mt-4 space-y-3">
              <label class="block">
                <span class="mb-1 block text-xs text-muted">Nama</span>
                <input v-model="info.name" class="w-full" autocomplete="name" required />
              </label>
              <label class="block">
                <span class="mb-1 block text-xs text-muted">Email (dipakai untuk login)</span>
                <input v-model="info.email" type="email" class="w-full" autocomplete="email" required />
              </label>
            </div>
            <div class="mt-4 flex justify-end">
              <button class="btn-primary" :disabled="saving === 'info'">{{ saving === 'info' ? 'Menyimpan…' : 'Simpan' }}</button>
            </div>
          </form>

          <form v-else-if="active === 'password'" key="password" class="card p-5" @submit.prevent="savePassword">
            <h2 class="font-semibold">Ganti password</h2>
            <div class="mt-4 space-y-3">
              <label class="block">
                <span class="mb-1 block text-xs text-muted">Password saat ini</span>
                <input v-model="passwords.current_password" type="password" class="w-full" autocomplete="current-password" required />
              </label>
              <div class="grid gap-3 sm:grid-cols-2">
                <label class="block">
                  <span class="mb-1 block text-xs text-muted">Password baru (min. 8)</span>
                  <input v-model="passwords.password" type="password" class="w-full" minlength="8" autocomplete="new-password" required />
                </label>
                <label class="block">
                  <span class="mb-1 block text-xs text-muted">Ulangi password baru</span>
                  <input v-model="passwords.password_confirmation" type="password" class="w-full" minlength="8" autocomplete="new-password" required />
                </label>
              </div>
            </div>
            <div class="mt-4 flex justify-end">
              <button class="btn-primary" :disabled="saving === 'password'">{{ saving === 'password' ? 'Menyimpan…' : 'Ganti password' }}</button>
            </div>
          </form>

          <TwoFactorCard v-else-if="active === 'keamanan'" key="keamanan" :status="profile.two_factor" :email="profile.user.email" @changed="load" />
          <TelegramCard v-else-if="active === 'telegram'" key="telegram" :status="profile.telegram" @changed="load" />
          <NotificationsCard
            v-else
            key="notifikasi"
            :settings="profile.notifications"
            :is-admin="profile.user.is_admin"
            :telegram-linked="profile.telegram.linked"
            @saved="(s) => profile && (profile.notifications = s)"
          />
        </Transition>
      </div>
    </div>
  </div>
</template>
