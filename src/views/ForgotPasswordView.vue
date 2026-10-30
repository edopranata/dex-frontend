<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { api, errorMessage } from '@/lib/api'

const route = useRoute()
const email = ref(typeof route.query.email === 'string' ? route.query.email : '')
const loading = ref(false)
const error = ref<string | null>(null)
const sent = ref<string | null>(null)

async function submit() {
  loading.value = true
  error.value = null
  try {
    const { data } = await api.post<{ message: string }>('/auth/forgot-password', { email: email.value })
    sent.value = data.message
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
        <h1 class="text-lg font-semibold">Lupa password</h1>
      </div>
      <template v-if="!sent">
        <p class="text-sm text-muted">Masukkan email akun Anda. Kami kirim link untuk membuat password baru.</p>
        <label class="block">
          <span class="mb-1 block text-xs text-muted">Email</span>
          <input v-model="email" type="email" class="w-full" autocomplete="email" autofocus required />
        </label>
        <p v-if="error" class="text-sm text-down">{{ error }}</p>
        <button class="btn-primary w-full" :disabled="loading">{{ loading ? 'Mengirim…' : 'Kirim link reset' }}</button>
      </template>
      <p v-else class="rounded-lg bg-up/10 px-3 py-2.5 text-sm text-up">{{ sent }}</p>
      <p class="text-center text-sm text-muted">
        <RouterLink to="/login" class="text-brand hover:underline">← Kembali ke halaman masuk</RouterLink>
      </p>
    </form>
  </div>
</template>
