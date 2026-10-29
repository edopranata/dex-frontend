<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { api, errorMessage } from '@/lib/api'
import { pct, price, qty, usd } from '@/lib/format'
import type { Order, OrderType, Side, Token } from '@/lib/types'
import { useToastStore } from '@/stores/toast'

const props = defineProps<{ token: Token; balance: number; positionQuantity: number }>()
const emit = defineEmits<{ placed: [order: Order] }>()
const toast = useToastStore()

const FEE_RATE = 0.003

const side = ref<Side>('buy')
const type = ref<OrderType>('market')
const amountUsd = ref<number | null>(100)
const quantity = ref<number | null>(null)
const triggerPrice = ref<number | null>(null)
const submitting = ref(false)
const message = ref<{ ok: boolean; text: string } | null>(null)

const types = computed<{ value: OrderType; label: string }[]>(() =>
  side.value === 'buy'
    ? [
        { value: 'market', label: 'Market' },
        { value: 'limit', label: 'Limit' },
      ]
    : [
        { value: 'market', label: 'Market' },
        { value: 'limit', label: 'Limit' },
        { value: 'stop_loss', label: 'Stop Loss' },
        { value: 'take_profit', label: 'Take Profit' },
      ],
)

watch(side, () => {
  type.value = 'market'
  message.value = null
})

watch(type, (value) => {
  triggerPrice.value = value === 'market' ? null : props.token.price_usd
})

/** Constant-product price impact, mirroring the backend simulator. */
const estimate = computed(() => {
  const p = side.value === 'buy' && type.value !== 'market' ? triggerPrice.value : props.token.price_usd
  if (!p) return null
  const reserve = (props.token.liquidity_usd ?? 0) / 2

  if (side.value === 'buy') {
    const amount = amountUsd.value ?? 0
    const fee = amount * FEE_RATE
    const impact = reserve > 0 ? (amount - fee) / (reserve + amount - fee) : 0
    const fillPrice = p / (1 - impact)
    return { fee, impact, fillPrice, quantity: (amount - fee) / fillPrice, total: amount }
  }

  const q = Math.min(quantity.value ?? 0, props.positionQuantity)
  const gross = q * (triggerPrice.value ?? p)
  const impact = reserve > 0 ? gross / (reserve + gross) : 0
  const proceeds = gross * (1 - impact)
  return { fee: proceeds * FEE_RATE, impact, fillPrice: (triggerPrice.value ?? p) * (1 - impact), quantity: q, total: proceeds * (1 - FEE_RATE) }
})

function setFraction(fraction: number) {
  if (side.value === 'buy') amountUsd.value = Math.floor(props.balance * fraction * 100) / 100
  else quantity.value = props.positionQuantity * fraction
}

async function submit() {
  submitting.value = true
  message.value = null
  try {
    const { data } = await api.post<{ data: Order }>('/orders', {
      token_id: props.token.id,
      side: side.value,
      type: type.value,
      amount_usd: side.value === 'buy' ? amountUsd.value : null,
      quantity: side.value === 'sell' ? quantity.value : null,
      trigger_price: type.value === 'market' ? null : triggerPrice.value,
    })
    const order = data.data
    message.value =
      order.status === 'filled'
        ? { ok: true, text: `Terisi ${qty(order.filled_quantity)} ${props.token.symbol} @ ${price(order.filled_price)}` }
        : order.status === 'pending'
          ? { ok: true, text: 'Order pending dibuat. Akan dieksekusi saat harga tercapai.' }
          : { ok: false, text: order.note ?? 'Order ditolak.' }
    if (message.value.ok) toast.success(order.status === 'filled' ? 'Order terisi' : 'Order pending dibuat', message.value.text)
    else toast.error('Order ditolak', message.value.text)
    emit('placed', order)
  } catch (error) {
    message.value = { ok: false, text: errorMessage(error) }
    toast.error('Order gagal', message.value.text)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="card p-4">
    <div class="grid grid-cols-2 gap-1 rounded-lg bg-panel-2 p-1">
      <button class="btn py-1.5 duration-300" :class="side === 'buy' ? 'bg-up text-black shadow-md shadow-up/20' : 'text-muted hover:text-text'" @click="side = 'buy'">Beli</button>
      <button class="btn py-1.5 duration-300" :class="side === 'sell' ? 'bg-down text-white shadow-md shadow-down/20' : 'text-muted hover:text-text'" @click="side = 'sell'">Jual</button>
    </div>

    <div class="mt-3 flex flex-wrap gap-1">
      <button
        v-for="t in types"
        :key="t.value"
        class="rounded-md px-2 py-1 text-xs transition-colors duration-200"
        :class="type === t.value ? 'bg-panel-2 text-text ring-1 ring-line' : 'text-muted hover:text-text'"
        @click="type = t.value"
      >
        {{ t.label }}
      </button>
    </div>

    <form class="mt-3 space-y-3" @submit.prevent="submit">
      <Transition name="drop">
      <label v-if="type !== 'market'" class="block">
        <span class="mb-1 block text-xs text-muted">Harga pemicu (USD)</span>
        <input v-model.number="triggerPrice" type="number" step="any" min="0" class="num w-full" required />
      </label>
      </Transition>

      <label v-if="side === 'buy'" class="block">
        <span class="mb-1 flex justify-between text-xs text-muted">
          <span>Jumlah (USD)</span><span>Saldo {{ usd(balance) }}</span>
        </span>
        <input v-model.number="amountUsd" type="number" step="any" min="1" class="num w-full" required />
      </label>

      <label v-else class="block">
        <span class="mb-1 flex justify-between text-xs text-muted">
          <span>Jumlah ({{ token.symbol }})</span><span>Dimiliki {{ qty(positionQuantity) }}</span>
        </span>
        <input v-model.number="quantity" type="number" step="any" min="0" class="num w-full" required />
      </label>

      <div class="grid grid-cols-4 gap-1">
        <button v-for="f in [0.1, 0.25, 0.5, 1]" :key="f" type="button" class="btn-ghost py-1 text-xs" @click="setFraction(f)">{{ f * 100 }}%</button>
      </div>

      <dl v-if="estimate" class="space-y-1 rounded-lg bg-panel-2 p-3 text-xs">
        <div class="flex justify-between"><dt class="text-muted">Estimasi harga isi</dt><dd class="num">{{ price(estimate.fillPrice) }}</dd></div>
        <div class="flex justify-between"><dt class="text-muted">Estimasi {{ side === 'buy' ? 'diterima' : 'dijual' }}</dt><dd class="num">{{ qty(estimate.quantity) }} {{ token.symbol }}</dd></div>
        <div class="flex justify-between"><dt class="text-muted">Fee DEX (0.3%)</dt><dd class="num">{{ usd(estimate.fee) }}</dd></div>
        <div class="flex justify-between">
          <dt class="text-muted">Price impact</dt>
          <dd class="num" :class="estimate.impact > 0.02 ? 'text-down' : ''">{{ pct(estimate.impact * 100) }}</dd>
        </div>
        <div v-if="side === 'sell'" class="flex justify-between"><dt class="text-muted">Estimasi diterima</dt><dd class="num">{{ usd(estimate.total) }}</dd></div>
      </dl>
      <p v-if="estimate && estimate.impact > 0.02" class="text-xs text-down">Price impact di atas 2%: likuiditas pool tipis untuk ukuran order ini.</p>

      <button type="submit" class="w-full" :class="side === 'buy' ? 'btn-buy' : 'btn-sell'" :disabled="submitting || (side === 'sell' && positionQuantity <= 0)">
        {{ submitting ? 'Memproses…' : `${side === 'buy' ? 'Beli' : 'Jual'} ${token.symbol}` }}
      </button>

      <p v-if="message" class="text-xs" :class="message.ok ? 'text-up' : 'text-down'">{{ message.text }}</p>
    </form>
  </div>
</template>
