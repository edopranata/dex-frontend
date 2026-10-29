<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import EmptyState from '@/components/EmptyState.vue'
import Skeleton from '@/components/Skeleton.vue'
import { api } from '@/lib/api'
import { bytes } from '@/lib/format'

interface Entry {
  time: string
  env: string
  level: string
  message: string
  context: string
}

const files = ref<{ name: string; size: number }[]>([])
const file = ref<string>('')
const level = ref('')
const search = ref('')
const limit = ref(200)
const entries = ref<Entry[] | null>(null)
const truncated = ref(false)
const expanded = ref<Set<number>>(new Set())
const autoRefresh = ref(false)
let timer: ReturnType<typeof setInterval> | undefined

async function load() {
  const params: Record<string, unknown> = { limit: limit.value }
  if (file.value) params.file = file.value
  if (level.value) params.level = level.value
  if (search.value.trim()) params.search = search.value.trim()
  const { data } = await api.get('/admin/logs', { params })
  files.value = data.files
  file.value = data.file ?? ''
  entries.value = data.entries
  truncated.value = data.truncated
}

load()
watch([file, level, limit], load)
watch(autoRefresh, (on) => {
  clearInterval(timer)
  if (on) timer = setInterval(load, 10000)
})
onBeforeUnmount(() => clearInterval(timer))

function toggle(i: number) {
  const next = new Set(expanded.value)
  next.has(i) ? next.delete(i) : next.add(i)
  expanded.value = next
}

const levelClass: Record<string, string> = {
  debug: 'bg-panel-2 text-muted',
  info: 'bg-brand/15 text-brand',
  notice: 'bg-brand/15 text-brand',
  warning: 'bg-warn/15 text-warn',
  error: 'bg-down/15 text-down',
  critical: 'bg-down/25 text-down',
  alert: 'bg-down/25 text-down',
  emergency: 'bg-down/25 text-down',
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center gap-2">
      <select v-model="file" class="min-w-56">
        <option v-for="f in files" :key="f.name" :value="f.name">{{ f.name }} ({{ bytes(f.size) }})</option>
      </select>
      <select v-model="level">
        <option value="">Semua level</option>
        <option v-for="l in ['error', 'warning', 'info', 'debug', 'critical']" :key="l" :value="l">{{ l }}</option>
      </select>
      <form class="flex gap-2" @submit.prevent="load">
        <input v-model="search" placeholder="Cari teks…" class="w-48" />
        <button class="btn-ghost">Cari</button>
      </form>
      <select v-model.number="limit">
        <option :value="100">100 entri</option>
        <option :value="200">200 entri</option>
        <option :value="500">500 entri</option>
      </select>
      <label class="flex items-center gap-2 text-sm text-muted"><input v-model="autoRefresh" type="checkbox" class="h-4 w-4 p-0" /> Auto refresh 10 dtk</label>
      <a v-if="file" :href="`/api/admin/logs/${file}/download`" class="btn-ghost ml-auto text-xs" download>Download file</a>
    </div>

    <p v-if="truncated" class="text-xs text-warn">File besar: hanya ±2 MB terakhir yang ditampilkan. Download untuk melihat semuanya.</p>

    <div class="card overflow-hidden">
      <Skeleton v-if="entries === null" class="p-3" :rows="6" height="h-8" />
      <EmptyState v-else-if="!entries.length" title="Tidak ada entri log" description="Log aplikasi (error, peringatan API, dll.) muncul di sini. Output job & jadwal ada di tab Tugas terjadwal." />
      <ul v-else class="divide-y divide-line">
        <li v-for="(e, i) in entries" :key="`${e.time}-${i}`" class="px-4 py-2 text-sm">
          <button class="flex w-full items-start gap-3 text-left" :class="{ 'cursor-default': !e.context }" @click="e.context && toggle(i)">
            <span class="num shrink-0 pt-0.5 text-[11px] text-muted">{{ e.time.slice(5, 19) }}</span>
            <span class="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase" :class="levelClass[e.level] ?? 'bg-panel-2'">{{ e.level }}</span>
            <span class="min-w-0 flex-1 break-words">{{ e.message }}</span>
            <span v-if="e.context" class="shrink-0 text-xs text-muted">{{ expanded.has(i) ? '▾' : '▸' }}</span>
          </button>
          <Transition name="drop">
            <pre v-if="expanded.has(i)" class="num mt-2 max-h-80 overflow-auto rounded-lg bg-bg p-3 text-[11px] leading-relaxed text-muted">{{ e.context }}</pre>
          </Transition>
        </li>
      </ul>
    </div>
  </div>
</template>
