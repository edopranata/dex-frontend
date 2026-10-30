<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api, errorMessage } from '@/lib/api'
import type { User } from '@/lib/types'
import { useAuthStore } from '@/stores/auth'

/** First login with the temporary password from an admin: the user must choose their own. */
const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const current = ref('')
const password = ref('')
const confirmation = ref('')
const loading = ref(false)
const error = ref<string | null>(null)

const mismatch = computed(() => confirmation.value !== '' && password.value !== confirmation.value)
const sameAsTemporary = computed(() => password.value !== '' && password.value === current.value)

async function submit() {
  if (mismatch.value || sameAsTemporary.value) return
  loading.value = true
  error.value = null
  try {
    const { data } = await api.put<{ data: User }>('/profile/password', {
      current_password: current.value,
      password: password.value,
      password_confirmation: confirmation.value,
    })
    auth.user = data.data
    const redirect = typeof route.query.redirect === 'string' && route.query.redirect !== '/change-password' ? route.query.redirect : '/'
    router.replace(redirect)
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}

async function logout() {
  await auth.logout()
  router.replace({ name: 'login' })
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center p-4">
    <form class="card animate-fade-up w-full max-w-sm space-y-4 p-6 shadow-2xl shadow-black/40" @submit.prevent="submit">
      <div class="flex items-center gap-2">
        <img src="/favicon.svg" alt="" class="h-7 w-7" />
        <h1 class="text-lg font-semibold">Buat password Anda</h1>
      </div>
      <p class="text-sm text-muted">
        Halo <span class="text-text">{{ auth.user?.name }}</span>, Anda masuk dengan password sementara dari admin. Buat password sendiri untuk melanjutkan.
      </p>
      <label class="block">
        <span class="mb-1 block text-xs text-muted">Password sementara (dari email)</span>
        <input v-model="current" type="password" class="w-full" autocomplete="current-password" autofocus required />
      </label>
      <label class="block">
        <span class="mb-1 block text-xs text-muted">Password baru (min. 8 karakter)</span>
        <input v-model="password" type="password" class="w-full" autocomplete="new-password" minlength="8" required />
        <span v-if="sameAsTemporary" class="mt-1 block text-xs text-down">Harus berbeda dari password sementara.</span>
      </label>
      <label class="block">
        <span class="mb-1 block text-xs text-muted">Ulangi password baru</span>
        <input v-model="confirmation" type="password" class="w-full" autocomplete="new-password" minlength="8" required />
        <span v-if="mismatch" class="mt-1 block text-xs text-down">Password tidak sama.</span>
      </label>
      <p v-if="error" class="text-sm text-down">{{ error }}</p>
      <button class="btn-primary w-full" :disabled="loading || mismatch || sameAsTemporary">{{ loading ? 'Menyimpan…' : 'Simpan & lanjutkan' }}</button>
      <p class="text-center text-xs text-muted">
        <button type="button" class="hover:text-text" @click="logout">Keluar</button>
      </p>
    </form>
  </div>
</template>
