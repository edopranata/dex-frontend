<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import EmptyState from '@/components/EmptyState.vue'
import Skeleton from '@/components/Skeleton.vue'
import { api, errorMessage } from '@/lib/api'
import { bytes, dateTime, timeAgo } from '@/lib/format'
import { useToastStore } from '@/stores/toast'

interface Backup {
  name: string
  size: number
  created_at: string
}

const toast = useToastStore()
const backups = ref<Backup[] | null>(null)
const lastBackupAt = ref<string | null>(null)
const availableAt = ref<string | null>(null)
const cooldown = ref(60)
const schedule = ref('')
const creating = ref(false)
const now = ref(Date.now())
const timer = setInterval(() => (now.value = Date.now()), 1000)
onBeforeUnmount(() => clearInterval(timer))

async function load() {
  const { data } = await api.get('/admin/backups')
  backups.value = data.data
  lastBackupAt.value = data.last_backup_at
  availableAt.value = data.manual_available_at
  cooldown.value = data.cooldown_minutes
  schedule.value = data.schedule
}

onMounted(load)

const remaining = computed(() => {
  if (!availableAt.value) return 0
  return Math.max(0, Math.ceil((new Date(availableAt.value).getTime() - now.value) / 1000))
})

const remainingLabel = computed(() => {
  const s = remaining.value
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
})

async function createBackup() {
  creating.value = true
  try {
    const { data } = await api.post('/admin/backups')
    toast.success('Backup selesai', `${data.data.name} (${bytes(data.data.size)})`)
    await load()
  } catch (error) {
    toast.error('Backup tidak dibuat', errorMessage(error))
    await load()
  } finally {
    creating.value = false
  }
}

async function remove(backup: Backup) {
  if (!confirm(`Hapus ${backup.name}? File tidak bisa dikembalikan.`)) return
  await api.delete(`/admin/backups/${backup.name}`)
  toast.info(`${backup.name} dihapus`)
  await load()
}
</script>

<template>
  <div class="space-y-4">
    <div class="card flex flex-wrap items-center gap-4 p-4">
      <div class="mr-auto">
        <div class="text-sm font-medium">Backup database</div>
        <div class="mt-0.5 text-xs text-muted">{{ schedule }}</div>
        <div class="mt-0.5 text-xs text-muted">
          Backup terakhir: <span class="text-text">{{ lastBackupAt ? `${dateTime(lastBackupAt)} (${timeAgo(lastBackupAt)})` : 'belum ada' }}</span>
        </div>
      </div>
      <div class="text-right">
        <button class="btn-primary" :disabled="creating || remaining > 0" @click="createBackup">
          {{ creating ? 'Membuat backup…' : 'Backup sekarang' }}
        </button>
        <div class="mt-1 text-[11px] text-muted">
          <template v-if="remaining > 0">Tersedia lagi dalam <span class="num text-warn">{{ remainingLabel }}</span> (jeda {{ cooldown }} menit sejak backup terakhir)</template>
          <template v-else>Maksimal 1× per {{ cooldown }} menit</template>
        </div>
      </div>
    </div>

    <div class="card overflow-x-auto">
      <Skeleton v-if="!backups" class="p-3" :rows="3" />
      <table v-else-if="backups.length" class="table">
        <thead>
          <tr>
            <th>File</th>
            <th>Dibuat</th>
            <th class="text-right!">Ukuran</th>
            <th />
          </tr>
        </thead>
        <TransitionGroup tag="tbody" name="row">
          <tr v-for="b in backups" :key="b.name">
            <td class="num text-sm">{{ b.name }}</td>
            <td class="text-xs whitespace-nowrap text-muted">{{ dateTime(b.created_at) }} · {{ timeAgo(b.created_at) }}</td>
            <td class="num text-right">{{ bytes(b.size) }}</td>
            <td class="whitespace-nowrap text-right text-xs">
              <a :href="`/api/admin/backups/${b.name}/download`" class="btn-ghost px-2 py-1 text-xs" download>Download</a>
              <button class="ml-2 text-down hover:underline" @click="remove(b)">Hapus</button>
            </td>
          </tr>
        </TransitionGroup>
      </table>
      <EmptyState v-else title="Belum ada backup" description="Backup otomatis dibuat setiap hari pukul 02:30 WIB, atau klik Backup sekarang." />
    </div>

    <p class="text-xs text-muted">
      Restore (di server): <code class="num text-text">gunzip -c FILE.sql.gz | docker compose exec -T mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"'</code>
    </p>
  </div>
</template>
