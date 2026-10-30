<script setup lang="ts">
import { timeAgo } from '@/lib/format'
import type { NewsItem } from '@/lib/types'
import SentimentPill from './SentimentPill.vue'
import { tokenPath } from '@/lib/links'

defineProps<{ items: NewsItem[] }>()
</script>

<template>
  <TransitionGroup tag="ul" name="row" class="divide-y divide-line">
    <li v-for="item in items" :key="item.id" class="py-3">
      <a :href="item.url" target="_blank" rel="noopener" class="text-sm leading-snug font-medium transition-colors hover:text-brand">{{ item.title }}</a>
      <div class="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted">
        <span>{{ item.source }}</span>
        <span>·</span>
        <span>{{ timeAgo(item.published_at) }}</span>
        <SentimentPill :label="item.sentiment_label" :score="item.sentiment_score" />
        <RouterLink v-for="token in item.tokens ?? []" :key="token.id" :to="tokenPath(token)" class="rounded bg-brand/10 px-1.5 py-0.5 text-brand">
          {{ token.symbol }}
        </RouterLink>
      </div>
    </li>
  </TransitionGroup>
</template>
