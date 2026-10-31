<script setup lang="ts">
import { computed, ref } from 'vue'
import ContainerSparkline from '@/components/ContainerSparkline.vue'
import { usePolling } from '@/composables/usePolling'
import { api } from '@/lib/api'
import { bytes, timeAgo } from '@/lib/format'

type Status = 'ok' | 'warn' | 'down' | 'done'

interface Container {
  name: string
  project: string | null
  service: string | null
  status: Status
  label: string
  restarts: number
  started_at: string | null
  cpu_percent: number | null
  memory_mb: number | null
  history: { t: number; cpu: number | null; memory: number | null }[]
}

interface Overview {
  interval_seconds: number
  last_sampled_at: string | null
  stale: boolean
  host: { memory_total: number; memory_available: number; disk_total: number; disk_used: number; load: number; cores: number } | null
  containers: Container[]
}

const overview = ref<Overview | null>(null)

async function load() {
  const { data } = await api.get<Overview>('/admin/system/containers')
  overview.value = data
}

// The shortest interval that can be chosen in Pengaturan, so a new sample shows up soon at any setting.
usePolling(load, 10000)

const statusClass: Record<Status, string> = {
  ok: 'bg-up/15 text-up',
  warn: 'bg-warn/15 text-warn',
  down: 'bg-down/15 text-down',
  done: 'bg-panel-2 text-muted',
}

const dotClass: Record<Status, string> = { ok: 'bg-up', warn: 'bg-warn', down: 'bg-down', done: 'bg-muted' }

const problems = computed(() => overview.value?.containers.filter((c) => c.status === 'down' || c.status === 'warn').length ?? 0)

function cpu(value: number): string {
  return `${value.toFixed(value < 10 ? 2 : 1)}%`
}

function memory(value: number): string {
  return bytes(value * 1024 * 1024)
}

function uptime(container: Container): string {
  if (!container.started_at || container.status === 'down' || container.status === 'done') return '–'
  const minutes = Math.floor((Date.now() - new Date(container.started_at).getTime()) / 60000)
  if (minutes < 60) return `${minutes} mnt`
  if (minutes < 1440) return `${Math.floor(minutes / 60)} jam ${minutes % 60} mnt`
  return `${Math.floor(minutes / 1440)} hari ${Math.floor((minutes % 1440) / 60)} jam`
}
</script>

<template>
  <section v-if="overview" class="card overflow-hidden">
    <div class="flex flex-wrap items-center gap-x-6 gap-y-1 p-4 pb-2">
      <div class="mr-auto">
        <h2 class="card-title">Container</h2>
        <p class="mt-0.5 text-xs text-muted">
          {{ overview.containers.length }} container<span v-if="problems" class="text-down"> · {{ problems }} perlu perhatian</span>
          · tiap {{ overview.interval_seconds }} detik · terakhir {{ timeAgo(overview.last_sampled_at) }}
        </p>
      </div>
      <dl v-if="overview.host" class="flex flex-wrap gap-x-5 gap-y-1 text-xs">
        <div>
          <dt class="inline text-muted">Memori VPS </dt>
          <dd class="num inline">{{ bytes(overview.host.memory_total - overview.host.memory_available) }} / {{ bytes(overview.host.memory_total) }}</dd>
        </div>
        <div>
          <dt class="inline text-muted">Disk </dt>
          <dd class="num inline">{{ bytes(overview.host.disk_used) }} / {{ bytes(overview.host.disk_total) }}</dd>
        </div>
        <div>
          <dt class="inline text-muted">Beban </dt>
          <dd class="num inline">{{ overview.host.load.toFixed(2) }} ({{ overview.host.cores }} core)</dd>
        </div>
      </dl>
    </div>

    <p v-if="overview.stale && overview.containers.length" class="mx-4 mb-2 rounded-md bg-warn/15 px-3 py-2 text-xs text-warn">
      Data berhenti masuk. Angka di bawah adalah kondisi terakhir, bukan kondisi sekarang. Cek service <span class="num">dex-monitor</span> di VPS.
    </p>

    <div v-if="overview.containers.length" class="overflow-x-auto">
      <table class="table">
        <thead>
          <tr>
            <th>Container</th>
            <th>Status</th>
            <th class="text-right" title="100% = satu core penuh">CPU</th>
            <th>1 jam</th>
            <th class="text-right">Memori</th>
            <th>1 jam</th>
            <th class="text-right">Restart</th>
            <th class="text-right">Berjalan</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in overview.containers" :key="c.name">
            <td class="whitespace-nowrap" :title="c.name">
              <span class="font-medium">{{ c.service ?? c.name }}</span>
              <span v-if="c.project && c.project !== 'dex' && c.project !== c.service" class="ml-1.5 text-xs text-muted">{{ c.project }}</span>
            </td>
            <td class="whitespace-nowrap">
              <span class="inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-xs" :class="statusClass[c.status]">
                <span class="h-1.5 w-1.5 rounded-full" :class="dotClass[c.status]" />
                {{ c.label }}
              </span>
            </td>
            <td class="num text-right text-xs whitespace-nowrap">{{ c.cpu_percent === null ? '–' : cpu(c.cpu_percent) }}</td>
            <td><ContainerSparkline :points="c.history.map((h) => ({ t: h.t, value: h.cpu }))" label="CPU" :format="cpu" from-zero /></td>
            <td class="num text-right text-xs whitespace-nowrap">{{ c.memory_mb === null ? '–' : memory(c.memory_mb) }}</td>
            <td><ContainerSparkline :points="c.history.map((h) => ({ t: h.t, value: h.memory }))" label="Memori" :format="memory" /></td>
            <td class="num text-right text-xs" :class="c.restarts ? 'text-warn' : ''">{{ c.restarts }}</td>
            <td class="num text-right text-xs whitespace-nowrap text-muted">{{ uptime(c) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-else class="px-4 pb-4 text-sm text-muted">Belum ada data. Service <span class="num">dex-monitor</span> di VPS belum mengirim data.</p>
  </section>
  <div v-else class="skeleton h-64" />
</template>
