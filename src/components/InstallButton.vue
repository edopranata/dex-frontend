<script setup lang="ts">
import { ref } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import { usePwaStore } from '@/stores/pwa'
import { useToastStore } from '@/stores/toast'

/** "Install aplikasi" in the toolbar while the app is not installed yet. */
const pwa = usePwaStore()
const toast = useToastStore()
const iosHelp = ref(false)

async function install() {
  const outcome = await pwa.install()
  if (outcome === 'ios') iosHelp.value = true
  else if (outcome === 'accepted') toast.success('Aplikasi dipasang', 'Buka DEX Simulator dari layar utama atau menu aplikasi.')
}
</script>

<template>
  <button v-if="pwa.canInstall" type="button" class="btn-primary h-9 px-3 text-xs" title="Pasang sebagai aplikasi di perangkat ini" @click="install">
    <AppIcon name="download" class="h-4 w-4" />
    <span class="hidden sm:inline">Install aplikasi</span>
  </button>

  <Teleport to="body">
    <Transition name="modal">
      <div v-if="iosHelp" class="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center" @click.self="iosHelp = false" @keydown.esc="iosHelp = false">
        <div class="modal-panel card w-full max-w-sm p-5 shadow-2xl shadow-black/50" role="dialog" aria-labelledby="ios-install-title">
          <h2 id="ios-install-title" class="font-semibold">Pasang di iPhone / iPad</h2>
          <ol class="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted">
            <li>Buka halaman ini di <span class="text-text">Safari</span>.</li>
            <li>Ketuk tombol <span class="text-text">Bagikan</span> (kotak dengan panah ke atas).</li>
            <li>Pilih <span class="text-text">Tambah ke Layar Utama</span>, lalu <span class="text-text">Tambah</span>.</li>
          </ol>
          <button class="btn-primary mt-4 w-full" @click="iosHelp = false">Mengerti</button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
