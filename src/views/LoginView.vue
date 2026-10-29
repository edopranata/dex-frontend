<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api, errorMessage } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const email = ref('')
const password = ref('')
const error = ref<string | null>(null)
const loading = ref(false)
const registrationEnabled = ref(false)

onMounted(async () => {
  const { data } = await api.get<{ registration_enabled: boolean }>('/auth/options')
  registrationEnabled.value = data.registration_enabled
})

async function submit() {
  loading.value = true
  error.value = null
  try {
    await auth.login(email.value, password.value)
    router.push((route.query.redirect as string) || '/')
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
        <h1 class="text-lg font-semibold">DEX Simulator</h1>
      </div>
      <p class="text-sm text-muted">Latihan trading kripto dengan harga real dan uang virtual.</p>
      <label class="block">
        <span class="mb-1 block text-xs text-muted">Email</span>
        <input v-model="email" type="email" class="w-full" autocomplete="email" required />
      </label>
      <label class="block">
        <span class="mb-1 block text-xs text-muted">Password</span>
        <input v-model="password" type="password" class="w-full" autocomplete="current-password" required />
      </label>
      <p v-if="error" class="text-sm text-down">{{ error }}</p>
      <button class="btn-primary w-full" :disabled="loading">{{ loading ? 'Masuk…' : 'Masuk' }}</button>
      <p v-if="registrationEnabled" class="text-center text-sm text-muted">
        Belum punya akun? <RouterLink to="/register" class="text-brand hover:underline">Daftar</RouterLink>
      </p>
    </form>
  </div>
</template>
