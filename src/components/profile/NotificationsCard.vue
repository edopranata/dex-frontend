<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { api, errorMessage } from '@/lib/api'
import type { NotificationSettings } from '@/lib/types'
import { useToastStore } from '@/stores/toast'

const props = defineProps<{ settings: NotificationSettings; isAdmin: boolean; telegramLinked: boolean }>()
const emit = defineEmits<{ saved: [settings: NotificationSettings] }>()
const toast = useToastStore()

const form = reactive<NotificationSettings>({ ...props.settings })
const saving = ref(false)
watch(
  () => props.settings,
  (value) => Object.assign(form, value),
)

type ToggleKey = 'signals' | 'signal_updates' | 'risk' | 'watchlist' | 'daily_summary' | 'system'

const toggles: { key: ToggleKey; label: string; hint: string; adminOnly?: boolean }[] = [
  { key: 'signals', label: 'Sinyal beli baru', hint: 'Entry, stop loss, TP1–TP3, skor dan ringkasan analisis.' },
  { key: 'signal_updates', label: 'Perkembangan sinyal', hint: 'Masuk zona entry, TP tercapai, stop loss, sinyal batal/kedaluwarsa.' },
  { key: 'risk', label: 'Peringatan rug pull / honeypot', hint: 'Menandai jika Anda punya posisi di token tersebut.' },
  { key: 'watchlist', label: 'Token masuk/keluar Market', hint: 'Perubahan daftar Market otomatis.' },
  { key: 'daily_summary', label: 'Ringkasan harian', hint: 'Ekuitas & P&L Anda, hasil sinyal 24 jam, skor tertinggi.' },
  { key: 'system', label: 'Operasional server', hint: 'Job/jadwal gagal, AI dijeda, watchdog, backup gagal.', adminOnly: true },
]

const hours = Array.from({ length: 24 }, (_, h) => ({ value: h, label: `${String(h).padStart(2, '0')}:00` }))

async function save() {
  saving.value = true
  try {
    const { data } = await api.put<{ notifications: NotificationSettings }>('/profile/notifications', form)
    emit('saved', data.notifications)
    toast.success('Preferensi notifikasi disimpan')
  } catch (error) {
    toast.error('Gagal menyimpan', errorMessage(error))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <form class="card p-5" @submit.prevent="save">
    <h2 class="font-semibold">Notifikasi Telegram</h2>
    <p class="mt-0.5 text-xs text-muted">Pilih apa saja yang dikirim ke Telegram Anda. Berlaku hanya untuk akun ini.</p>
    <p v-if="!telegramLinked" class="mt-3 rounded-lg bg-warn/10 p-2.5 text-xs text-warn">Hubungkan Telegram dulu agar notifikasi bisa terkirim.</p>

    <ul class="mt-4 divide-y divide-line">
      <template v-for="t in toggles" :key="t.key">
        <li v-if="!t.adminOnly || isAdmin" class="flex items-center gap-3 py-2.5">
          <div class="min-w-0 flex-1">
            <p class="text-sm">{{ t.label }}</p>
            <p class="text-[11px] text-muted">{{ t.hint }}</p>
          </div>
          <button
            type="button"
            role="switch"
            :aria-checked="form[t.key]"
            :aria-label="t.label"
            class="relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200"
            :class="form[t.key] ? 'bg-up' : 'bg-panel-2 ring-1 ring-line'"
            @click="form[t.key] = !form[t.key]"
          >
            <span class="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200" :class="form[t.key] ? 'translate-x-5' : ''" />
          </button>
        </li>
      </template>
    </ul>

    <div class="mt-4 grid gap-4 sm:grid-cols-2">
      <label class="block">
        <span class="mb-1 block text-xs text-muted">Sinyal yang dikirim</span>
        <select v-model="form.signal_min" class="w-full">
          <option value="BUY">Buy &amp; Strong Buy</option>
          <option value="STRONG_BUY">Hanya Strong Buy</option>
        </select>
      </label>
      <label class="block">
        <span class="mb-1 block text-xs text-muted">Jam ringkasan harian (WIB)</span>
        <select v-model.number="form.daily_summary_hour" class="w-full" :disabled="!form.daily_summary">
          <option v-for="h in hours" :key="h.value" :value="h.value">{{ h.label }}</option>
        </select>
      </label>
      <div class="sm:col-span-2">
        <span class="mb-1 block text-xs text-muted">Jam tenang (WIB) — pesan masuk tanpa bunyi, kecuali stop loss, rug pull &amp; operasional</span>
        <div class="flex items-center gap-2">
          <select v-model.number="form.quiet_start_hour" class="flex-1">
            <option v-for="h in hours" :key="h.value" :value="h.value">{{ h.label }}</option>
          </select>
          <span class="text-muted">–</span>
          <select v-model.number="form.quiet_end_hour" class="flex-1">
            <option v-for="h in hours" :key="h.value" :value="h.value">{{ h.label }}</option>
          </select>
        </div>
        <span class="mt-1 block text-[11px] text-muted">{{ form.quiet_start_hour === form.quiet_end_hour ? 'Jam tenang nonaktif (jam mulai = selesai).' : 'Pilih jam yang sama untuk mematikan jam tenang.' }}</span>
      </div>
    </div>

    <div class="mt-5 flex justify-end">
      <button class="btn-primary" :disabled="saving">{{ saving ? 'Menyimpan…' : 'Simpan preferensi' }}</button>
    </div>
  </form>
</template>
