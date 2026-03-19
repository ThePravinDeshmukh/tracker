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

export type SortKey = 'value' | 'pnl' | 'pnlpct' | 'name';

export type Recommendation = 'BUY' | 'SELL' | 'HOLD';
