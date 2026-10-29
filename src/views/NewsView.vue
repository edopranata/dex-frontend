<script setup lang="ts">
import { ref, watch } from 'vue'
import EmptyState from '@/components/EmptyState.vue'
import NewsList from '@/components/NewsList.vue'
import { usePolling } from '@/composables/usePolling'
import { api } from '@/lib/api'
import type { NewsItem, Paginated } from '@/lib/types'

const items = ref<NewsItem[]>([])
const sentiment = ref<'' | 'bullish' | 'neutral' | 'bearish'>('')

async function load() {
  const { data } = await api.get<Paginated<NewsItem>>('/news', { params: sentiment.value ? { sentiment: sentiment.value } : {} })
  items.value = data.data
}

usePolling(load, 120000)
watch(sentiment, load)
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center gap-3">
      <h1 class="text-xl font-semibold">Berita & sentimen</h1>
      <select v-model="sentiment">
        <option value="">Semua sentimen</option>
        <option value="bullish">Bullish</option>
        <option value="neutral">Netral</option>
        <option value="bearish">Bearish</option>
      </select>
    </div>
    <p class="text-sm text-muted">
      Sumber: CoinDesk, Cointelegraph, Decrypt, The Block (RSS). Sentimen dinilai AI (Gemini/OpenAI) jika API key diisi, selain itu memakai kamus kata.
    </p>
    <section class="card px-4">
      <NewsList v-if="items.length" :items="items" />
      <EmptyState v-else title="Belum ada berita" />
    </section>
  </div>
</template>
