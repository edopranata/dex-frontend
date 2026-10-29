<script setup lang="ts">
import { explorerUrl, price, qty, shortAddress, timeAgo, usd } from '@/lib/format'
import type { WhaleTrade } from '@/lib/types'
import TokenAvatar from './TokenAvatar.vue'

defineProps<{ trades: WhaleTrade[]; chain?: string; showToken?: boolean }>()
</script>

<template>
  <div class="overflow-x-auto">
    <table class="table">
      <thead>
        <tr>
          <th>Waktu</th>
          <th v-if="showToken">Token</th>
          <th>Arah</th>
          <th class="text-right!">Nilai</th>
          <th class="text-right!">Harga</th>
          <th class="text-right!">Jumlah</th>
          <th>Wallet</th>
        </tr>
      </thead>
      <TransitionGroup tag="tbody" name="row">
        <tr v-for="trade in trades" :key="trade.id" class="transition-colors hover:bg-panel-2/50">
          <td class="whitespace-nowrap text-xs text-muted">{{ timeAgo(trade.traded_at) }}</td>
          <td v-if="showToken">
            <RouterLink v-if="trade.token" :to="`/tokens/${trade.token.id}`" class="flex items-center gap-2 hover:text-brand">
              <TokenAvatar :src="trade.token.image_url" :symbol="trade.token.symbol" :size="20" />
              {{ trade.token.symbol }}
            </RouterLink>
          </td>
          <td>
            <span class="rounded px-1.5 py-0.5 text-xs font-semibold uppercase" :class="trade.side === 'buy' ? 'bg-up/15 text-up' : 'bg-down/15 text-down'">
              {{ trade.side === 'buy' ? 'Beli' : 'Jual' }}
            </span>
          </td>
          <td class="num text-right font-medium">{{ usd(trade.amount_usd) }}</td>
          <td class="num text-right text-muted">{{ price(trade.price_usd) }}</td>
          <td class="num text-right text-muted">{{ qty(trade.token_amount) }}</td>
          <td class="num text-xs">
            <a
              v-if="trade.wallet && explorerUrl(chain ?? trade.token?.chain_id ?? '', 'address', trade.wallet)"
              :href="explorerUrl(chain ?? trade.token?.chain_id ?? '', 'address', trade.wallet)!"
              target="_blank"
              rel="noopener"
              class="text-brand hover:underline"
            >
              {{ shortAddress(trade.wallet) }}
            </a>
            <span v-else>{{ shortAddress(trade.wallet) }}</span>
          </td>
        </tr>
      </TransitionGroup>
    </table>
  </div>
</template>
