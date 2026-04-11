export interface Holding {
  symbol: string;
  avgPrice: number;
  qty: number;
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
