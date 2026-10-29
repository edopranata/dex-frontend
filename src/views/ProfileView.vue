<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import NotificationsCard from '@/components/profile/NotificationsCard.vue'
import TelegramCard from '@/components/profile/TelegramCard.vue'
import TwoFactorCard from '@/components/profile/TwoFactorCard.vue'
import Skeleton from '@/components/Skeleton.vue'
import { api, errorMessage } from '@/lib/api'
import { dateTime } from '@/lib/format'
import type { Profile, User } from '@/lib/types'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'

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

    <div v-if="!profile" class="grid gap-5 xl:grid-cols-2 3xl:grid-cols-3">
      <Skeleton v-for="i in 4" :key="i" :rows="1" height="h-56" />
    </div>

    <div v-else class="grid items-start gap-5 xl:grid-cols-2 3xl:grid-cols-3">
      <div class="space-y-5">
        <form class="card animate-fade-up p-5" @submit.prevent="saveInfo">
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

        <form class="card animate-fade-up p-5" style="animation-delay: 40ms" @submit.prevent="savePassword">
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
      </div>

      <div class="space-y-5">
        <TwoFactorCard class="animate-fade-up" style="animation-delay: 80ms" :status="profile.two_factor" :email="profile.user.email" @changed="load" />
        <TelegramCard class="animate-fade-up" style="animation-delay: 120ms" :status="profile.telegram" @changed="load" />
      </div>

      <NotificationsCard
        class="animate-fade-up xl:col-span-2 3xl:col-span-1"
        style="animation-delay: 160ms"
        :settings="profile.notifications"
        :is-admin="profile.user.is_admin"
        :telegram-linked="profile.telegram.linked"
        @saved="(s) => profile && (profile.notifications = s)"
      />
    </div>
  </div>
</template>
