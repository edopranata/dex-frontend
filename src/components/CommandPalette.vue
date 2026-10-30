<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppIcon, { type IconName } from '@/components/AppIcon.vue'
import TokenAvatar from '@/components/TokenAvatar.vue'
import { api } from '@/lib/api'
import { changeClass, pct, price } from '@/lib/format'
import { tokenPath } from '@/lib/links'
import { adminNav, profileNav, tradingNav } from '@/lib/navigation'
import type { Token } from '@/lib/types'
import { useAuthStore } from '@/stores/auth'

/**
 * Toolbar search (⌘K / Ctrl+K / "/"): jump to a page or to a token in Market. Tokens come from
 * the Market list, so results are instant and need no external API.
 */
const open = defineModel<boolean>({ default: false })

const auth = useAuthStore()
const router = useRouter()
const query = ref('')
const tokens = ref<Token[]>([])
const loadingTokens = ref(false)
const active = ref(0)
const input = ref<HTMLInputElement | null>(null)
const list = ref<HTMLElement | null>(null)

interface Result {
  key: string
  kind: 'page' | 'token'
  label: string
  hint?: string
  to: string
  external?: boolean
  icon?: IconName
  token?: Token
}

const pages = computed<Result[]>(() =>
  [...tradingNav, ...(auth.user?.is_admin ? adminNav : []), profileNav].map((item) => ({
    key: `page:${item.to}`,
    kind: 'page',
    label: item.label,
    hint: item.to.startsWith('/admin') || item.external ? 'Admin' : 'Halaman',
    to: item.to,
    external: item.external,
    icon: item.icon,
  })),
)

function matches(text: string, q: string): boolean {
  return text.toLowerCase().includes(q)
}

const results = computed<Result[]>(() => {
  const q = query.value.trim().toLowerCase()
  const pageHits = q ? pages.value.filter((p) => matches(p.label, q)) : pages.value.slice(0, tradingNav.length)
  // Exact symbol, then symbol prefix, then symbol contains, then name only; ties by 24h volume.
  const rank = (t: Token): number => {
    const symbol = t.symbol.toLowerCase()
    return symbol === q ? 3 : symbol.startsWith(q) ? 2 : symbol.includes(q) ? 1 : 0
  }
  const tokenHits = tokens.value
    .filter((t) => !q || matches(t.symbol, q) || matches(t.name, q))
    .sort((a, b) => (q ? rank(b) - rank(a) : 0) || (b.volume_h24 ?? 0) - (a.volume_h24 ?? 0))
    .slice(0, q ? 8 : 5)
    .map<Result>((t) => ({ key: `token:${t.id}`, kind: 'token', label: t.symbol, hint: t.chain_label, to: tokenPath(t), token: t }))
  return [...tokenHits, ...pageHits]
})

const tokenResults = computed(() => results.value.filter((r) => r.kind === 'token'))
const pageResults = computed(() => results.value.filter((r) => r.kind === 'page'))

async function loadTokens() {
  loadingTokens.value = tokens.value.length === 0
  try {
    const { data } = await api.get<{ data: Token[] }>('/tokens')
    tokens.value = data.data
  } finally {
    loadingTokens.value = false
  }
}

watch(open, async (isOpen) => {
  if (!isOpen) return
  query.value = ''
  active.value = 0
  loadTokens()
  await nextTick()
  input.value?.focus()
})

watch(query, () => (active.value = 0))

function go(result: Result | undefined) {
  if (!result) return
  open.value = false
  if (result.external) window.open(result.to, '_blank', 'noopener')
  else router.push(result.to)
}

function move(step: number) {
  const count = results.value.length
  if (!count) return
  active.value = (active.value + step + count) % count
  nextTick(() => list.value?.querySelector(`[data-index="${active.value}"]`)?.scrollIntoView({ block: 'nearest' }))
}

function indexOf(result: Result): number {
  return results.value.indexOf(result)
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-[12vh] backdrop-blur-sm" @click.self="open = false">
        <div class="modal-panel card w-full max-w-xl overflow-hidden shadow-2xl shadow-black/50" role="dialog" aria-label="Cari">
          <div class="flex items-center gap-2 border-b border-line px-4">
            <AppIcon name="search" class="h-5 w-5 shrink-0 text-muted" />
            <input
              ref="input"
              v-model="query"
              class="h-12 w-full border-0 bg-transparent px-0 text-base shadow-none ring-0 outline-none focus:ring-0"
              placeholder="Cari token di Market atau halaman…"
              aria-label="Cari token atau halaman"
              role="combobox"
              aria-expanded="true"
              aria-controls="palette-results"
              :aria-activedescendant="results[active] ? `palette-${results[active].key}` : undefined"
              @keydown.down.prevent="move(1)"
              @keydown.up.prevent="move(-1)"
              @keydown.enter.prevent="go(results[active])"
              @keydown.esc.prevent="open = false"
            />
            <kbd class="hidden rounded border border-line px-1.5 py-0.5 text-[10px] text-muted sm:block">Esc</kbd>
          </div>

          <div id="palette-results" ref="list" class="max-h-[60vh] overflow-y-auto p-2" role="listbox">
            <template v-if="tokenResults.length || loadingTokens">
              <p class="px-2 pt-1 pb-1.5 text-[10px] font-semibold tracking-wider text-muted uppercase">Token di Market</p>
              <div v-if="loadingTokens" class="space-y-1.5 px-2 pb-2">
                <div v-for="i in 3" :key="i" class="skeleton h-9" />
              </div>
              <button
                v-for="r in tokenResults"
                :id="`palette-${r.key}`"
                :key="r.key"
                type="button"
                role="option"
                :aria-selected="indexOf(r) === active"
                :data-index="indexOf(r)"
                class="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm transition-colors"
                :class="indexOf(r) === active ? 'bg-brand/15' : 'hover:bg-panel-2'"
                @mousemove="active = indexOf(r)"
                @click="go(r)"
              >
                <TokenAvatar :src="r.token!.image_url" :symbol="r.token!.symbol" :size="28" />
                <span class="min-w-0 flex-1">
                  <span class="font-medium">{{ r.label }}</span>
                  <span class="ml-1.5 text-xs text-muted">{{ r.hint }}</span>
                  <span class="block truncate text-xs text-muted">{{ r.token!.name }}</span>
                </span>
                <span class="num text-right text-xs">
                  <span class="block">{{ price(r.token!.price_usd) }}</span>
                  <span :class="changeClass(r.token!.price_change.h24)">{{ pct(r.token!.price_change.h24) }}</span>
                </span>
              </button>
            </template>

            <template v-if="pageResults.length">
              <p class="px-2 pt-2 pb-1.5 text-[10px] font-semibold tracking-wider text-muted uppercase">Halaman</p>
              <button
                v-for="r in pageResults"
                :id="`palette-${r.key}`"
                :key="r.key"
                type="button"
                role="option"
                :aria-selected="indexOf(r) === active"
                :data-index="indexOf(r)"
                class="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm transition-colors"
                :class="indexOf(r) === active ? 'bg-brand/15' : 'hover:bg-panel-2'"
                @mousemove="active = indexOf(r)"
                @click="go(r)"
              >
                <span class="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-panel-2 text-muted"><AppIcon :name="r.icon!" class="h-4 w-4" /></span>
                <span class="flex-1">{{ r.label }}</span>
                <span class="text-xs text-muted">{{ r.external ? 'Tab baru ↗' : r.hint }}</span>
              </button>
            </template>

            <p v-if="!results.length && !loadingTokens" class="px-2 py-8 text-center text-sm text-muted">
              Tidak ada yang cocok dengan "{{ query }}". Token baru bisa ditambahkan dari halaman Market.
            </p>
          </div>

          <div class="flex items-center gap-3 border-t border-line px-4 py-2 text-[11px] text-muted">
            <span><kbd class="rounded border border-line px-1">↑</kbd> <kbd class="rounded border border-line px-1">↓</kbd> pilih</span>
            <span><kbd class="rounded border border-line px-1">Enter</kbd> buka</span>
            <span class="ml-auto"><kbd class="rounded border border-line px-1">⌘K</kbd> / <kbd class="rounded border border-line px-1">/</kbd> cari dari mana saja</span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
