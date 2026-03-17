import { useState, useEffect } from 'react';

export type TimeframeKey = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d';

export interface PricePoint {
  time: number;
  price: number;
}

interface UseAssetHistoryResult {
  data: PricePoint[];
  loading: boolean;
  error: string | null;
}

const TIMEFRAME_LIMITS: Record<TimeframeKey, number> = {
  '1m': 120,
  '5m': 144,
  '15m': 96,
  '30m': 96,
  '1h': 72,
  '4h': 90,
  '1d': 90,
};

const FUTURES_SYMBOLS = new Set(['DUSK', 'HANA']);

type RawKline = [number, string, string, string, string, ...unknown[]];

function getBinanceKlineUrl(symbol: string, interval: TimeframeKey): string {
  const pair = `${symbol}USDT`;
  const limit = TIMEFRAME_LIMITS[interval];
  if (FUTURES_SYMBOLS.has(symbol)) {
    return `https://fapi.binance.com/fapi/v1/klines?symbol=${pair}&interval=${interval}&limit=${limit}`;
  }
  return `https://api.binance.com/api/v3/klines?symbol=${pair}&interval=${interval}&limit=${limit}`;
}

function parseKlines(raw: RawKline[]): PricePoint[] {
  return raw.map(k => ({ time: k[0], price: parseFloat(k[4]) }));
}

export function useAssetHistory(symbol: string | null, interval: TimeframeKey): UseAssetHistoryResult {
  const [data, setData] = useState<PricePoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!symbol) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setData([]);

    fetch(getBinanceKlineUrl(symbol, interval))
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<RawKline[]>;
      })
      .then(raw => {
        if (!cancelled) {
          setData(parseKlines(raw));
          setLoading(false);
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError((err as Error).message ?? 'Failed to load price history');
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [symbol, interval]);

  return { data, loading, error };
}
