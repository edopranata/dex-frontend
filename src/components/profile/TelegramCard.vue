<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import { api, errorMessage } from '@/lib/api'
import { dateTime } from '@/lib/format'
import type { Profile } from '@/lib/types'
import { useConfirmStore } from '@/stores/confirm'
import { useToastStore } from '@/stores/toast'

const props = defineProps<{ status: Profile['telegram'] }>()
const emit = defineEmits<{ changed: [] }>()
const toast = useToastStore()

const busy = ref(false)
const link = ref<{ code: string; deep_link: string; bot_username: string; expires_at: string } | null>(null)
const now = ref(Date.now())
let poll: ReturnType<typeof setInterval> | undefined

const secondsLeft = computed(() => (link.value ? Math.max(0, Math.round((Date.parse(link.value.expires_at) - now.value) / 1000)) : 0))
const countdown = computed(() => `${Math.floor(secondsLeft.value / 60)}:${String(secondsLeft.value % 60).padStart(2, '0')}`)

function stopPolling() {
  if (poll) clearInterval(poll)
  poll = undefined
}

/** Wait for the bot to receive the code, then refresh the profile. */
function watchForLink() {
  stopPolling()
  poll = setInterval(async () => {
    now.value = Date.now()
    if (secondsLeft.value === 0) {
      stopPolling()
      return
    }
    if (Math.round(now.value / 1000) % 3 !== 0) return
    const { data } = await api.get<Profile>('/profile')
    if (data.telegram.linked) {
      stopPolling()
      link.value = null
      toast.success('Telegram terhubung', data.telegram.username ? `@${data.telegram.username}` : undefined)
      emit('changed')
    }
  }, 1000)
}

async function connect() {
  busy.value = true
  try {
    const { data } = await api.post('/profile/telegram')
    link.value = data
    now.value = Date.now()
    watchForLink()
  } catch (error) {
    toast.error('Gagal membuat kode', errorMessage(error))
  } finally {
    busy.value = false
  }
}

async function test() {
  busy.value = true
  try {
    const { data } = await api.post('/profile/telegram/test')
    data.ok ? toast.success('Pesan tes terkirim', 'Cek Telegram Anda.') : toast.error('Gagal mengirim', data.error)
  } catch (error) {
    toast.error('Gagal mengirim', errorMessage(error))
  } finally {
    busy.value = false
  }
}

async function disconnect() {
  if (!(await useConfirmStore().confirm({ title: 'Putuskan Telegram?', message: 'Notifikasi tidak akan dikirim lagi sampai Anda menautkannya kembali.', confirmLabel: 'Putuskan', tone: 'danger' }))) return
  await api.delete('/profile/telegram')
  toast.info('Telegram diputus')
  emit('changed')
}

function copyCode() {
  if (link.value) navigator.clipboard?.writeText(link.value.code).then(() => toast.info('Kode disalin'))
}

onBeforeUnmount(stopPolling)
</script>

<template>
  <section class="card p-4">
    <div class="flex items-start gap-3">
      <span class="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-400">
        <AppIcon name="send" class="h-5 w-5" />
      </span>
      <div>
        <h2 class="font-semibold">Telegram</h2>
        <p class="mt-0.5 text-xs text-muted">Notifikasi sinyal, TP/SL, peringatan risiko, dan ringkasan harian langsung ke Telegram Anda.</p>
      </div>
      <span class="ml-auto shrink-0 rounded px-2 py-0.5 text-xs" :class="props.status.linked ? 'bg-up/15 text-up' : 'bg-panel-2 text-muted'">
        {{ props.status.linked ? 'Terhubung' : 'Belum terhubung' }}
      </span>
    </div>

    <p v-if="!props.status.available" class="mt-4 rounded-lg bg-panel-2/60 p-3 text-sm text-muted">
      Notifikasi Telegram belum diaktifkan admin (Admin → Pengaturan → Bot Telegram).
    </p>

    <div v-else-if="props.status.linked" class="mt-4 space-y-3">
      <p class="text-sm">
        Terhubung<span v-if="props.status.username"> sebagai <span class="text-sky-600 dark:text-sky-400">@{{ props.status.username }}</span></span>
        <span class="text-xs text-muted"> · sejak {{ dateTime(props.status.linked_at) }}</span>
      </p>
      <p class="text-xs text-muted">Di Telegram: <span class="num text-text">/status</span> untuk ringkasan portofolio, <span class="num text-text">/stop</span> untuk berhenti.</p>
      <div class="flex flex-wrap gap-2">
        <button class="btn-ghost" :disabled="busy" @click="test">Kirim pesan tes</button>
        <button class="btn-ghost text-down" :disabled="busy" @click="disconnect">Putuskan</button>
      </div>
    </div>

    <div v-else-if="link && secondsLeft > 0" class="mt-4 space-y-3">
      <a :href="link.deep_link" target="_blank" rel="noopener" class="btn-primary w-full">Buka @{{ link.bot_username }} di Telegram lalu tekan Start</a>
      <p class="text-center text-xs text-muted">atau kirim kode ini ke <span class="text-text">@{{ link.bot_username }}</span>:</p>
      <button type="button" class="num block w-full rounded-lg border border-dashed border-line bg-bg py-3 text-center text-2xl tracking-[0.35em] hover:border-brand" title="Salin" @click="copyCode">
        {{ link.code }}
      </button>
      <p class="flex items-center justify-center gap-2 text-xs text-muted">
        <span class="h-2 w-2 animate-pulse rounded-full bg-sky-400" /> Menunggu kode diterima bot… berlaku {{ countdown }}
      </p>
    </div>

    <div v-else class="mt-4 space-y-3">
      <p class="text-sm text-muted">
        Kami membuat kode unik yang hanya muncul di akun Anda. Kirim kode itu ke bot, dan chat Telegram tersebut terhubung ke akun ini, jadi orang lain tidak bisa menautkan
        akun Anda.
      </p>
      <button class="btn-primary" :disabled="busy" @click="connect">{{ busy ? 'Membuat kode…' : link ? 'Buat kode baru' : 'Hubungkan Telegram' }}</button>
    </div>
  </section>
</template>
