export type Recommendation = 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL' | 'AVOID'
export type Side = 'buy' | 'sell'
export type OrderType = 'market' | 'limit' | 'stop_loss' | 'take_profit'
export type OrderStatus = 'pending' | 'filled' | 'cancelled' | 'rejected'
export type SignalStatus = 'pending' | 'active' | 'take_profit' | 'stop_loss' | 'invalidated' | 'expired'

export interface User {
  id: number
  name: string
  email: string
  balance_usd: number
  is_admin: boolean
  two_factor_enabled: boolean
  /** Still on the temporary password from an admin: only /change-password is allowed. */
  must_change_password: boolean
  telegram_linked: boolean
  created_at: string | null
}

export interface PortfolioSummary {
  balance_usd: number
  holdings_value_usd: number
  equity_usd: number
  starting_balance: number
  total_pnl: number
  total_pnl_pct: number
  unrealized_pnl: number
  realized_pnl: number
  fees_paid: number
  trades: number
  open_positions: number
  pending_orders: number
}

export interface NotificationSettings {
  signals: boolean
  signal_updates: boolean
  risk: boolean
  watchlist: boolean
  system: boolean
  daily_summary: boolean
  signal_min: 'BUY' | 'STRONG_BUY'
  daily_summary_hour: number
  quiet_start_hour: number
  quiet_end_hour: number
}

export interface Profile {
  user: User
  two_factor: { enabled: boolean; confirmed_at: string | null; recovery_codes_left: number }
  telegram: { available: boolean; linked: boolean; username: string | null; linked_at: string | null }
  notifications: NotificationSettings
}

export interface SecurityCheck {
  risk_score: number
  holder_count: number | null
  top10_percent: number | null
  lp_locked_percent: number | null
  is_honeypot: boolean | null
  buy_tax: number | null
  sell_tax: number | null
  flags: { level: 'danger' | 'warning' | 'info'; message: string }[]
  checked_at: string
}

export interface Levels {
  entry_low: number
  entry_high: number
  stop_loss: number
  take_profit_1: number
  take_profit_2: number
  take_profit_3: number
}

export interface Analysis {
  id: number
  token_id: number
  timeframe: string
  recommendation: Recommendation
  recommendation_label: string
  final_score: number
  scores: { technical: number; onchain: number; whale: number; sentiment: number; fundamental: number }
  price: number
  levels: Levels | null
  indicators?: Record<string, any>
  reasons?: string[]
  summary: string | null
  summary_provider: string | null
  token?: Token
  created_at: string
}

export interface Token {
  id: number
  /** URL key such as "JOB-SOL". */
  slug: string
  chain_id: string
  chain_label: string
  pair_address: string
  token_address: string
  symbol: string
  name: string
  quote_symbol: string | null
  dex_id: string | null
  image_url: string | null
  url: string | null
  price_usd: number | null
  price_change: { m5: number | null; h1: number | null; h6: number | null; h24: number | null }
  volume_h24: number | null
  liquidity_usd: number | null
  fdv: number | null
  market_cap: number | null
  txns_h24: { buys: number | null; sells: number | null }
  pair_created_at: string | null
  price_updated_at: string | null
  source: 'manual' | 'seed' | 'discovery'
  discovered_at: string | null
  is_pinned: boolean
  is_new: boolean
  added_at: string | null
  score_history?: { day: string; score: number }[]
  score_trend?: { declining: boolean; change: number | null; down_days: number; days: number }
  latest_analysis?: Analysis | null
  latest_security?: SecurityCheck | null
}

export interface Signal extends Levels {
  id: number
  token_id: number
  recommendation: Recommendation
  status: SignalStatus
  entry_price: number | null
  exit_price: number | null
  max_tp_hit: number
  result_r: number | null
  entered_at: string | null
  closed_at: string | null
  created_at: string
  token?: Token
}

export interface Order {
  id: number
  token_id: number
  signal_id: number | null
  parent_id: number | null
  side: Side
  type: OrderType
  status: OrderStatus
  amount_usd: number | null
  quantity: number | null
  trigger_price: number | null
  take_profit_price: number | null
  stop_loss_price: number | null
  filled_price: number | null
  filled_quantity: number | null
  total_usd: number | null
  fee_usd: number | null
  slippage_pct: number | null
  realized_pnl: number | null
  note: string | null
  filled_at: string | null
  created_at: string
  token?: Token
}

/** Totals over every order matching the history filters (not just the loaded page). */
export interface OrderHistorySummary {
  orders: number
  realized_pnl: number
  fees: number
  wins: number
  losses: number
}

export interface Position {
  id: number
  token_id: number
  quantity: number
  avg_price: number
  current_price: number
  value_usd: number
  cost_usd: number
  unrealized_pnl: number
  unrealized_pnl_pct: number
  realized_pnl: number
  token: Token
}

export interface Portfolio {
  balance_usd: number
  holdings_value_usd: number
  equity_usd: number
  starting_balance: number
  total_pnl: number
  total_pnl_pct: number
  unrealized_pnl: number
  realized_pnl: number
  fees_paid: number
  trades: number
  positions: Position[]
}

export interface WhaleTrade {
  id: number
  token_id: number
  tx_hash: string
  wallet: string | null
  side: Side
  amount_usd: number
  token_amount: number | null
  price_usd: number | null
  traded_at: string
  token?: { id: number; slug: string; symbol: string; chain_id: string; image_url: string | null }
}

export interface NewsItem {
  id: number
  source: string
  title: string
  url: string
  summary: string | null
  published_at: string
  sentiment_score: number | null
  sentiment_label: 'bullish' | 'neutral' | 'bearish' | null
  sentiment_provider: string | null
  tokens?: { id: number; slug: string; symbol: string }[]
}

export interface Candle {
  open_time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface Paginated<T> {
  data: T[]
  meta: { current_page: number; last_page: number; total: number }
}

export type CandidateSource = 'geckoterminal_trending' | 'coingecko_trending' | 'dexscreener_boost'

export interface Candidate {
  id: number
  token_id: number | null
  chain_id: string
  chain_label: string
  pair_address: string
  token_address: string
  symbol: string
  name: string
  quote_symbol: string | null
  image_url: string | null
  url: string | null
  sources: CandidateSource[]
  price_usd: number | null
  price_change: { h1: number | null; h6: number | null; h24: number | null }
  volume_h24: number | null
  liquidity_usd: number | null
  fdv: number | null
  txns_h24: { buys: number | null; sells: number | null; buyers: number | null; sellers: number | null }
  news_mentions: number
  whale: { buy_usd: number; sell_usd: number; trades: number; buy_wallets: number; checked_at: string } | null
  security: { score: number; is_honeypot: boolean | null; flags: SecurityCheck['flags']; checked_at: string } | null
  scores: { trend: number; attention: number; whale: number | null; security: number | null; discovery: number | null }
  status: 'candidate' | 'tracked' | 'rejected'
  reasons: string[]
  pair_created_at: string | null
  first_seen_at: string
  last_seen_at: string
  token?: { id: number; slug: string; is_active: boolean; recommendation: Recommendation | null; final_score: number | null } | null
}

export interface WatchlistEvent {
  id: number
  action: 'added' | 'removed' | 'pinned' | 'unpinned'
  reason: string
  score: number | null
  created_at: string
  token: { id: number; slug: string; symbol: string; chain_id: string; image_url: string | null; is_active: boolean }
}
