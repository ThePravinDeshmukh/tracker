import { useState, useEffect, useRef } from 'react';
import { Recommendation } from '../types';
import { getRecommendation, OHLCVPoint } from '../utils/indicators';

const FUTURES_SYMBOLS = new Set(['DUSK', 'HANA']);
const KLINE_INTERVAL = '1h';
const KLINE_LIMIT = 60;
const REFRESH_MS = 5 * 60 * 1000;

type RawKline = [number, string, string, string, string, string, ...unknown[]];

function getKlineUrl(symbol: string): string {
  const pair = `${symbol}USDT`;
  if (FUTURES_SYMBOLS.has(symbol)) {
    return `https://fapi.binance.com/fapi/v1/klines?symbol=${pair}&interval=${KLINE_INTERVAL}&limit=${KLINE_LIMIT}`;
  }
  return `https://api.binance.com/api/v3/klines?symbol=${pair}&interval=${KLINE_INTERVAL}&limit=${KLINE_LIMIT}`;
}

function parseOHLCV(raw: RawKline[]): OHLCVPoint[] {
  return raw.map(k => ({
    time: k[0],
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
  }));
}

async function fetchRecommendation(symbol: string): Promise<Recommendation> {
  const res = await fetch(getKlineUrl(symbol));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const raw = (await res.json()) as RawKline[];
  return getRecommendation(parseOHLCV(raw));
}

export function useRecommendations(symbols: string[]): Record<string, Recommendation> {
  const [recommendations, setRecommendations] = useState<Record<string, Recommendation>>({});
  const symbolsKey = symbols.join(',');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (symbols.length === 0) return;
    let cancelled = false;

    async function fetchAll(): Promise<void> {
      const results = await Promise.allSettled(
        symbols.map(async symbol => {
          const rec = await fetchRecommendation(symbol);
          return { symbol, rec };
        })
      );
      if (cancelled) return;
      const next: Record<string, Recommendation> = {};
      for (const result of results) {
        if (result.status === 'fulfilled') {
          next[result.value.symbol] = result.value.rec;
        }
      }
      setRecommendations(prev => ({ ...prev, ...next }));
    }

    fetchAll();
    intervalRef.current = setInterval(fetchAll, REFRESH_MS);

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolsKey]);

  return recommendations;
}
