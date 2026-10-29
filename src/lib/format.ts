const SUBSCRIPT = '₀₁₂₃₄₅₆₇₈₉'

/** USD amount with 2 decimals, compact above a million. */
export function usd(value: number | null | undefined, compact = false): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '–'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: compact && Math.abs(value) >= 1_000_000 ? 'compact' : 'standard',
    maximumFractionDigits: compact && Math.abs(value) >= 1_000_000 ? 2 : 2,
  }).format(value)
}

/**
 * Token price with enough precision for micro-caps: 0.00000123 → $0.0₅123.
 */
export function price(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '–'
  if (value === 0) return '$0'
  if (value >= 1) return '$' + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: value >= 1000 ? 2 : 4 })
  if (value >= 0.0001) return '$' + value.toPrecision(4).replace(/0+$/, '')

  const [, decimals = ''] = value.toFixed(20).split('.')
  const zeros = decimals.match(/^0*/)?.[0].length ?? 0
  const digits = decimals.slice(zeros, zeros + 4).replace(/0+$/, '')
  const subscript = String(zeros).split('').map((d) => SUBSCRIPT[Number(d)]).join('')
  return `$0.0${subscript}${digits}`
}

export function pct(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '–'
  return `${value > 0 ? '+' : ''}${value.toFixed(digits)}%`
}

export function compact(value: number | null | undefined): string {
  if (value === null || value === undefined) return '–'
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(value)
}

export function qty(value: number | null | undefined): string {
  if (value === null || value === undefined) return '–'
  if (value >= 1000) return compact(value)
  return value.toLocaleString('en-US', { maximumSignificantDigits: 6 })
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '–'
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return `${Math.floor(seconds)} dtk lalu`
  if (seconds < 3600) return `${Math.floor(seconds / 60)} mnt lalu`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} jam lalu`
  return `${Math.floor(seconds / 86400)} hari lalu`
}

export function dateTime(iso: string | null | undefined): string {
  if (!iso) return '–'
  return new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
}

export function shortAddress(address: string | null | undefined): string {
  if (!address) return '–'
  return address.length > 12 ? `${address.slice(0, 5)}…${address.slice(-4)}` : address
}

export function changeClass(value: number | null | undefined): string {
  if (!value) return 'text-muted'
  return value > 0 ? 'text-up' : 'text-down'
}

const EXPLORERS: Record<string, { tx: string; address: string }> = {
  solana: { tx: 'https://solscan.io/tx/', address: 'https://solscan.io/account/' },
  ethereum: { tx: 'https://etherscan.io/tx/', address: 'https://etherscan.io/address/' },
  base: { tx: 'https://basescan.org/tx/', address: 'https://basescan.org/address/' },
  bsc: { tx: 'https://bscscan.com/tx/', address: 'https://bscscan.com/address/' },
  arbitrum: { tx: 'https://arbiscan.io/tx/', address: 'https://arbiscan.io/address/' },
  polygon: { tx: 'https://polygonscan.com/tx/', address: 'https://polygonscan.com/address/' },
  optimism: { tx: 'https://optimistic.etherscan.io/tx/', address: 'https://optimistic.etherscan.io/address/' },
  avalanche: { tx: 'https://snowtrace.io/tx/', address: 'https://snowtrace.io/address/' },
}

export function explorerUrl(chain: string, kind: 'tx' | 'address', value: string): string | null {
  const explorer = EXPLORERS[chain]
  return explorer ? explorer[kind] + value : null
}
