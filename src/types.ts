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
