<script setup lang="ts">
import { ref, watch } from 'vue'
import EmptyState from '@/components/EmptyState.vue'
import Skeleton from '@/components/Skeleton.vue'
import { usePolling } from '@/composables/usePolling'
import { api, errorMessage } from '@/lib/api'
import { dateTime, duration, fromNow, timeAgo } from '@/lib/format'
import { useToastStore } from '@/stores/toast'
import AppSelect from '@/components/AppSelect.vue'

interface Task {
  command: string
  schedule: string
  last_status: string | null
  last_run_at: string | null
  last_duration_ms: number | null
  next_run_at: string | null
  runs_24h: number
  failures_24h: number
  avg_duration_ms: number | null
  can_run: boolean
}

interface Run {
  id: number
  command: string
  schedule: string | null
  trigger: 'schedule' | 'manual'
  status: string
  exit_code: number | null
  duration_ms: number | null
  output: string | null
  user: { id: number; name: string } | null
  created_at: string
  finished_at: string | null
}

const toast = useToastStore()
const tasks = ref<Task[] | null>(null)
const runs = ref<Run[]>([])
const allowed = ref<string[]>([])
const filterCommand = ref('')
const filterStatus = ref('')
const manualCommand = ref('market:discover')
const openRun = ref<number | null>(null)

async function load() {
  const params: Record<string, string> = {}
  if (filterCommand.value) params.command = filterCommand.value
  if (filterStatus.value) params.status = filterStatus.value
  const { data } = await api.get('/admin/tasks', { params })
  tasks.value = data.tasks
  runs.value = data.runs
  allowed.value = data.allowed
}

usePolling(load, 10000)
watch([filterCommand, filterStatus], load)

async function run(command: string) {
  try {
    await api.post('/admin/tasks/run', { command })
    toast.success(`${command} masuk antrean`, 'Hasil & output muncul di riwayat di bawah.')
    filterCommand.value = ''
    await load()
  } catch (error) {
    toast.error('Gagal menjalankan', errorMessage(error))
  }
}

const statusClass: Record<string, string> = {
  success: 'bg-up/15 text-up',
  failed: 'bg-down/15 text-down',
  skipped: 'bg-panel-2 text-muted',
  running: 'bg-brand/15 text-brand',
  queued: 'bg-warn/15 text-warn',
}

const statusLabel: Record<string, string> = { success: 'Berhasil', failed: 'Gagal', skipped: 'Dilewati', running: 'Berjalan', queued: 'Antre' }

function scheduleLabel(schedule: string | null): string {
  if (!schedule) return 'manual'
  const repeat = schedule.match(/\((\d+)s\)$/)
  if (repeat) return `tiap ${repeat[1]} detik`
  const map: Record<string, string> = {
    '0 * * * *': 'tiap jam',
    '*/10 * * * *': 'tiap 10 menit',
    '*/5 * * * *': 'tiap 5 menit',
    '5 * * * *': 'tiap jam (:05)',
    '10 * * * *': 'tiap jam (:10)',
    '40 * * * *': 'tiap jam (:40)',
    '3,18,33,48 * * * *': 'tiap 15 menit',
    '25,55 * * * *': 'tiap 30 menit',
    '15 */6 * * *': 'tiap 6 jam',
    '0 3 * * *': 'harian 03:00',
    '30 3 * * *': 'harian 03:30',
  }
  return map[schedule] ?? schedule
}
</script>

<template>
  <div class="stack-section">
    <div class="card flex flex-wrap items-end gap-3 p-4">
      <label class="block">
        <span class="mb-1 block text-xs text-muted">Jalankan perintah sekarang (lewat antrean)</span>
        <AppSelect v-model="manualCommand" class="min-w-56" :options="allowed.map((c) => ({ value: c, label: c }))" />
      </label>
      <button class="btn-primary" @click="run(manualCommand)">Jalankan</button>
      <p class="text-xs text-muted">market:bootstrap mengisi ulang semua data (±5 menit).</p>
    </div>

    <section class="card overflow-x-auto">
      <h2 class="card-title p-4 pb-2">Jadwal aktif</h2>
      <Skeleton v-if="!tasks" class="p-3" :rows="5" />
      <table v-else-if="tasks.length" class="table">
        <thead>
          <tr>
            <th>Perintah</th>
            <th>Jadwal</th>
            <th>Status terakhir</th>
            <th>Terakhir jalan</th>
            <th>Berikutnya</th>
            <th class="text-right!">Durasi (rata-rata)</th>
            <th class="text-right!">24 jam</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr v-for="t in tasks" :key="t.command" class="hover:bg-panel-2/40">
            <td class="num text-sm font-medium">{{ t.command }}</td>
            <td class="text-xs whitespace-nowrap text-muted">{{ scheduleLabel(t.schedule) }}</td>
            <td>
              <span v-if="t.last_status" class="rounded px-1.5 py-0.5 text-xs" :class="statusClass[t.last_status]">{{ statusLabel[t.last_status] ?? t.last_status }}</span>
              <span v-else class="text-xs text-muted">Belum jalan</span>
            </td>
            <td class="text-xs whitespace-nowrap text-muted">{{ t.last_run_at ? timeAgo(t.last_run_at) : '—' }}</td>
            <td class="text-xs whitespace-nowrap text-muted">{{ fromNow(t.next_run_at) }}</td>
            <td class="num text-right text-xs whitespace-nowrap">{{ duration(t.last_duration_ms) }} <span class="text-muted">({{ duration(t.avg_duration_ms) }})</span></td>
            <td class="num text-right text-xs">
              {{ t.runs_24h }}× <span v-if="t.failures_24h" class="text-down">· {{ t.failures_24h }} gagal</span>
            </td>
            <td class="whitespace-nowrap text-right text-xs">
              <button class="text-brand hover:underline" @click="filterCommand = t.command">Riwayat</button>
              <template v-if="t.can_run">
                <span class="mx-1 text-line">|</span><button class="text-brand hover:underline" @click="run(t.command)">Jalankan</button>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
      <EmptyState v-else title="Jadwal kosong" description="Tidak ada tugas di jadwal aplikasi." />
    </section>

    <section class="card overflow-x-auto">
      <div class="flex flex-wrap items-center gap-2 p-4 pb-2">
        <h2 class="card-title mr-auto">Riwayat eksekusi (100 terakhir)</h2>
        <AppSelect v-model="filterCommand" aria-label="Perintah" :options="[{ value: '', label: 'Semua perintah' }, ...(tasks ?? []).map((t) => ({ value: t.command, label: t.command }))]" />
        <AppSelect v-model="filterStatus" aria-label="Status" :options="[{ value: '', label: 'Semua status' }, ...Object.entries(statusLabel).map(([value, label]) => ({ value, label }))]" />
      </div>
      <table v-if="runs.length" class="table">
        <thead>
          <tr>
            <th>Waktu</th>
            <th>Perintah</th>
            <th>Pemicu</th>
            <th>Status</th>
            <th class="text-right!">Durasi</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <template v-for="r in runs" :key="r.id">
            <tr>
              <td class="text-xs whitespace-nowrap text-muted">{{ dateTime(r.finished_at ?? r.created_at) }}</td>
              <td class="num text-sm">{{ r.command }}</td>
              <td class="text-xs text-muted">{{ r.trigger === 'manual' ? `manual · ${r.user?.name ?? '?'}` : scheduleLabel(r.schedule) }}</td>
              <td>
                <span class="rounded px-1.5 py-0.5 text-xs" :class="statusClass[r.status]">{{ statusLabel[r.status] ?? r.status }}</span>
                <span v-if="r.exit_code" class="ml-1 text-[11px] text-down">exit {{ r.exit_code }}</span>
              </td>
              <td class="num text-right text-xs">{{ duration(r.duration_ms) }}</td>
              <td class="text-right text-xs">
                <button v-if="r.output" class="text-brand hover:underline" @click="openRun = openRun === r.id ? null : r.id">{{ openRun === r.id ? 'Tutup' : 'Output' }}</button>
              </td>
            </tr>
            <tr v-if="openRun === r.id">
              <td colspan="6">
                <pre class="num max-h-80 overflow-auto rounded-lg bg-bg p-3 text-[11px] leading-relaxed whitespace-pre-wrap text-muted">{{ r.output }}</pre>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
      <EmptyState v-else title="Tidak ada eksekusi pada filter ini" />
    </section>
  </div>
</template>
