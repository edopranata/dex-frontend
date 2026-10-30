<script setup lang="ts">
import { computed, ref } from 'vue'
import { api, errorMessage } from '@/lib/api'
import { pct, price, timeAgo } from '@/lib/format'
import type { Analysis, Signal } from '@/lib/types'
import { useToastStore } from '@/stores/toast'
import RecommendationBadge from './RecommendationBadge.vue'
import ScoreBar from './ScoreBar.vue'

const props = defineProps<{ analysis: Analysis | null; signal: Signal | null; currentPrice: number | null; symbol: string }>()
const emit = defineEmits<{ followed: [] }>()
const toast = useToastStore()

const weights = { technical: 0.35, onchain: 0.2, whale: 0.15, sentiment: 0.15, fundamental: 0.15 }
const labels = { technical: 'Teknikal', onchain: 'On-chain / keamanan', whale: 'Whale', sentiment: 'Sentimen', fundamental: 'Fundamental pasar' }

const showReasons = ref(false)
const followAmount = ref(100)
const following = ref(false)
const followMessage = ref<{ ok: boolean; text: string } | null>(null)

const levels = computed(() => {
  const source = props.signal ?? props.analysis?.levels
  if (!source) return []
  const ref = props.currentPrice ?? props.analysis?.price ?? 0
  const rows: [string, number, string][] = [
    ['Take Profit 3', source.take_profit_3, 'text-up'],
    ['Take Profit 2', source.take_profit_2, 'text-up'],
    ['Take Profit 1', source.take_profit_1, 'text-up'],
    ['Entry atas', source.entry_high, 'text-brand'],
    ['Entry bawah', source.entry_low, 'text-brand'],
    ['Stop Loss', source.stop_loss, 'text-down'],
  ]
  return rows.map(([label, value, color]) => ({ label, value, color, distance: ref ? ((value - ref) / ref) * 100 : null }))
})

const signalStatus: Record<string, string> = {
  pending: 'Menunggu harga masuk zona entry',
  active: 'Aktif: harga sudah masuk zona entry',
}

async function follow() {
  if (!props.signal) return
  following.value = true
  followMessage.value = null
  try {
    await api.post(`/signals/${props.signal.id}/follow`, { amount_usd: followAmount.value })
    followMessage.value = { ok: true, text: 'Posisi dibuka beserta order SL dan TP1–TP3.' }
    toast.success(`Mengikuti sinyal ${props.symbol}`, followMessage.value.text)
    emit('followed')
  } catch (error) {
    followMessage.value = { ok: false, text: errorMessage(error) }
    toast.error('Gagal mengikuti sinyal', followMessage.value.text)
  } finally {
    following.value = false
  }
}

const providerLabel: Record<string, string> = { template: 'otomatis (tanpa AI)', gemini: 'AI · Google Gemini', xai: 'AI · xAI Grok', openai: 'AI · OpenAI' }
</script>

<template>
  <div class="card animate-fade-up p-4">
    <div class="flex items-start justify-between gap-3">
      <div>
        <div class="card-title">Analisis & rekomendasi</div>
        <div v-if="analysis" class="mt-1 text-xs text-muted">Timeframe {{ analysis.timeframe }} · {{ timeAgo(analysis.created_at) }}</div>
      </div>
      <div v-if="analysis" class="text-right">
        <RecommendationBadge :value="analysis.recommendation" size="lg" />
        <div class="num mt-1 text-2xl font-bold">{{ analysis.final_score }}<span class="text-sm text-muted">/100</span></div>
      </div>
    </div>

    <p v-if="!analysis" class="mt-4 text-sm text-muted">
      Belum ada analisis. Analisis berjalan otomatis setiap 15 menit setelah data candle tersedia.
    </p>

    <template v-else>
      <p v-if="analysis.summary" class="mt-3 rounded-lg bg-panel-2 p-3 text-sm leading-relaxed">
        {{ analysis.summary }}
        <span class="mt-1 block text-[11px] text-muted">Ringkasan: {{ providerLabel[analysis.summary_provider ?? ''] ?? analysis.summary_provider }}</span>
      </p>

      <div class="mt-4 space-y-2.5">
        <ScoreBar v-for="(label, key) in labels" :key="key" :label="label" :score="analysis.scores[key]" :weight="weights[key]" />
      </div>

      <div v-if="levels.length" class="mt-4">
        <div class="mb-2 flex items-center justify-between">
          <div class="card-title">Level trading</div>
          <span v-if="signal" class="text-[11px] text-muted">{{ signalStatus[signal.status] ?? signal.status }}</span>
        </div>
        <table class="w-full text-sm">
          <tbody>
            <tr v-for="row in levels" :key="row.label" class="border-t border-line">
              <td class="py-1.5 text-muted">{{ row.label }}</td>
              <td class="num py-1.5 text-right font-medium" :class="row.color">{{ price(row.value) }}</td>
              <td class="num w-20 py-1.5 text-right text-xs text-muted">{{ pct(row.distance) }}</td>
            </tr>
          </tbody>
        </table>
        <p class="mt-2 text-[11px] text-muted">TP = 1.5R / 2.5R / 4R. Stop loss berbasis ATR dan swing low terakhir.</p>
      </div>

      <form v-if="signal" class="mt-4 rounded-lg border border-up/30 bg-up/5 p-3" @submit.prevent="follow">
        <div class="text-sm font-medium">Ikuti sinyal ini</div>
        <p class="mt-0.5 text-xs text-muted">Beli market sekarang, lalu pasang stop loss dan take profit 1/3 posisi di TP1, TP2, TP3.</p>
        <div class="mt-2 flex gap-2">
          <input v-model.number="followAmount" type="number" min="1" step="any" class="num w-full" />
          <button class="btn-buy shrink-0" :disabled="following">{{ following ? '…' : `Beli ${symbol}` }}</button>
        </div>
        <p v-if="followMessage" class="mt-2 text-xs" :class="followMessage.ok ? 'text-up' : 'text-down'">{{ followMessage.text }}</p>
      </form>

      <button v-if="analysis.reasons?.length" class="mt-4 text-xs text-brand hover:underline" @click="showReasons = !showReasons">
        {{ showReasons ? 'Sembunyikan' : 'Lihat' }} alasan detail ({{ analysis.reasons.length }})
      </button>
      <Transition name="drop">
      <ul v-if="showReasons" class="mt-2 space-y-1 text-xs text-muted">
        <li v-for="(reason, i) in analysis.reasons" :key="i" class="animate-fade-up leading-relaxed" :style="{ animationDelay: `${i * 25}ms` }">• {{ reason }}</li>
      </ul>
      </Transition>
    </template>
  </div>
</template>
