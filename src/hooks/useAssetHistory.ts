import { useState, useEffect } from 'react';
import { VolumePoint } from '../types';

export type TimeframeKey = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d';

export interface PricePoint {
  time: number;
  price: number;
}

interface UseAssetHistoryResult {
  data: PricePoint[];
  volumeHistory: VolumePoint[];
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

// k[0]=openTime, k[1]=open, k[2]=high, k[3]=low, k[4]=close,
// k[5]=baseVol, k[6]=closeTime, k[7]=quoteVol (USDT)
type RawKline = [number, string, string, string, string, string, number, string, ...unknown[]];

function getFuturesKlineUrl(pair: string, interval: TimeframeKey): string {
  const limit = TIMEFRAME_LIMITS[interval];
  return `https://fapi.binance.com/fapi/v1/klines?symbol=${pair}&interval=${interval}&limit=${limit}`;
}

function parseKlines(raw: RawKline[]): { pricePoints: PricePoint[]; volumePoints: VolumePoint[] } {
  const pricePoints: PricePoint[] = [];
  const volumePoints: VolumePoint[] = [];
  for (const k of raw) {
    pricePoints.push({ time: k[0], price: parseFloat(k[4]) });
    volumePoints.push({
      time: k[0],
      volume: parseFloat(k[7]),
      isUp: parseFloat(k[4]) >= parseFloat(k[1]),
    });
  }
  return { pricePoints, volumePoints };
}

export function useAssetHistory(symbol: string | null, interval: TimeframeKey): UseAssetHistoryResult {
  const [data, setData] = useState<PricePoint[]>([]);
  const [volumeHistory, setVolumeHistory] = useState<VolumePoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!symbol) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setData([]);
    setVolumeHistory([]);

    fetch(getFuturesKlineUrl(symbol, interval))
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<RawKline[]>;
      })
      .then(raw => {
        if (!cancelled) {
          const { pricePoints, volumePoints } = parseKlines(raw);
          setData(pricePoints);
          setVolumeHistory(volumePoints);
          setLoading(false);
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError((err as Error).message ?? 'Failed to load history');
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [symbol, interval]);

  return { data, volumeHistory, loading, error };
}
