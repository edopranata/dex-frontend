<script setup lang="ts">
import { ref } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import AppSwitch from '@/components/AppSwitch.vue'
import { usePopover } from '@/composables/usePopover'
import { type FeedPreferences, useFeedStore } from '@/stores/feed'

/** Toolbar button: turn the running text and each kind of notice on or off, per device. */
const feed = useFeedStore()
const trigger = ref<HTMLButtonElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const { open, placement, style } = usePopover(trigger, panel)

const options: { key: keyof FeedPreferences; label: string; hint: string }[] = [
  { key: 'ticker', label: 'Running text', hint: 'Sinyal beli yang masih terbuka' },
  { key: 'signal', label: 'Sinyal', hint: 'Sinyal baru, entry, TP, dan SL' },
  { key: 'market', label: 'Token Market', hint: 'Token masuk dan keluar Market' },
  { key: 'whale', label: 'Whale', hint: 'Transaksi besar' },
  { key: 'order', label: 'Order saya', hint: 'Limit, TP, dan SL yang terisi' },
]
</script>

<template>
  <button ref="trigger" type="button" class="icon-btn h-9 w-9" aria-haspopup="dialog" :aria-expanded="open" aria-label="Pengaturan notifikasi" title="Running text & notifikasi" @click="open = !open">
    <AppIcon name="bell" class="h-[18px] w-[18px]" />
  </button>
  <Teleport to="body">
    <Transition name="pop">
      <div v-if="open" ref="panel" role="dialog" aria-label="Pengaturan notifikasi" class="popover-panel w-72 p-3" :data-placement="placement" :style="style" @keydown.esc="open = false">
        <p class="card-title mb-2">Tampilkan di perangkat ini</p>
        <div v-for="o in options" :key="o.key" class="flex items-center gap-3 py-1.5">
          <span class="min-w-0 flex-1">
            <span class="block text-sm">{{ o.label }}</span>
            <span class="block text-xs text-muted">{{ o.hint }}</span>
          </span>
          <AppSwitch v-model="feed.preferences[o.key]" :label="o.label" />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
