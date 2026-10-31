<script setup lang="ts">
import { computed } from 'vue'
import TokenAvatar from '@/components/TokenAvatar.vue'
import { changeClass, pct, price } from '@/lib/format'
import { tokenPath } from '@/lib/links'
import { useFeedStore } from '@/stores/feed'

/** Running text under the toolbar: open buy signals, strongest first. Stops while pointed at. */
const feed = useFeedStore()

// A constant speed: more items take longer to pass.
const duration = computed(() => `${Math.max(20, feed.ticker.length * 6)}s`)
</script>

<template>
  <div v-if="feed.ticker.length" class="flex h-8 items-center border-t border-line text-xs" aria-label="Sinyal beli yang masih terbuka">
    <RouterLink to="/signals" class="z-10 flex h-full shrink-0 items-center border-r border-line px-3 font-semibold tracking-wide text-muted uppercase transition-colors hover:text-text sm:px-4 lg:pl-8 3xl:pl-12">
      Sinyal
    </RouterLink>
    <div class="ticker min-w-0 flex-1 overflow-hidden" :style="{ '--ticker-duration': duration }">
      <div class="ticker-track flex w-max">
        <ul v-for="copy in 2" :key="copy" class="ticker-group flex shrink-0 items-center" :aria-hidden="copy === 2">
          <li v-for="item in feed.ticker" :key="item.id">
            <RouterLink :to="tokenPath(item.token)" :tabindex="copy === 2 ? -1 : undefined" class="flex items-center gap-1.5 px-4 whitespace-nowrap transition-colors hover:text-brand">
              <span class="rounded px-1 text-[10px] font-semibold uppercase" :class="item.recommendation === 'STRONG_BUY' ? 'bg-up/20 text-up' : 'bg-up/10 text-up'">
                {{ item.recommendation === 'STRONG_BUY' ? 'Strong Buy' : 'Buy' }}
              </span>
              <TokenAvatar :src="item.token.image_url" :symbol="item.token.symbol" :size="16" />
              <span class="font-medium">{{ item.token.symbol }}</span>
              <span class="num text-muted">{{ price(item.token.price_usd) }}</span>
              <span class="num" :class="changeClass(item.token.change_h24)">{{ pct(item.token.change_h24) }}</span>
              <span class="text-muted">· {{ item.status === 'active' ? 'Sudah entry' : 'Menunggu entry' }}</span>
            </RouterLink>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ticker-track {
  animation: ticker var(--ticker-duration) linear infinite;
}

.ticker:hover .ticker-track,
.ticker:focus-within .ticker-track {
  animation-play-state: paused;
}

@keyframes ticker {
  to {
    transform: translateX(-50%);
  }
}

/* No movement for people who asked for that: the list can be scrolled by hand instead. */
@media (prefers-reduced-motion: reduce) {
  .ticker {
    overflow-x: auto;
  }

  .ticker-track {
    animation: none;
  }

  .ticker-group[aria-hidden='true'] {
    display: none;
  }
}
</style>
