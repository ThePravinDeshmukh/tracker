import { useState, useEffect, useMemo } from 'react';
import { VolumePoint } from '../types';
import { useAvailablePairs } from './useAvailablePairs';

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

// Fallback used before dynamic pair data has loaded
const FALLBACK_FUTURES_SYMBOLS = new Set(['DUSK', 'HANA']);

// k[0]=openTime, k[1]=open, k[2]=high, k[3]=low, k[4]=close,
// k[5]=baseVol, k[6]=closeTime, k[7]=quoteVol (USDT)
type RawKline = [number, string, string, string, string, string, number, string, ...unknown[]];

function getBinanceKlineUrl(symbol: string, interval: TimeframeKey, isFutures: boolean): string {
  const pair = `${symbol}USDT`;
  const limit = TIMEFRAME_LIMITS[interval];
  if (isFutures) {
    return `https://fapi.binance.com/fapi/v1/klines?symbol=${pair}&interval=${interval}&limit=${limit}`;
  }
  return `https://api.binance.com/api/v3/klines?symbol=${pair}&interval=${interval}&limit=${limit}`;
}

function parseKlines(raw: RawKline[]): { pricePoints: PricePoint[]; volumePoints: VolumePoint[] } {
  const pricePoints: PricePoint[] = [];
  const volumePoints: VolumePoint[] = [];
  for (const k of raw) {
    pricePoints.push({ time: k[0], price: parseFloat(k[4]) });
    volumePoints.push({
      time: k[0],
      volume: parseFloat(k[7]),   // quote asset volume in USDT
      isUp: parseFloat(k[4]) >= parseFloat(k[1]), // close >= open
    });
  }
  return { pricePoints, volumePoints };
}

export function useAssetHistory(symbol: string | null, interval: TimeframeKey): UseAssetHistoryResult {
  const [data, setData] = useState<PricePoint[]>([]);
  const [volumeHistory, setVolumeHistory] = useState<VolumePoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { spotSymbols, futuresSymbols, loading: pairsLoading } = useAvailablePairs();

  const isFutures = useMemo(() => {
    if (!symbol) return false;
    if (spotSymbols.length === 0 && futuresSymbols.length === 0) {
      return FALLBACK_FUTURES_SYMBOLS.has(symbol);
    }
    const spotSet = new Set(spotSymbols);
    const futuresSet = new Set(futuresSymbols);
    return !spotSet.has(symbol) && futuresSet.has(symbol);
  }, [symbol, spotSymbols, futuresSymbols]);

  useEffect(() => {
    if (!symbol) return;
    if (pairsLoading) {
      setLoading(true);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setData([]);
    setVolumeHistory([]);

    fetch(getBinanceKlineUrl(symbol, interval, isFutures))
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
  }, [symbol, interval, isFutures, pairsLoading]);

  return { data, volumeHistory, loading, error };
}
