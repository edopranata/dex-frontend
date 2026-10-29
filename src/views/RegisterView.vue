<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { errorMessage } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

const form = reactive({ name: '', email: '', password: '', password_confirmation: '' })
const error = ref<string | null>(null)
const loading = ref(false)

async function submit() {
  loading.value = true
  error.value = null
  try {
    await auth.register(form)
    router.push('/')
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
      <h1 class="text-lg font-semibold">Buat akun simulator</h1>
      <p class="text-sm text-muted">Anda mendapat saldo virtual untuk latihan. Saldo bisa direset kapan saja.</p>
      <label class="block">
        <span class="mb-1 block text-xs text-muted">Nama</span>
        <input v-model="form.name" class="w-full" autocomplete="name" required />
      </label>
      <label class="block">
        <span class="mb-1 block text-xs text-muted">Email</span>
        <input v-model="form.email" type="email" class="w-full" autocomplete="email" required />
      </label>
      <label class="block">
        <span class="mb-1 block text-xs text-muted">Password</span>
        <input v-model="form.password" type="password" class="w-full" autocomplete="new-password" required />
      </label>
      <label class="block">
        <span class="mb-1 block text-xs text-muted">Ulangi password</span>
        <input v-model="form.password_confirmation" type="password" class="w-full" autocomplete="new-password" required />
      </label>
      <p v-if="error" class="text-sm text-down">{{ error }}</p>
      <button class="btn-primary w-full" :disabled="loading">{{ loading ? 'Mendaftar…' : 'Daftar' }}</button>
      <p class="text-center text-sm text-muted">
        Sudah punya akun? <RouterLink to="/login" class="text-brand hover:underline">Masuk</RouterLink>
      </p>
    </form>
  </div>
</template>
