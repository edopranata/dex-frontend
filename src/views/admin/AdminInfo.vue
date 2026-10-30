<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import Skeleton from '@/components/Skeleton.vue'
import { api, errorMessage } from '@/lib/api'
import { useToastStore } from '@/stores/toast'

type State = 'ok' | 'warn' | 'error' | 'off' | 'info'

interface Service {
  key: string
  name: string
  purpose: string
  plan: string
  links: { label: string; url: string }[]
  status: { state: State; label: string; detail: string | null }
  configured_in: string | null
  note: string | null
}

interface Group {
  key: string
  label: string
  services: Service[]
}

const toast = useToastStore()
const groups = ref<Group[] | null>(null)
const appUrl = ref('')
const editing = ref<string | null>(null)
const draft = ref('')
const saving = ref(false)

async function load() {
  const { data } = await api.get<{ app_url: string; groups: Group[] }>('/admin/info')
  groups.value = data.groups
  appUrl.value = data.app_url
}

onMounted(load)

const stateClass: Record<State, string> = {
  ok: 'bg-up/15 text-up',
  warn: 'bg-warn/15 text-warn',
  error: 'bg-down/15 text-down',
  off: 'bg-panel-2 text-muted',
  info: 'bg-sky-500/15 text-sky-400',
}

const dotClass: Record<State, string> = { ok: 'bg-up', warn: 'bg-warn', error: 'bg-down', off: 'bg-muted', info: 'bg-sky-400' }

/** Services that need attention first, then the ones still to be set up. */
const summary = computed(() => {
  const all = (groups.value ?? []).flatMap((g) => g.services)
  return {
    total: all.length,
    running: all.filter((s) => s.status.state === 'ok' || s.status.state === 'info').length,
    problems: all.filter((s) => s.status.state === 'warn' || s.status.state === 'error'),
    off: all.filter((s) => s.status.state === 'off'),
  }
})

async function edit(service: Service) {
  editing.value = service.key
  draft.value = service.note ?? ''
  await nextTick()
  document.querySelector<HTMLTextAreaElement>(`#note-${service.key}`)?.focus()
}

async function saveNote(service: Service) {
  saving.value = true
  try {
    const { data } = await api.put<{ note: string | null }>(`/admin/info/${service.key}/note`, { note: draft.value })
    service.note = data.note
    editing.value = null
    toast.success(`Catatan ${service.name} disimpan`)
  } catch (error) {
    toast.error('Gagal menyimpan catatan', errorMessage(error))
  } finally {
    saving.value = false
  }
}

function host(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}
</script>

<template>
  <div class="space-y-6">
    <Skeleton v-if="!groups" :rows="4" height="h-32" />

    <template v-else>
      <div class="card flex flex-wrap items-center gap-x-6 gap-y-2 p-4 text-sm">
        <div class="mr-auto">
          <div class="font-medium">
            {{ summary.running }} dari {{ summary.total }} layanan berjalan
            <span v-if="summary.problems.length" class="text-warn">· {{ summary.problems.length }} perlu perhatian</span>
            <span v-if="summary.off.length" class="text-muted">· {{ summary.off.length }} belum diatur</span>
          </div>
          <div class="mt-0.5 text-xs text-muted">
            Aplikasi: <a :href="appUrl" target="_blank" rel="noopener" class="text-brand hover:underline">{{ host(appUrl) }}</a>
            · health check: <a :href="`${appUrl}/health`" target="_blank" rel="noopener" class="num text-brand hover:underline">/health</a>
          </div>
        </div>
        <div v-if="summary.problems.length || summary.off.length" class="flex flex-wrap gap-1.5 text-xs">
          <a v-for="s in [...summary.problems, ...summary.off]" :key="s.key" :href="`#service-${s.key}`" class="rounded px-1.5 py-0.5 hover:underline" :class="stateClass[s.status.state]">
            {{ s.name }}
          </a>
        </div>
      </div>

      <section v-for="group in groups" :key="group.key" class="space-y-2">
        <h2 class="card-title px-1">{{ group.label }}</h2>
        <div class="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          <article v-for="s in group.services" :id="`service-${s.key}`" :key="s.key" class="card flex scroll-mt-20 flex-col gap-2 p-4">
            <div class="flex items-start gap-2">
              <h3 class="mr-auto font-medium">{{ s.name }}</h3>
              <span class="flex shrink-0 items-center gap-1.5 rounded px-1.5 py-0.5 text-xs" :class="stateClass[s.status.state]">
                <span class="h-1.5 w-1.5 rounded-full" :class="dotClass[s.status.state]" />
                {{ s.status.label }}
              </span>
            </div>
            <p class="text-xs text-muted">{{ s.purpose }}</p>
            <p v-if="s.status.detail" class="text-xs break-words" :class="s.status.state === 'error' ? 'text-down' : 'text-text/80'">{{ s.status.detail }}</p>

            <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
              <dt class="text-muted">Biaya</dt>
              <dd>{{ s.plan }}</dd>
              <template v-if="s.configured_in">
                <dt class="text-muted">Diatur di</dt>
                <dd>{{ s.configured_in }}</dd>
              </template>
            </dl>

            <div v-if="s.links.length" class="flex flex-wrap gap-1.5">
              <a
                v-for="link in s.links"
                :key="link.url"
                :href="link.url"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-1 rounded-md border border-line px-2 py-0.5 text-xs text-brand transition-colors hover:border-brand/50 hover:bg-brand/10"
                :title="link.url"
              >
                {{ link.label }}
                <svg class="h-3 w-3" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M8 4H4v12h12v-4M11 3h6v6M17 3l-8 8" stroke-linecap="round" stroke-linejoin="round" /></svg>
              </a>
            </div>

            <div class="mt-auto border-t border-line pt-2">
              <form v-if="editing === s.key" class="space-y-2" @submit.prevent="saveNote(s)">
                <textarea
                  :id="`note-${s.key}`"
                  v-model="draft"
                  rows="3"
                  maxlength="2000"
                  class="w-full text-xs"
                  placeholder="Mis. akun login, paket, tanggal perpanjangan, URL panel…"
                  @keydown.esc="editing = null"
                />
                <div class="flex justify-end gap-2 text-xs">
                  <button type="button" class="btn-ghost px-2 py-1 text-xs" @click="editing = null">Batal</button>
                  <button class="btn-primary px-2 py-1 text-xs" :disabled="saving">{{ saving ? 'Menyimpan…' : 'Simpan' }}</button>
                </div>
              </form>
              <button v-else-if="s.note" type="button" class="w-full text-left text-xs whitespace-pre-line text-text/90 hover:text-text" title="Ubah catatan" @click="edit(s)">
                <span class="text-muted">Catatan: </span>{{ s.note }}
              </button>
              <button v-else type="button" class="text-xs text-muted transition-colors hover:text-brand" @click="edit(s)">+ Tambah catatan (akun, paket, perpanjangan)</button>
            </div>
          </article>
        </div>
      </section>

      <p class="text-xs text-muted">Jangan simpan password atau API key di catatan; catatan tidak dienkripsi. API key disimpan di Pengaturan (terenkripsi).</p>
    </template>
  </div>
</template>
