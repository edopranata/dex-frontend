<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { api, errorMessage } from '@/lib/api'

/** Opened from the "lupa password" email or from an invitation (?invite=1): the user sets their own password. */
const route = useRoute()
const token = typeof route.query.token === 'string' ? route.query.token : ''
const email = typeof route.query.email === 'string' ? route.query.email : ''
const invite = route.query.invite === '1'

const password = ref('')
const confirmation = ref('')
const loading = ref(false)
const error = ref<string | null>(null)
const done = ref<string | null>(null)

const mismatch = computed(() => confirmation.value !== '' && password.value !== confirmation.value)

async function submit() {
  if (mismatch.value) return
  loading.value = true
  error.value = null
  try {
    const { data } = await api.post<{ message: string }>('/auth/reset-password', {
      token,
      email,
      invite,
      password: password.value,
      password_confirmation: confirmation.value,
    })
    done.value = data.message
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center p-4">
    <form class="card animate-fade-up w-full max-w-sm space-y-4 p-6 shadow-2xl shadow-black/40" @submit.prevent="submit">
      <div class="flex items-center gap-2">
        <img src="/favicon.svg" alt="" class="h-7 w-7" />
        <h1 class="text-lg font-semibold">{{ invite ? 'Buat password' : 'Password baru' }}</h1>
      </div>
      <p v-if="!token || !email" class="text-sm text-down">Link tidak lengkap. Buka lagi link dari email Anda.</p>
      <template v-else-if="!done">
        <p class="text-sm text-muted">
          {{ invite ? 'Selamat datang! Buat password untuk akun' : 'Buat password baru untuk akun' }} <span class="text-text">{{ email }}</span>.
        </p>
        <label class="block">
          <span class="mb-1 block text-xs text-muted">Password</span>
          <input v-model="password" type="password" class="w-full" autocomplete="new-password" minlength="8" autofocus required />
        </label>
        <label class="block">
          <span class="mb-1 block text-xs text-muted">Ulangi password</span>
          <input v-model="confirmation" type="password" class="w-full" autocomplete="new-password" minlength="8" required />
          <span v-if="mismatch" class="mt-1 block text-xs text-down">Password tidak sama.</span>
        </label>
        <p v-if="error" class="text-sm text-down">{{ error }}</p>
        <button class="btn-primary w-full" :disabled="loading || mismatch">{{ loading ? 'Menyimpan…' : 'Simpan password' }}</button>
      </template>
      <template v-else>
        <p class="rounded-lg bg-up/10 px-3 py-2.5 text-sm text-up">{{ done }}</p>
        <RouterLink :to="{ name: 'login' }" class="btn-primary block w-full text-center">Masuk</RouterLink>
      </template>
      <p v-if="!done && (!token || !email || error)" class="text-center text-sm text-muted">
        <RouterLink to="/forgot-password" class="text-brand hover:underline">Minta link baru</RouterLink>
      </p>
    </form>
  </div>
</template>
