import { useState, useEffect } from 'react';
import { VolumeMomentumMap } from '../types';
import { computeVolumeSurgeRatio, isVolumeSurging } from '../utils/volumeMomentum';

const FUTURES_KLINE_URL = 'https://fapi.binance.com/fapi/v1/klines';
const HOURLY_KLINE_INTERVAL = '1h';
const HOURLY_KLINE_LIMIT = 24;
const REFRESH_INTERVAL_MS = 5 * 60_000;

// k[7] = quote asset volume for the candle
type RawKline = [number, string, string, string, string, string, number, string, ...unknown[]];

async function fetchHourlyQuoteVolumes(symbol: string): Promise<number[]> {
  const url = `${FUTURES_KLINE_URL}?symbol=${symbol}&interval=${HOURLY_KLINE_INTERVAL}&limit=${HOURLY_KLINE_LIMIT}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch klines for ${symbol}: ${res.status}`);
  const raw = await res.json() as RawKline[];
  return raw.map(k => parseFloat(k[7]));
}

async function fetchVolumeMomentum(symbols: string[]): Promise<VolumeMomentumMap> {
  const results = await Promise.allSettled(symbols.map(fetchHourlyQuoteVolumes));
  const momentum: VolumeMomentumMap = {};
  results.forEach((result, index) => {
    if (result.status !== 'fulfilled') return;
    const ratio = computeVolumeSurgeRatio(result.value);
    if (isVolumeSurging(ratio)) momentum[symbols[index]] = ratio;
  });
  return momentum;
}

// Flags symbols whose trailing 4h volume is running at ≥2x the day's average pace.
// Only surging symbols are present in the returned map.
export function useVolumeMomentum(symbols: string[]): VolumeMomentumMap {
  const [volumeMomentum, setVolumeMomentum] = useState<VolumeMomentumMap>({});

  useEffect(() => {
    if (symbols.length === 0) { setVolumeMomentum({}); return; }
    let cancelled = false;

    function load(): void {
      fetchVolumeMomentum(symbols)
        .then(result => { if (!cancelled) setVolumeMomentum(result); })
        .catch(() => {});
    }

    load();
    const intervalId = setInterval(load, REFRESH_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(intervalId); };
  }, [symbols.join(',')]); // eslint-disable-line

  return volumeMomentum;
}
