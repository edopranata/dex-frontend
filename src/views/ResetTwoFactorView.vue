<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { api, errorMessage } from '@/lib/api'

/** Opened from the "Reset 2FA" email: confirms switching 2FA off, so a mail scanner opening the link does nothing. */
const route = useRoute()
const token = typeof route.query.token === 'string' ? route.query.token : ''
const email = typeof route.query.email === 'string' ? route.query.email : ''

const loading = ref(false)
const error = ref<string | null>(null)
const done = ref<string | null>(null)

async function submit() {
  loading.value = true
  error.value = null
  try {
    const { data } = await api.post<{ message: string }>('/auth/two-factor/reset', { token, email })
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
        <h1 class="text-lg font-semibold">Reset 2FA</h1>
      </div>
      <p v-if="!token || !email" class="text-sm text-down">Link tidak lengkap. Buka lagi link dari email Anda.</p>
      <template v-else-if="!done">
        <p class="text-sm text-muted">
          Matikan verifikasi dua langkah untuk <span class="text-text">{{ email }}</span>? Setelah itu Anda masuk dengan password saja, lalu sebaiknya aktifkan 2FA lagi di Profil.
        </p>
        <p v-if="error" class="text-sm text-down">{{ error }}</p>
        <button class="w-full rounded-lg bg-down px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50" :disabled="loading">
          {{ loading ? 'Memproses…' : 'Matikan 2FA' }}
        </button>
      </template>
      <template v-else>
        <p class="rounded-lg bg-up/10 px-3 py-2.5 text-sm text-up">{{ done }}</p>
        <RouterLink :to="{ name: 'login' }" class="btn-primary block w-full text-center">Masuk</RouterLink>
      </template>
      <p v-if="!done" class="text-center text-sm text-muted">
        <RouterLink to="/login" class="text-brand hover:underline">← Kembali ke halaman masuk</RouterLink>
      </p>
    </form>
  </div>
</template>
