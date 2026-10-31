<script setup lang="ts">
import { ref } from 'vue'
import Skeleton from '@/components/Skeleton.vue'
import StatCard from '@/components/StatCard.vue'
import { usePolling } from '@/composables/usePolling'
import { api, errorMessage } from '@/lib/api'
import { dateTime, timeAgo } from '@/lib/format'
import { useConfirmStore } from '@/stores/confirm'
import { useToastStore } from '@/stores/toast'

interface System {
  app: { env: string; debug: boolean; php: string; laravel: string; timezone: string; url: string }
  database: { driver: string; size_mb: number | null; rows: Record<string, number> }
  queue: { connection: string; pending: number | null; failed: number; queues?: { default: number | null; market_data: number | null } }
  redis: { memory: string | null } | null
  scheduler: { last_run_at: string | null; failures_24h: number }
  disk: { free_gb: number; total_gb: number }
  failed_jobs: { uuid: string; queue: string; job: string; error: string; failed_at: string }[]
}

const toast = useToastStore()
const dialog = useConfirmStore()
const system = ref<System | null>(null)

async function load() {
  const { data } = await api.get<System>('/admin/system')
  system.value = data
}

usePolling(load, 15000)

async function action(request: Promise<unknown>, message: string) {
  try {
    await request
    toast.success(message)
    await load()
  } catch (error) {
    toast.error('Gagal', errorMessage(error))
  }
}

async function clearCache() {
  const confirmed = await dialog.confirm({ title: 'Bersihkan cache aplikasi?', message: 'Data sementara dibuat ulang, jadi halaman bisa melambat sebentar, dan batas request API ikut direset.', confirmLabel: 'Bersihkan' })
  if (confirmed) action(api.post('/admin/system/cache/clear'), 'Cache dibersihkan')
}

async function forgetJob(job: System['failed_jobs'][number]) {
  const confirmed = await dialog.confirm({ title: 'Hapus job gagal ini?', message: `${job.job} dihapus dari daftar dan tidak bisa dijalankan ulang.`, confirmLabel: 'Hapus', tone: 'danger' })
  if (confirmed) action(api.delete(`/admin/system/failed-jobs/${job.uuid}`), 'Job dihapus')
}

function schedulerHealthy(at: string | null): boolean {
  return !!at && Date.now() - new Date(at).getTime() < 120000
}
</script>

<template>
  <div v-if="system" class="stack-section">
    <div class="grid grid-cols-2 gap-section lg:grid-cols-4">
      <StatCard
        label="Scheduler"
        :value="schedulerHealthy(system.scheduler.last_run_at) ? 'Berjalan' : 'Tidak aktif?'"
        :tone="schedulerHealthy(system.scheduler.last_run_at) ? 'up' : 'down'"
        :hint="`Terakhir ${timeAgo(system.scheduler.last_run_at)} · ${system.scheduler.failures_24h} gagal/24j`"
      />
      <StatCard
        label="Antrean job"
        :value="`${system.queue.pending ?? '–'} menunggu`"
        :tone="system.queue.failed ? 'down' : undefined"
        :hint="system.queue.queues
          ? `${system.queue.queues.default ?? '–'} cepat · ${system.queue.queues.market_data ?? '–'} data pasar · ${system.queue.failed} gagal`
          : `${system.queue.failed} job gagal · ${system.queue.connection}`"
      />
      <StatCard label="Database" :value="system.database.size_mb !== null ? `${system.database.size_mb} MB` : system.database.driver" :hint="`Redis: ${system.redis?.memory ?? '–'}`" />
      <StatCard label="Disk" :value="`${system.disk.free_gb} GB kosong`" :hint="`dari ${system.disk.total_gb} GB`" :tone="system.disk.free_gb < 5 ? 'down' : undefined" />
    </div>

    <div class="grid gap-section lg:grid-cols-2">
      <section class="card p-4">
        <h2 class="card-title">Jumlah data</h2>
        <dl class="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <template v-for="(count, label) in system.database.rows" :key="label">
            <dt class="text-muted">{{ label }}</dt>
            <dd class="num text-right">{{ count.toLocaleString('id-ID') }}</dd>
          </template>
        </dl>
      </section>

      <section class="card p-4">
        <h2 class="card-title">Aplikasi</h2>
        <dl class="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <dt class="text-muted">Environment</dt><dd class="text-right">{{ system.app.env }} <span v-if="system.app.debug" class="text-down">(debug aktif!)</span></dd>
          <dt class="text-muted">URL</dt><dd class="num truncate text-right">{{ system.app.url }}</dd>
          <dt class="text-muted">PHP / Laravel</dt><dd class="num text-right">{{ system.app.php }} / {{ system.app.laravel }}</dd>
          <dt class="text-muted">Zona waktu app</dt><dd class="text-right">{{ system.app.timezone }}</dd>
        </dl>
        <button class="btn-ghost mt-4 text-xs" @click="clearCache">Bersihkan cache aplikasi</button>
      </section>
    </div>

    <section class="card overflow-x-auto">
      <h2 class="card-title p-4 pb-2">Job gagal</h2>
      <table v-if="system.failed_jobs.length" class="table">
        <thead>
          <tr>
            <th>Waktu</th>
            <th>Job</th>
            <th>Error</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr v-for="job in system.failed_jobs" :key="job.uuid">
            <td class="text-xs whitespace-nowrap text-muted">{{ dateTime(job.failed_at) }}</td>
            <td class="num text-xs">{{ job.job }}</td>
            <td class="text-xs text-down">{{ job.error }}</td>
            <td class="whitespace-nowrap text-right text-xs">
              <button class="text-brand hover:underline" @click="action(api.post(`/admin/system/failed-jobs/${job.uuid}/retry`), 'Job dijalankan ulang')">Retry</button>
              <span class="mx-1 text-line">|</span>
              <button class="text-down hover:underline" @click="forgetJob(job)">Hapus</button>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-else class="px-4 pb-4 text-sm text-up">Tidak ada job gagal.</p>
    </section>
  </div>
  <Skeleton v-else :rows="4" height="h-24" />
</template>
