<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import OtpInput from '@/components/OtpInput.vue'
import { api, errorMessage } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { useConfirmStore } from '@/stores/confirm'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const dialog = useConfirmStore()

const email = ref('')
const password = ref('')
const error = ref<string | null>(null)
const loading = ref(false)
const passwordResetEnabled = ref(false)
const resetSent = ref<string | null>(null)
const requestingReset = ref(false)
const twoFactor = ref(false)
const useRecovery = ref(false)
const code = ref('')

onMounted(async () => {
  const { data } = await api.get<{ password_reset_enabled: boolean }>('/auth/options')
  passwordResetEnabled.value = data.password_reset_enabled
})

function enter() {
  router.push((route.query.redirect as string) || '/')
}

async function submit() {
  if (loading.value) return
  loading.value = true
  error.value = null
  try {
    if (!twoFactor.value) {
      twoFactor.value = await auth.login(email.value, password.value)
      if (!twoFactor.value) enter()
      return
    }
    await auth.completeTwoFactor(useRecovery.value ? { recovery_code: code.value } : { code: code.value })
    enter()
  } catch (e) {
    error.value = errorMessage(e)
    if (/kedaluwarsa/i.test(error.value)) backToPassword()
    // A wrong code: start over without clearing boxes by hand.
    else if (twoFactor.value && !useRecovery.value) code.value = ''
  } finally {
    loading.value = false
  }
}

function backToPassword() {
  twoFactor.value = false
  useRecovery.value = false
  code.value = ''
  resetSent.value = null
}

/** Lost the authenticator and the recovery codes: a link to switch 2FA off goes to the account's email. */
async function requestTwoFactorReset() {
  if (!(await dialog.confirm({ title: 'Kirim link reset 2FA?', message: 'Link untuk mematikan 2FA dikirim ke email akun Anda. Setelah itu Anda masuk dengan password saja dan sebaiknya mengaktifkan 2FA lagi.', confirmLabel: 'Kirim link' }))) return
  requestingReset.value = true
  error.value = null
  try {
    const { data } = await api.post<{ message: string }>('/auth/two-factor/reset-request')
    resetSent.value = data.message
  } catch (e) {
    error.value = errorMessage(e)
    if (/kedaluwarsa/i.test(error.value)) backToPassword()
  } finally {
    requestingReset.value = false
  }
}

function toggleRecovery() {
  useRecovery.value = !useRecovery.value
  code.value = ''
  error.value = null
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center p-4">
    <form class="card animate-fade-up w-full max-w-sm space-y-4 p-6 shadow-2xl shadow-black/40" @submit.prevent="submit">
      <div class="flex items-center gap-2">
        <img src="/favicon.svg" alt="" class="h-7 w-7" />
        <h1 class="text-lg font-semibold">DEX Simulator</h1>
      </div>
      <template v-if="!twoFactor">
        <p class="text-sm text-muted">Latihan trading kripto dengan harga real dan uang virtual.</p>
        <label class="block">
          <span class="mb-1 block text-xs text-muted">Email</span>
          <input v-model="email" type="email" class="w-full" autocomplete="email" required />
        </label>
        <div>
          <label class="block">
            <span class="mb-1 block text-xs text-muted">Password</span>
            <input v-model="password" type="password" class="w-full" autocomplete="current-password" required />
          </label>
          <RouterLink v-if="passwordResetEnabled" :to="{ name: 'forgot-password', query: email ? { email } : {} }" class="mt-1.5 block text-right text-xs text-brand hover:underline">Lupa password?</RouterLink>
        </div>
      </template>
      <template v-else>
        <p class="text-sm text-muted">
          {{ useRecovery ? 'Masukkan salah satu kode pemulihan Anda (setiap kode hanya bisa dipakai sekali).' : 'Masukkan kode 6 digit dari aplikasi authenticator Anda.' }}
        </p>
        <OtpInput v-if="!useRecovery" v-model="code" autofocus :disabled="loading" @complete="submit" />
        <label v-else class="block">
          <span class="mb-1 block text-xs text-muted">Kode pemulihan</span>
          <input v-model="code" class="num w-full text-center tracking-widest uppercase" placeholder="XXXXX-XXXXX" autocomplete="off" autofocus required />
        </label>
        <div class="flex justify-between text-xs">
          <button type="button" class="text-muted hover:text-text" @click="backToPassword">← Kembali</button>
          <button type="button" class="text-brand hover:underline" @click="toggleRecovery">{{ useRecovery ? 'Pakai kode authenticator' : 'Pakai kode pemulihan' }}</button>
        </div>
        <p v-if="resetSent" class="rounded-lg bg-up/10 px-3 py-2.5 text-xs text-up">{{ resetSent }} Buka link di email, lalu masuk lagi.</p>
      </template>
      <p v-if="error" class="text-sm text-down">{{ error }}</p>
      <button class="btn-primary w-full" :disabled="loading || (twoFactor && !useRecovery && code.length < 6)">{{ loading ? 'Memeriksa…' : twoFactor ? 'Verifikasi' : 'Masuk' }}</button>
      <p v-if="twoFactor && passwordResetEnabled && !resetSent" class="text-center text-xs text-muted">
        Tidak bisa membuka authenticator dan kode pemulihan hilang?
        <button type="button" class="text-brand hover:underline" :disabled="requestingReset" @click="requestTwoFactorReset">{{ requestingReset ? 'Mengirim…' : 'Reset 2FA lewat email' }}</button>
      </p>
      <p v-if="!twoFactor" class="text-center text-xs text-muted">Akun dibuat oleh admin. Belum punya akun? Hubungi admin.</p>
    </form>
  </div>
</template>
