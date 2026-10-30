<script setup lang="ts">
import { usePageData } from '@/composables/usePolling'
import { reactive, ref } from 'vue'
import Skeleton from '@/components/Skeleton.vue'
import { api, errorMessage } from '@/lib/api'
import { useToastStore } from '@/stores/toast'
import AppSelect from '@/components/AppSelect.vue'
import AppSwitch from '@/components/AppSwitch.vue'

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

interface AiProviderStatus {
  provider: string
  label: string
  role: 'primary' | 'fallback'
  model: string | null
  paused_until: string | null
  reason: string | null
  requests_today: number
  max_per_day: number
  max_per_minute: number
  last_success_at: string | null
}

interface AiStatus {
  enabled: boolean
  providers: AiProviderStatus[]
}

interface MailTest {
  ok: boolean
  to?: string
  provider?: string
  latency_ms?: number
  error?: string
}

interface AiPing {
  ok: boolean
  provider: string | null
  label: string | null
  model: string | null
  latency_ms: number | null
  error: string | null
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
interface TelegramStatus {
  active: boolean
  bot: { username: string; name: string } | null
  webhook: { url: string; expected_url: string; connected: boolean; pending: number; last_error: string | null; last_error_at: string | null } | null
  linked_users: number
  error: string | null
}

const telegram = ref<TelegramStatus | null>(null)
const connecting = ref(false)
const aiResult = ref<AiPing[] | null>(null)
const testingMail = ref(false)
const mailResult = ref<MailTest | null>(null)

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

usePageData(() => Promise.all([load(), loadTelegram()]))

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
    if (group.key === 'telegram') loadTelegram()
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
    const { data } = await api.post<AiPing[]>('/admin/settings/test-ai')
    aiResult.value = data
    await load()
  } catch (error) {
    toast.error('Tes AI gagal', errorMessage(error))
  } finally {
    testing.value = false
  }
}

async function testMail() {
  testingMail.value = true
  mailResult.value = null
  try {
    const { data } = await api.post<MailTest>('/admin/settings/test-mail')
    mailResult.value = data
  } catch (error) {
    mailResult.value = { ok: false, error: errorMessage(error) }
  } finally {
    testingMail.value = false
  }
}

async function loadTelegram() {
  const { data } = await api.get<TelegramStatus>('/admin/telegram')
  telegram.value = data
}

async function connectWebhook() {
  connecting.value = true
  try {
    const { data } = await api.post<TelegramStatus>('/admin/telegram/webhook')
    telegram.value = data
    toast.success('Webhook dipasang')
  } catch (error) {
    toast.error('Gagal memasang webhook', errorMessage(error))
  } finally {
    connecting.value = false
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
  <div class="stack-section">
    <Skeleton v-if="!groups" :rows="4" height="h-40" />

    <form v-for="(group, gi) in groups ?? []" :key="group.key" class="card animate-fade-up p-4" :style="{ animationDelay: `${gi * 40}ms` }" @submit.prevent="save(group)">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="font-semibold">{{ group.label }}</h2>
          <p class="mt-0.5 text-xs text-muted">{{ group.description }}</p>
        </div>
        <button v-if="group.key === 'ai'" type="button" class="btn-ghost text-xs" :disabled="testing" @click="testAi">
          {{ testing ? 'Menguji…' : 'Tes koneksi AI' }}
        </button>
        <button v-if="group.key === 'mail'" type="button" class="btn-ghost text-xs" :disabled="testingMail" @click="testMail">
          {{ testingMail ? 'Mengirim…' : 'Kirim email tes' }}
        </button>
      </div>

      <p v-if="group.key === 'mail' && mailResult" class="mt-3 flex items-start gap-1.5 rounded-lg bg-panel-2/60 px-3 py-2 text-xs">
        <span class="mt-1 h-2 w-2 shrink-0 rounded-full" :class="mailResult.ok ? 'bg-up' : 'bg-down'" />
        <span v-if="mailResult.ok">Email tes terkirim ke <span class="text-text">{{ mailResult.to }}</span> via {{ mailResult.provider }} ({{ mailResult.latency_ms }} ms). Cek kotak masuk dan folder spam.</span>
        <span v-else class="break-words text-down">{{ mailResult.error }}</span>
      </p>

      <div v-if="group.key === 'ai' && aiStatus" class="mt-3 space-y-1.5">
        <p v-if="!aiStatus.enabled" class="flex items-center gap-1.5 rounded-lg bg-panel-2/60 px-3 py-2 text-xs">
          <span class="h-2 w-2 rounded-full bg-muted" />
          <span class="font-medium">Nonaktif (pakai lexicon/template)</span>
        </p>
        <div v-for="p in aiStatus.providers" :key="p.provider" class="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-lg bg-panel-2/60 px-3 py-2 text-xs">
          <span class="flex items-center gap-1.5">
            <span class="h-2 w-2 rounded-full" :class="p.paused_until ? 'bg-amber-400' : 'bg-up'" />
            <span class="font-medium">{{ p.label }}</span>
            <span class="badge-mini" :class="p.role === 'primary' ? 'bg-brand/15 text-brand' : 'bg-panel text-muted ring-1 ring-line'">{{ p.role === 'primary' ? 'Utama' : 'Cadangan' }}</span>
            <span class="text-muted">{{ p.paused_until ? `dijeda sampai ${when(p.paused_until)}` : 'aktif' }}</span>
          </span>
          <span class="num text-muted">{{ p.model }}</span>
          <span class="text-muted">Hari ini <span class="num text-text">{{ p.requests_today }} / {{ p.max_per_day }}</span></span>
          <span class="text-muted">Maks <span class="num text-text">{{ p.max_per_minute }}</span>/menit</span>
          <span class="text-muted">Terakhir berhasil <span class="text-text">{{ when(p.last_success_at) }}</span></span>
          <span v-if="p.reason" class="w-full text-amber-600 dark:text-amber-400">{{ p.reason }} — jeda dicabut otomatis saat pengaturan AI diubah atau tes koneksi berhasil.</span>
        </div>
      </div>

      <Transition name="drop">
        <ul v-if="group.key === 'ai' && aiResult" class="mt-3 space-y-1.5">
          <li
            v-for="r in aiResult"
            :key="r.provider ?? 'none'"
            class="rounded-lg border p-3 text-sm"
            :class="r.ok ? 'border-up/40 bg-up/5 text-up' : 'border-down/40 bg-down/5 text-down'"
          >
            <template v-if="r.ok">{{ r.label }} merespons: {{ r.model }} dalam {{ r.latency_ms }} ms.</template>
            <template v-else>Gagal ({{ r.label ?? 'nonaktif' }}): {{ r.error }}</template>
          </li>
        </ul>
      </Transition>

      <div v-if="group.key === 'telegram' && telegram" class="mt-3 space-y-2 rounded-lg bg-panel-2/60 px-3 py-2.5 text-xs">
        <div class="flex flex-wrap items-center gap-x-5 gap-y-1">
          <span class="flex items-center gap-1.5">
            <span class="h-2 w-2 rounded-full" :class="!telegram.active ? 'bg-muted' : telegram.webhook?.connected ? 'bg-up' : 'bg-down'" />
            <span class="font-medium">{{ !telegram.active ? 'Nonaktif' : telegram.webhook?.connected ? 'Webhook terhubung' : 'Webhook belum terpasang' }}</span>
          </span>
          <span v-if="telegram.bot" class="text-muted">Bot <a :href="`https://t.me/${telegram.bot.username}`" target="_blank" rel="noopener" class="text-sky-600 dark:text-sky-400 hover:underline">@{{ telegram.bot.username }}</a></span>
          <span class="text-muted">Pengguna terhubung <span class="num text-text">{{ telegram.linked_users }}</span></span>
          <span v-if="telegram.webhook?.pending" class="text-muted">Antrean pesan <span class="num text-text">{{ telegram.webhook.pending }}</span></span>
          <button v-if="telegram.active" type="button" class="ml-auto text-brand hover:underline" :disabled="connecting" @click="connectWebhook">
            {{ connecting ? 'Memasang…' : 'Pasang ulang webhook' }}
          </button>
        </div>
        <p v-if="telegram.error" class="text-down">{{ telegram.error }}</p>
        <p v-if="telegram.webhook?.last_error" class="text-down">
          Error terakhir dari Telegram ({{ when(telegram.webhook.last_error_at) }}): {{ telegram.webhook.last_error }}
        </p>
        <p v-if="telegram.webhook && !telegram.webhook.connected && telegram.webhook.url" class="text-warn">Webhook mengarah ke {{ telegram.webhook.url }}, bukan {{ telegram.webhook.expected_url }}.</p>
        <p class="text-muted">Setiap pengguna menghubungkan Telegram-nya sendiri dengan kode unik di <RouterLink to="/profile/telegram" class="text-brand hover:underline">Profil → Telegram</RouterLink>.</p>
      </div>

      <div class="mt-4 grid gap-4 md:grid-cols-2 3xl:grid-cols-3">
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
          <AppSelect
            v-else-if="field.type === 'select'"
            v-model="form[field.key] as string"
            class="w-full"
            :options="Object.entries(field.options ?? {}).map(([value, label]) => ({ value, label }))"
          />
          <span v-else-if="field.type === 'bool'" class="flex items-center gap-2 py-2">
            <AppSwitch v-model="form[field.key] as boolean" :label="field.label" />
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
