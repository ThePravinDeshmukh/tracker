export interface Holding {
  symbol: string;
  avgPrice: number;
  qty: number;
  stopLoss?: number;
}

export interface EnrichedHolding extends Holding {
  livePrice: number | undefined;
  invested: number;
  currentValue: number | null;
  pnl: number | null;
  pnlPct: number | null;
}

export type PriceMap = Record<string, number>;
export type VolumeMap = Record<string, number>;

export interface VolumePoint {
  time: number;
  volume: number; // quote asset volume in USDT
  isUp: boolean;  // close >= open
}

export type SortKey = 'value' | 'pnl' | 'pnlpct' | 'name';
export type WatchlistSortKey = 'name' | 'price' | 'change';

export interface WatcherSignal {
  symbol: string;
  price: number;
  priceChangePct: number;  // e.g. 2.4 means +2.4%
  volumeRatio: number;     // e.g. 1.8 means 1.8× rolling average
  enteredAt: number;       // unix ms — when coin entered current signals
  exitedAt?: number;       // unix ms — set when coin moves to past signals
}

export interface WatchedCoin {
  symbol: string;
}

// --- Momentum Tracker (Market Pulse) ---

export type Regime = 'high_vol' | 'normal' | 'loading';

export interface MomentumRow {
  symbol: string;
  lastPrice: number;
  ret1m: number | null;   // % change from 1 min ago
  ret5m: number | null;   // % change from 5 min ago
  vol15m: number | null;  // std dev of 1-min returns over last 15 min
  regime: Regime;
}

export interface StressEvent {
  symbol: string;
  price: number;
  ret1m: number;          // signed % that triggered the event
  triggeredAt: number;    // unix ms
}

export interface CorrelationResult {
  symbol: string;
  correlation: number;    // Pearson, –1 to +1
}

// --- Network Console ---

export type NetworkEntryMethod = 'GET' | 'WS';

export interface FetchEntry {
  id: string;
  method: 'GET';
  url: string;
  startedAt: number;        // Date.now()
  durationMs: number | null;
  status: number | 'ERR';   // HTTP status code, or 'ERR' on network failure
}

export interface WebSocketEntry {
  id: string;
  method: 'WS';
  url: string;
  startedAt: number;
  durationMs: number | null; // null while live; set when closed/errored
  status: 'CONNECTING' | 'LIVE' | 'CLOSED' | 'ERR';
}

export type NetworkEntry = FetchEntry | WebSocketEntry;
