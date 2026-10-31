<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppIcon, { type IconName } from '@/components/AppIcon.vue'
import TokenAvatar from '@/components/TokenAvatar.vue'
import { tokenPath } from '@/lib/links'
import { type FeedCategory, type FeedEvent, useFeedStore } from '@/stores/feed'

/** Floating notices under the toolbar: a few at a time, the rest wait for their turn. */
const feed = useFeedStore()
const router = useRouter()

// On a phone, three notices would cover half of the screen.
const MAX_VISIBLE = window.matchMedia('(max-width: 639px)').matches ? 1 : 3
const VISIBLE_MS = 8000

const visible = computed(() => feed.notices.slice(0, MAX_VISIBLE))
const waiting = computed(() => Math.max(0, feed.notices.length - MAX_VISIBLE))
const paused = ref(false)
const timers = new Map<string, ReturnType<typeof setTimeout>>()

const icons: Record<FeedCategory, IconName> = { signal: 'signals', market: 'market', whale: 'whale', order: 'portfolio' }
const toneClass: Record<FeedEvent['tone'], string> = { up: 'text-up', down: 'text-down', warn: 'text-warn', info: 'text-brand' }

/** Each notice stays for its full time from the moment it can be seen, and stays while pointed at. */
function schedule() {
  for (const notice of visible.value) {
    if (paused.value || timers.has(notice.id)) continue
    timers.set(
      notice.id,
      setTimeout(() => {
        timers.delete(notice.id)
        feed.dismiss(notice.id)
      }, VISIBLE_MS),
    )
  }
}

function pause() {
  paused.value = true
  timers.forEach((timer) => clearTimeout(timer))
  timers.clear()
}

function resume() {
  paused.value = false
  schedule()
}

function open(notice: FeedEvent) {
  feed.dismiss(notice.id)
  router.push(tokenPath(notice.token))
}

watch(visible, schedule, { immediate: true })
onBeforeUnmount(pause)
</script>

<template>
  <div
    class="pointer-events-none fixed top-[5.75rem] right-4 z-[25] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2"
    aria-live="polite"
    @mouseenter="pause"
    @mouseleave="resume"
  >
    <TransitionGroup name="toast">
      <div v-for="notice in visible" :key="notice.id" class="pointer-events-auto flex items-start gap-1 rounded-xl border border-line bg-panel/95 shadow-xl shadow-black/20 backdrop-blur" role="status">
        <button type="button" class="flex min-w-0 flex-1 items-start gap-2.5 rounded-xl p-3 text-left" @click="open(notice)">
          <span class="relative shrink-0">
            <TokenAvatar :src="notice.token.image_url" :symbol="notice.token.symbol" :size="28" />
            <span class="absolute -right-1 -bottom-1 grid h-4 w-4 place-items-center rounded-full bg-panel" :class="toneClass[notice.tone]">
              <AppIcon :name="icons[notice.category]" class="h-3 w-3" />
            </span>
          </span>
          <span class="min-w-0">
            <span class="block text-sm font-medium">{{ notice.title }}</span>
            <span class="mt-0.5 block text-xs text-muted">{{ notice.body }}</span>
          </span>
        </button>
        <button type="button" class="shrink-0 p-2.5 text-muted transition hover:text-text" aria-label="Tutup notifikasi" @click="feed.dismiss(notice.id)">✕</button>
      </div>
    </TransitionGroup>
    <button v-if="waiting" type="button" class="pointer-events-auto self-end rounded-full border border-line bg-panel/95 px-3 py-1 text-xs text-muted shadow-lg backdrop-blur transition hover:text-text" @click="feed.clear()">
      {{ waiting }} lainnya · tutup semua
    </button>
  </div>
</template>
