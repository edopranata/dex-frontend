<script setup lang="ts">
import { ref } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import { api, errorMessage } from '@/lib/api'
import { dateTime } from '@/lib/format'
import type { Profile } from '@/lib/types'
import { useToastStore } from '@/stores/toast'

const props = defineProps<{ status: Profile['two_factor']; email: string }>()
const emit = defineEmits<{ changed: [] }>()
const toast = useToastStore()

const password = ref('')
const code = ref('')
const busy = ref(false)
const setup = ref<{ secret: string; qr_svg: string; otpauth_url: string } | null>(null)
const recoveryCodes = ref<string[] | null>(null)

async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
  busy.value = true
  try {
    return await fn()
  } catch (error) {
    toast.error('Gagal', errorMessage(error))
  } finally {
    busy.value = false
  }
}

async function start() {
  const data = await run(async () => (await api.post('/profile/two-factor', { password: password.value })).data)
  if (data) {
    setup.value = data
    password.value = ''
  }
}

async function confirm() {
  const data = await run(async () => (await api.post('/profile/two-factor/confirm', { code: code.value })).data)
  if (data) {
    recoveryCodes.value = data.recovery_codes
    setup.value = null
    code.value = ''
    toast.success('2FA aktif', 'Simpan kode pemulihan di tempat aman.')
    emit('changed')
  }
}

async function regenerate() {
  const data = await run(async () => (await api.post('/profile/two-factor/recovery-codes', { password: password.value })).data)
  if (data) {
    recoveryCodes.value = data.recovery_codes
    password.value = ''
    emit('changed')
  }
}

async function disable() {
  if (!window.confirm('Matikan 2FA? Login hanya akan memakai password.')) return
  const data = await run(async () => (await api.delete('/profile/two-factor', { data: { password: password.value } })).data)
  if (data) {
    password.value = ''
    recoveryCodes.value = null
    toast.info('2FA dinonaktifkan')
    emit('changed')
  }
}

function copy(text: string, label: string) {
  navigator.clipboard?.writeText(text).then(() => toast.info(`${label} disalin`))
}

function download() {
  const blob = new Blob([`Kode pemulihan DEX Simulator (${props.email})\nSetiap kode hanya bisa dipakai sekali.\n\n${recoveryCodes.value?.join('\n')}\n`], { type: 'text/plain' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = 'dex-simulator-recovery-codes.txt'
  link.click()
  URL.revokeObjectURL(link.href)
}
</script>

<template>
  <section class="card p-5">
    <div class="flex items-start gap-3">
      <span class="grid h-9 w-9 shrink-0 place-items-center rounded-lg" :class="status.enabled ? 'bg-up/15 text-up' : 'bg-warn/15 text-warn'">
        <AppIcon name="shield" class="h-5 w-5" />
      </span>
      <div>
        <h2 class="font-semibold">Verifikasi dua langkah (2FA)</h2>
        <p class="mt-0.5 text-xs text-muted">
          Setelah password, login meminta kode 6 digit dari Google Authenticator, Authy, 1Password, atau aplikasi sejenis.
        </p>
      </div>
      <span class="ml-auto shrink-0 rounded px-2 py-0.5 text-xs" :class="status.enabled ? 'bg-up/15 text-up' : 'bg-panel-2 text-muted'">
        {{ status.enabled ? 'Aktif' : 'Nonaktif' }}
      </span>
    </div>

    <!-- Recovery codes, shown once after enabling or regenerating -->
    <div v-if="recoveryCodes" class="mt-4 rounded-lg border border-warn/40 bg-warn/5 p-4">
      <p class="text-sm font-medium text-warn">Simpan kode pemulihan ini sekarang</p>
      <p class="mt-1 text-xs text-muted">Dipakai jika HP hilang. Setiap kode hanya berlaku sekali, dan tidak akan ditampilkan lagi.</p>
      <ul class="num mt-3 grid grid-cols-2 gap-2 text-sm">
        <li v-for="c in recoveryCodes" :key="c" class="rounded bg-bg px-2 py-1 text-center">{{ c }}</li>
      </ul>
      <div class="mt-3 flex flex-wrap gap-2">
        <button type="button" class="btn-ghost text-xs" @click="copy(recoveryCodes.join('\n'), 'Kode pemulihan')">Salin</button>
        <button type="button" class="btn-ghost text-xs" @click="download">Unduh .txt</button>
        <button type="button" class="btn-primary ml-auto text-xs" @click="recoveryCodes = null">Sudah saya simpan</button>
      </div>
    </div>

    <!-- Setup: scan and confirm -->
    <form v-else-if="setup" class="mt-4 grid gap-4 sm:grid-cols-[auto_1fr]" @submit.prevent="confirm">
      <div class="mx-auto w-44 rounded-lg bg-white p-2 sm:mx-0 [&_svg]:h-auto [&_svg]:w-full" v-html="setup.qr_svg" />
      <div class="space-y-3 text-sm">
        <p>1. Pindai QR dengan aplikasi authenticator.</p>
        <p class="text-xs text-muted">
          Tidak bisa memindai? Masukkan kunci ini manual:
          <button type="button" class="num mt-1 block break-all text-left text-text hover:text-brand" @click="copy(setup.secret, 'Kunci')">{{ setup.secret }}</button>
          <a :href="setup.otpauth_url" class="mt-1 inline-block text-brand hover:underline sm:hidden">Buka di aplikasi authenticator</a>
        </p>
        <label class="block">
          <span class="mb-1 block">2. Masukkan kode 6 digit yang muncul</span>
          <input v-model="code" class="num w-full text-center tracking-[0.4em]" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" placeholder="000000" required />
        </label>
        <div class="flex gap-2">
          <button type="button" class="btn-ghost" :disabled="busy" @click="setup = null">Batal</button>
          <button class="btn-primary flex-1" :disabled="busy">{{ busy ? 'Memeriksa…' : 'Aktifkan' }}</button>
        </div>
      </div>
    </form>

    <!-- Password-protected actions -->
    <form v-else class="mt-4 space-y-3" @submit.prevent="status.enabled ? regenerate() : start()">
      <p v-if="status.enabled" class="text-xs text-muted">
        Aktif sejak {{ dateTime(status.confirmed_at) }} · sisa {{ status.recovery_codes_left }} kode pemulihan
        <span v-if="status.recovery_codes_left <= 2" class="text-warn">— sebaiknya buat ulang</span>
      </p>
      <label class="block">
        <span class="mb-1 block text-xs text-muted">Password Anda</span>
        <input v-model="password" type="password" class="w-full" autocomplete="current-password" required />
      </label>
      <div class="flex flex-wrap gap-2">
        <template v-if="status.enabled">
          <button class="btn-ghost" :disabled="busy">Buat ulang kode pemulihan</button>
          <button type="button" class="btn-ghost text-down" :disabled="busy || !password" @click="disable">Nonaktifkan 2FA</button>
        </template>
        <button v-else class="btn-primary" :disabled="busy">{{ busy ? 'Menyiapkan…' : 'Aktifkan 2FA' }}</button>
      </div>
    </form>
  </section>
</template>
