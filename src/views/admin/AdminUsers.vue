<script setup lang="ts">
import { usePageData } from '@/composables/usePolling'
import { onMounted, reactive, ref } from 'vue'
import EmptyState from '@/components/EmptyState.vue'
import Skeleton from '@/components/Skeleton.vue'
import { api, errorMessage } from '@/lib/api'
import { dateTime, usd } from '@/lib/format'
import { useAuthStore } from '@/stores/auth'
import { useConfirmStore } from '@/stores/confirm'
import { useToastStore } from '@/stores/toast'

interface AdminUser {
  id: number
  name: string
  email: string
  balance_usd: number
  is_admin: boolean
  is_system: boolean
  positions_count: number
  orders_count: number
  created_at: string
  two_factor_enabled: boolean
  telegram_linked: boolean
  must_change_password: boolean
  temporary_password_expires_at: string | null
}

const auth = useAuthStore()
const toast = useToastStore()
const dialog = useConfirmStore()
const users = ref<AdminUser[] | null>(null)
const showForm = ref(false)
const saving = ref(false)
/** Email is set up (Pengaturan → Email): new users get a temporary password by email. */
const mailEnabled = ref(false)
const form = reactive({ name: '', email: '', password: '', is_admin: false })

interface Delivery {
  sent: boolean
  error: string | null
  /** Only when the email failed, so the admin can pass it on another way. */
  password: string | null
}

/** A temporary password the email could not deliver, shown once for the admin to pass on. */
const undelivered = ref<{ email: string; password: string; error: string | null } | null>(null)

async function load() {
  const { data } = await api.get<{ data: AdminUser[] }>('/admin/users')
  users.value = data.data
}

usePageData(load)
onMounted(async () => {
  const { data } = await api.get<{ password_reset_enabled: boolean }>('/auth/options')
  mailEnabled.value = data.password_reset_enabled
})

function report(email: string, delivery: Delivery, isNew: boolean) {
  if (delivery.sent) {
    undelivered.value = null
    toast.success(isNew ? `Akun ${email} dibuat` : `Password sementara baru dikirim`, `Password sementara terkirim ke ${email}; wajib diganti saat masuk pertama (berlaku 3 hari).`)
    return
  }
  undelivered.value = { email, password: delivery.password ?? '', error: delivery.error }
  toast.error('Email gagal terkirim', 'Berikan password sementara yang tampil di atas tabel lewat jalur aman.')
}

async function create() {
  saving.value = true
  try {
    const { data } = await api.post<{ delivery: Delivery | null }>('/admin/users', mailEnabled.value ? { ...form, password: undefined } : form)
    if (data.delivery) report(form.email, data.delivery, true)
    else toast.success(`Akun ${form.email} dibuat`, 'Berikan password sementara lewat jalur aman; pemiliknya wajib menggantinya saat masuk pertama.')
    Object.assign(form, { name: '', email: '', password: '', is_admin: false })
    showForm.value = false
    await load()
  } catch (error) {
    toast.error('Gagal membuat akun', errorMessage(error))
  } finally {
    saving.value = false
  }
}

async function update(user: AdminUser, payload: Partial<AdminUser> & { password?: string; disable_two_factor?: boolean }, message: string) {
  try {
    await api.patch(`/admin/users/${user.id}`, payload)
    toast.success(message)
    await load()
  } catch (error) {
    toast.error('Gagal', errorMessage(error))
  }
}

async function sendTemporaryPassword(user: AdminUser) {
  if (!(await dialog.confirm({ title: 'Kirim password sementara?', message: `Password baru dikirim ke ${user.email}, dan password lama langsung tidak berlaku.`, confirmLabel: 'Kirim' }))) return
  try {
    const { data } = await api.post<{ delivery: Delivery }>(`/admin/users/${user.id}/temporary-password`)
    report(user.email, data.delivery, false)
    await load()
  } catch (error) {
    toast.error('Gagal mengirim password sementara', errorMessage(error))
  }
}

/** Without email: the admin types a temporary password and passes it on themselves. */
async function resetPassword(user: AdminUser) {
  const own = user.id === auth.user?.id
  const password = await dialog.prompt({
    title: own ? 'Ganti password Anda' : 'Buat password sementara',
    message: own ? undefined : `Untuk ${user.email}. Pemiliknya wajib menggantinya saat login, dan Anda yang menyampaikan password ini.`,
    inputLabel: own ? 'Password baru' : 'Password sementara',
    inputType: 'password',
    minLength: 8,
    confirmLabel: 'Simpan',
  })
  if (password) update(user, { password }, own ? 'Password Anda diganti' : `Password sementara ${user.email} disimpan`)
}

function copy(text: string) {
  navigator.clipboard?.writeText(text).then(() => toast.info('Disalin'))
}

function expired(user: AdminUser): boolean {
  return !!user.temporary_password_expires_at && new Date(user.temporary_password_expires_at).getTime() < Date.now()
}

async function resetTwoFactor(user: AdminUser) {
  const confirmed = await dialog.confirm({ title: 'Matikan 2FA pengguna ini?', message: `Untuk ${user.email}. Lakukan hanya jika pemiliknya kehilangan HP dan kode pemulihan, setelah identitasnya dipastikan.`, confirmLabel: 'Matikan 2FA', tone: 'danger' })
  if (confirmed) update(user, { disable_two_factor: true }, `2FA ${user.email} dimatikan`)
}

async function remove(user: AdminUser) {
  if (!(await dialog.confirm({ title: 'Hapus akun ini?', message: `${user.email} beserta portofolio dan order-nya dihapus. Ini tidak bisa dibatalkan.`, confirmLabel: 'Hapus akun', tone: 'danger' }))) return
  try {
    await api.delete(`/admin/users/${user.id}`)
    toast.success(`Akun ${user.email} dihapus`)
    await load()
  } catch (error) {
    toast.error('Gagal menghapus', errorMessage(error))
  }
}
</script>

<template>
  <div class="stack-section">
    <div class="flex items-center justify-between">
      <p class="text-sm text-muted">Tidak ada pendaftaran publik: semua akun dibuat dari sini.</p>
      <button class="btn-primary" @click="showForm = !showForm">{{ showForm ? 'Batal' : '+ Tambah pengguna' }}</button>
    </div>

    <Transition name="drop">
      <form v-if="showForm" class="card space-y-3 p-4" @submit.prevent="create">
        <div class="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto_auto] md:items-end">
          <label class="block"><span class="mb-1 block text-xs text-muted">Nama</span><input v-model="form.name" class="w-full" required /></label>
          <label class="block"><span class="mb-1 block text-xs text-muted">Email</span><input v-model="form.email" type="email" class="w-full" required /></label>
          <label v-if="!mailEnabled" class="block"><span class="mb-1 block text-xs text-muted">Password sementara</span><input v-model="form.password" type="password" class="w-full" minlength="8" autocomplete="new-password" required /></label>
          <p v-else class="pb-2 text-xs text-muted">Password sementara dibuat otomatis dan dikirim ke email ini.</p>
          <label class="flex items-center gap-2 py-2 text-sm"><input v-model="form.is_admin" type="checkbox" class="h-4 w-4 p-0" /> Admin</label>
          <button class="btn-primary" :disabled="saving">{{ saving ? 'Menyimpan…' : mailEnabled ? 'Buat & kirim email' : 'Buat akun' }}</button>
        </div>
        <p class="text-xs text-muted">
          Pemilik akun wajib membuat password sendiri saat masuk pertama; password sementara berlaku 3 hari.
          <template v-if="!mailEnabled"> Aktifkan email di Pengaturan → Email (SMTP) agar password sementara terkirim otomatis.</template>
        </p>
      </form>
    </Transition>

    <div v-if="undelivered" class="card flex flex-wrap items-center gap-3 border-warn/40 p-4 text-sm">
      <div class="mr-auto">
        <div class="font-medium text-warn">Email ke {{ undelivered.email }} gagal terkirim</div>
        <div class="mt-0.5 text-xs text-muted">{{ undelivered.error }}</div>
        <div class="mt-1 text-xs">Berikan password sementara ini lewat jalur aman (hanya ditampilkan sekali):</div>
      </div>
      <code class="num rounded-md border border-line bg-panel-2 px-3 py-1.5 text-base tracking-wider">{{ undelivered.password }}</code>
      <button class="btn-ghost text-xs" @click="copy(undelivered.password)">Salin</button>
      <button class="text-xs text-muted hover:text-text" @click="undelivered = null">Tutup</button>
    </div>

    <div class="card overflow-x-auto">
      <Skeleton v-if="!users" class="p-3" :rows="3" />
      <table v-else-if="users.length" class="table">
        <thead>
          <tr>
            <th>Nama</th>
            <th>Email</th>
            <th class="text-right!">Saldo virtual</th>
            <th class="text-right!">Posisi / order</th>
            <th>Peran</th>
            <th>Keamanan</th>
            <th>Dibuat</th>
            <th />
          </tr>
        </thead>
        <TransitionGroup tag="tbody" name="row">
          <tr v-for="u in users" :key="u.id">
            <td class="font-medium">{{ u.name }} <span v-if="u.id === auth.user?.id" class="text-xs text-muted">(Anda)</span></td>
            <td class="text-muted">{{ u.email }}</td>
            <td class="num text-right">{{ usd(u.balance_usd) }}</td>
            <td class="num text-right">{{ u.positions_count }} / {{ u.orders_count }}</td>
            <td>
              <span v-if="u.is_system" class="rounded bg-warn/15 px-1.5 py-0.5 text-xs text-warn" title="Akun otomatis pengukur kinerja sinyal; tidak bisa login">Sistem</span>
              <span v-else class="rounded px-1.5 py-0.5 text-xs" :class="u.is_admin ? 'bg-brand/15 text-brand' : 'bg-panel-2 text-muted'">{{ u.is_admin ? 'Admin' : 'Pengguna' }}</span>
            </td>
            <td>
              <div class="flex max-w-56 flex-wrap gap-1">
                <span class="rounded px-1.5 py-0.5 text-xs" :class="u.two_factor_enabled ? 'bg-up/15 text-up' : 'bg-panel-2 text-muted'">{{ u.two_factor_enabled ? '2FA aktif' : 'Tanpa 2FA' }}</span>
                <span v-if="u.telegram_linked" class="rounded bg-sky-500/15 px-1.5 py-0.5 text-xs text-sky-600 dark:text-sky-400">Telegram</span>
                <span v-if="u.must_change_password && expired(u)" class="rounded bg-down/15 px-1.5 py-0.5 text-xs text-down" title="Kirim password sementara baru">Password sementara kedaluwarsa</span>
                <span v-else-if="u.must_change_password" class="rounded bg-warn/15 px-1.5 py-0.5 text-xs text-warn" :title="`Berlaku sampai ${dateTime(u.temporary_password_expires_at)}`">Belum ganti password</span>
              </div>
            </td>
            <td class="text-xs whitespace-nowrap text-muted">{{ dateTime(u.created_at) }}</td>
            <td class="whitespace-nowrap text-right text-xs">
              <span v-if="u.is_system" class="text-muted">Dikelola aplikasi</span>
              <template v-else>
                <button v-if="mailEnabled && u.id !== auth.user?.id" class="text-brand hover:underline" title="Password sementara baru dikirim ke email pengguna (berlaku 3 hari)" @click="sendTemporaryPassword(u)">Kirim password sementara</button>
                <button v-else class="text-brand hover:underline" @click="resetPassword(u)">{{ u.id === auth.user?.id ? 'Ganti password' : 'Reset password' }}</button>
              </template>
              <template v-if="u.id !== auth.user?.id && !u.is_system">
                <span class="mx-1 text-line">|</span>
                <button class="text-brand hover:underline" @click="update(u, { is_admin: !u.is_admin }, u.is_admin ? `${u.email} bukan admin lagi` : `${u.email} sekarang admin`)">
                  {{ u.is_admin ? 'Cabut admin' : 'Jadikan admin' }}
                </button>
                <template v-if="u.two_factor_enabled">
                  <span class="mx-1 text-line">|</span>
                  <button class="text-warn hover:underline" @click="resetTwoFactor(u)">Reset 2FA</button>
                </template>
                <span class="mx-1 text-line">|</span>
                <button class="text-down hover:underline" @click="remove(u)">Hapus</button>
              </template>
            </td>
          </tr>
        </TransitionGroup>
      </table>
      <EmptyState v-else title="Belum ada pengguna" />
    </div>
  </div>
</template>
