<script setup lang="ts">
const tabs = [
  { to: '/admin/settings', label: 'Pengaturan' },
  { to: '/admin/users', label: 'Pengguna' },
  { to: '/admin/backups', label: 'Backup' },
  { to: '/admin/logs', label: 'Log' },
  { to: '/admin/tasks', label: 'Tugas terjadwal' },
  { to: '/admin/system', label: 'Sistem' },
]
</script>

<template>
  <div class="space-y-5">
    <div>
      <h1 class="text-xl font-semibold">Admin</h1>
      <p class="mt-1 text-sm text-muted">Pengaturan aplikasi, pengguna, backup database, log, dan status server.</p>
    </div>

    <nav class="flex gap-1 overflow-x-auto border-b border-line">
      <RouterLink
        v-for="tab in tabs"
        :key="tab.to"
        :to="tab.to"
        class="-mb-px border-b-2 border-transparent px-3 py-2 text-sm whitespace-nowrap text-muted transition-colors hover:text-text"
        active-class="border-brand! text-text!"
      >
        {{ tab.label }}
      </RouterLink>
    </nav>

    <RouterView v-slot="{ Component }">
      <Transition name="page" mode="out-in">
        <component :is="Component" />
      </Transition>
    </RouterView>
  </div>
</template>
