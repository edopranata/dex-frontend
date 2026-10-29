<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import Skeleton from '@/components/Skeleton.vue'
import { api, errorMessage } from '@/lib/api'
import { useToastStore } from '@/stores/toast'

interface Field {
  key: string
  label: string
  type: 'string' | 'secret' | 'int' | 'float' | 'bool' | 'select'
  description?: string
  options?: Record<string, string>
  min?: number
  max?: number
  step?: number
  value?: string | number | boolean | null
  default?: string | number | boolean | null
  overridden: boolean
  is_set?: boolean
  masked?: string | null
  source?: 'panel' | 'env' | null
}

interface AiStatus {
  enabled: boolean
  provider: string | null
  model: string | null
  paused_until: string | null
  reason: string | null
  requests_today: number
  max_per_day: number
  max_per_minute: number
  last_success_at: string | null
}

interface SettingsResponse {
  groups: Group[]
  ai_status: AiStatus
}

interface Group {
  key: string
  label: string
  description: string
  fields: Field[]
}

const toast = useToastStore()
const groups = ref<Group[] | null>(null)
const aiStatus = ref<AiStatus | null>(null)
const form = reactive<Record<string, unknown>>({})
const saving = ref<string | null>(null)
const testing = ref(false)
const telegramBusy = ref<'chats' | 'test' | null>(null)
const telegramChats = ref<{ bot: { username: string; name: string }; chats: { id: string; type: string; title: string }[] } | null>(null)
const telegramResult = ref<{ ok: boolean; bot: { username: string } | null; error: string | null } | null>(null)
const aiResult = ref<{ ok: boolean; provider: string | null; model: string | null; latency_ms: number | null; error: string | null } | null>(null)

function fill(data: SettingsResponse) {
  groups.value = data.groups
  aiStatus.value = data.ai_status
  for (const group of data.groups) {
    for (const field of group.fields) form[field.key] = field.type === 'secret' ? '' : field.value
  }
}

async function load() {
  const { data } = await api.get<SettingsResponse>('/admin/settings')
  fill(data)
}

onMounted(load)

function changedValues(group: Group): Record<string, unknown> {
  const values: Record<string, unknown> = {}
  for (const field of group.fields) {
    const value = form[field.key]
    if (field.type === 'secret') {
      if (typeof value === 'string' && value.trim() !== '') values[field.key] = value.trim()
    } else if (value !== field.value) {
      values[field.key] = value
    }
  }
  return values
}

async function save(group: Group) {
  const values = changedValues(group)
  if (!Object.keys(values).length) {
    toast.info('Tidak ada perubahan')
    return
  }
  saving.value = group.key
  try {
    const { data } = await api.put<SettingsResponse>('/admin/settings', { values })
    fill(data)
    toast.success(`${group.label} disimpan`, 'Berlaku langsung untuk request, jadwal, dan job berikutnya.')
  } catch (error) {
    toast.error('Gagal menyimpan', errorMessage(error))
  } finally {
    saving.value = null
  }
}

async function reset(field: Field) {
  if (!confirm(`Kembalikan "${field.label}" ke nilai dari .env?`)) return
  const { data } = await api.post<SettingsResponse>('/admin/settings/reset', { keys: [field.key] })
  fill(data)
  toast.info(`${field.label} dikembalikan ke .env`)
}

async function testAi() {
  testing.value = true
  aiResult.value = null
  try {
    const { data } = await api.post('/admin/settings/test-ai')
    aiResult.value = data
    await load()
  } catch (error) {
    toast.error('Tes AI gagal', errorMessage(error))
  } finally {
    testing.value = false
  }
}

async function findTelegramChats() {
  telegramBusy.value = 'chats'
  telegramResult.value = null
  try {
    const { data } = await api.post('/admin/telegram/chats')
    telegramChats.value = data
    if (!data.chats.length) toast.info('Belum ada chat', `Kirim /start ke @${data.bot.username} di Telegram, lalu klik lagi.`)
  } catch (error) {
    telegramChats.value = null
    toast.error('Gagal membaca chat', errorMessage(error))
  } finally {
    telegramBusy.value = null
  }
}

function useChat(id: string) {
  form['market.telegram.chat_id'] = id
  toast.info('Chat ID dipilih', 'Klik Simpan untuk memakainya.')
}

async function testTelegram() {
  telegramBusy.value = 'test'
  telegramResult.value = null
  try {
    const { data } = await api.post('/admin/telegram/test')
    telegramResult.value = data
  } catch (error) {
    toast.error('Tes Telegram gagal', errorMessage(error))
  } finally {
    telegramBusy.value = null
  }
}

function when(iso: string | null): string {
  if (!iso) return 'belum pernah'
  return new Date(iso).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '(kosong)'
  if (typeof value === 'boolean') return value ? 'Aktif' : 'Nonaktif'
  return String(value)
}
</script>

<template>
  <div class="space-y-5">
    <Skeleton v-if="!groups" :rows="4" height="h-40" />

    <form v-for="(group, gi) in groups ?? []" :key="group.key" class="card animate-fade-up p-5" :style="{ animationDelay: `${gi * 40}ms` }" @submit.prevent="save(group)">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="font-semibold">{{ group.label }}</h2>
          <p class="mt-0.5 text-xs text-muted">{{ group.description }}</p>
        </div>
        <button v-if="group.key === 'ai'" type="button" class="btn-ghost text-xs" :disabled="testing" @click="testAi">
          {{ testing ? 'Menguji…' : 'Tes koneksi AI' }}
        </button>
        <div v-if="group.key === 'telegram'" class="flex gap-2">
          <button type="button" class="btn-ghost text-xs" :disabled="telegramBusy !== null" @click="findTelegramChats">
            {{ telegramBusy === 'chats' ? 'Mencari…' : 'Cari chat ID' }}
          </button>
          <button type="button" class="btn-ghost text-xs" :disabled="telegramBusy !== null" @click="testTelegram">
            {{ telegramBusy === 'test' ? 'Mengirim…' : 'Kirim pesan tes' }}
          </button>
        </div>
      </div>

      <div v-if="group.key === 'ai' && aiStatus" class="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 rounded-lg bg-panel-2/60 px-3 py-2 text-xs">
        <span class="flex items-center gap-1.5">
          <span class="h-2 w-2 rounded-full" :class="!aiStatus.enabled ? 'bg-muted' : aiStatus.paused_until ? 'bg-amber-400' : 'bg-up'" />
          <span class="font-medium">{{ !aiStatus.enabled ? 'Nonaktif (pakai lexicon/template)' : aiStatus.paused_until ? `Dijeda sampai ${when(aiStatus.paused_until)}` : 'Aktif' }}</span>
        </span>
        <span class="text-muted">Request hari ini <span class="num text-text">{{ aiStatus.requests_today }} / {{ aiStatus.max_per_day }}</span></span>
        <span class="text-muted">Maks <span class="num text-text">{{ aiStatus.max_per_minute }}</span>/menit</span>
        <span class="text-muted">Terakhir berhasil <span class="text-text">{{ when(aiStatus.last_success_at) }}</span></span>
        <span v-if="aiStatus.reason" class="w-full text-amber-400">{{ aiStatus.reason }} — jeda dicabut otomatis saat pengaturan AI diubah atau tes koneksi berhasil.</span>
      </div>

      <Transition name="drop">
        <div
          v-if="group.key === 'ai' && aiResult"
          class="mt-3 rounded-lg border p-3 text-sm"
          :class="aiResult.ok ? 'border-up/40 bg-up/5 text-up' : 'border-down/40 bg-down/5 text-down'"
        >
          <template v-if="aiResult.ok">AI merespons: {{ aiResult.provider }} / {{ aiResult.model }} dalam {{ aiResult.latency_ms }} ms.</template>
          <template v-else>Gagal ({{ aiResult.provider ?? 'nonaktif' }}): {{ aiResult.error }}</template>
        </div>
      </Transition>

      <Transition name="drop">
        <div v-if="group.key === 'telegram' && telegramChats" class="mt-3 rounded-lg border border-line p-3 text-sm">
          <p class="text-xs text-muted">
            Bot <span class="text-text">@{{ telegramChats.bot.username }}</span>.
            {{ telegramChats.chats.length ? 'Chat yang baru mengirim pesan ke bot:' : `Belum ada chat — kirim /start ke @${telegramChats.bot.username}, lalu klik "Cari chat ID" lagi.` }}
          </p>
          <ul v-if="telegramChats.chats.length" class="mt-2 space-y-1">
            <li v-for="chat in telegramChats.chats" :key="chat.id" class="flex items-center justify-between gap-3 rounded bg-panel-2/60 px-2 py-1.5">
              <span>{{ chat.title }} <span class="text-xs text-muted">· {{ chat.type }} · <span class="num">{{ chat.id }}</span></span></span>
              <button type="button" class="text-xs text-brand hover:underline" :disabled="form['market.telegram.chat_id'] === chat.id" @click="useChat(chat.id)">
                {{ form['market.telegram.chat_id'] === chat.id ? 'Dipilih' : 'Pakai' }}
              </button>
            </li>
          </ul>
        </div>
      </Transition>

      <Transition name="drop">
        <div
          v-if="group.key === 'telegram' && telegramResult"
          class="mt-3 rounded-lg border p-3 text-sm"
          :class="telegramResult.ok ? 'border-up/40 bg-up/5 text-up' : 'border-down/40 bg-down/5 text-down'"
        >
          <template v-if="telegramResult.ok">Pesan tes terkirim lewat @{{ telegramResult.bot?.username }}. Cek Telegram Anda.</template>
          <template v-else>Gagal: {{ telegramResult.error }}</template>
        </div>
      </Transition>

      <div class="mt-4 grid gap-4 md:grid-cols-2">
        <label v-for="field in group.fields" :key="field.key" class="block">
          <span class="mb-1 flex items-center justify-between gap-2 text-xs">
            <span class="font-medium text-text">{{ field.label }}</span>
            <span v-if="field.overridden" class="flex items-center gap-2">
              <span class="rounded bg-brand/15 px-1.5 text-[10px] text-brand">diubah di panel</span>
              <button type="button" class="text-[10px] text-muted underline hover:text-text" @click="reset(field)">reset ke .env</button>
            </span>
          </span>

          <template v-if="field.type === 'secret'">
            <input v-model="form[field.key] as string" type="password" class="num w-full" autocomplete="new-password" :placeholder="field.is_set ? `Terisi ${field.masked} — kosongkan jika tidak diganti` : 'Belum diisi'" />
            <span class="mt-1 block text-[11px]" :class="field.is_set ? 'text-up' : 'text-muted'">
              {{ field.is_set ? `Terisi (${field.source === 'panel' ? 'dari panel' : 'dari .env'})` : 'Kosong' }}
            </span>
          </template>
          <select v-else-if="field.type === 'select'" v-model="form[field.key]" class="w-full">
            <option v-for="(label, value) in field.options" :key="value" :value="value">{{ label }}</option>
          </select>
          <span v-else-if="field.type === 'bool'" class="flex items-center gap-2 py-2">
            <button
              type="button"
              class="relative h-6 w-11 rounded-full transition-colors duration-200"
              :class="form[field.key] ? 'bg-up' : 'bg-panel-2 ring-1 ring-line'"
              role="switch"
              :aria-checked="!!form[field.key]"
              @click="form[field.key] = !form[field.key]"
            >
              <span class="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200" :class="form[field.key] ? 'translate-x-5' : ''" />
            </button>
            <span class="text-sm">{{ form[field.key] ? 'Aktif' : 'Nonaktif' }}</span>
          </span>
          <input
            v-else-if="field.type === 'int' || field.type === 'float'"
            v-model.number="form[field.key]"
            type="number"
            class="num w-full"
            :min="field.min"
            :max="field.max"
            :step="field.step ?? (field.type === 'int' ? 1 : 'any')"
          />
          <input v-else v-model="form[field.key] as string" class="w-full" />

          <span v-if="field.description" class="mt-1 block text-[11px] text-muted">{{ field.description }}</span>
          <span v-if="field.overridden && field.type !== 'secret'" class="mt-0.5 block text-[11px] text-muted">Nilai .env: {{ display(field.default) }}</span>
        </label>
      </div>

      <div class="mt-5 flex justify-end">
        <button class="btn-primary" :disabled="saving === group.key">{{ saving === group.key ? 'Menyimpan…' : 'Simpan' }}</button>
      </div>
    </form>
  </div>
</template>
