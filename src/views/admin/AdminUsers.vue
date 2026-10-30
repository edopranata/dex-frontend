<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import EmptyState from '@/components/EmptyState.vue'
import Skeleton from '@/components/Skeleton.vue'
import { api, errorMessage } from '@/lib/api'
import { dateTime, usd } from '@/lib/format'
import { useAuthStore } from '@/stores/auth'
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
}

const auth = useAuthStore()
const toast = useToastStore()
const users = ref<AdminUser[] | null>(null)
const showForm = ref(false)
const saving = ref(false)
const form = reactive({ name: '', email: '', password: '', is_admin: false })

async function load() {
  const { data } = await api.get<{ data: AdminUser[] }>('/admin/users')
  users.value = data.data
}

onMounted(load)

async function create() {
  saving.value = true
  try {
    await api.post('/admin/users', form)
    toast.success(`Akun ${form.email} dibuat`, 'Kirim email & password ke pemiliknya lewat jalur yang aman.')
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

function resetPassword(user: AdminUser) {
  const password = prompt(`Password baru untuk ${user.email} (min. 8 karakter):`)
  if (password) update(user, { password }, `Password ${user.email} diganti`)
}

function resetTwoFactor(user: AdminUser) {
  if (confirm(`Matikan 2FA ${user.email}? Lakukan hanya jika pemiliknya kehilangan HP dan kode pemulihan, setelah identitasnya dipastikan.`)) {
    update(user, { disable_two_factor: true }, `2FA ${user.email} dimatikan`)
  }
}

async function remove(user: AdminUser) {
  if (!confirm(`Hapus akun ${user.email} beserta portofolio dan order-nya?`)) return
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
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <p class="text-sm text-muted">Pendaftaran publik bisa ditutup di Pengaturan → Simulator; tambah akun dari sini.</p>
      <button class="btn-primary" @click="showForm = !showForm">{{ showForm ? 'Batal' : '+ Tambah pengguna' }}</button>
    </div>

    <Transition name="drop">
      <form v-if="showForm" class="card grid gap-3 p-4 md:grid-cols-[1fr_1fr_1fr_auto_auto] md:items-end" @submit.prevent="create">
        <label class="block"><span class="mb-1 block text-xs text-muted">Nama</span><input v-model="form.name" class="w-full" required /></label>
        <label class="block"><span class="mb-1 block text-xs text-muted">Email</span><input v-model="form.email" type="email" class="w-full" required /></label>
        <label class="block"><span class="mb-1 block text-xs text-muted">Password</span><input v-model="form.password" type="password" class="w-full" minlength="8" autocomplete="new-password" required /></label>
        <label class="flex items-center gap-2 py-2 text-sm"><input v-model="form.is_admin" type="checkbox" class="h-4 w-4 p-0" /> Admin</label>
        <button class="btn-primary" :disabled="saving">{{ saving ? 'Menyimpan…' : 'Buat akun' }}</button>
      </form>
    </Transition>

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
            <td class="whitespace-nowrap">
              <span class="rounded px-1.5 py-0.5 text-xs" :class="u.two_factor_enabled ? 'bg-up/15 text-up' : 'bg-panel-2 text-muted'">{{ u.two_factor_enabled ? '2FA aktif' : 'Tanpa 2FA' }}</span>
              <span v-if="u.telegram_linked" class="ml-1 rounded bg-sky-500/15 px-1.5 py-0.5 text-xs text-sky-400">Telegram</span>
            </td>
            <td class="text-xs whitespace-nowrap text-muted">{{ dateTime(u.created_at) }}</td>
            <td class="whitespace-nowrap text-right text-xs">
              <span v-if="u.is_system" class="text-muted">Dikelola aplikasi</span>
              <button v-else class="text-brand hover:underline" @click="resetPassword(u)">Reset password</button>
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
