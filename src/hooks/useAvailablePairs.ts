import { useState, useEffect, useMemo } from 'react';

const SPOT_TICKERS_URL = 'https://api.binance.com/api/v3/ticker/price';
const FUTURES_TICKERS_URL = 'https://fapi.binance.com/fapi/v1/ticker/price';

interface TickerPrice {
  symbol: string;
  price: string;
}

interface CachedPairs {
  spotSymbols: string[];
  futuresSymbols: string[];
}

export interface AvailablePairsResult {
  spotSymbols: string[];
  futuresSymbols: string[];
  allSymbols: string[];
  loading: boolean;
}

// Module-level cache — fetch once per browser session
let cachedPairs: CachedPairs | null = null;
let fetchPromise: Promise<CachedPairs> | null = null;

function extractUsdtBaseSymbols(tickers: TickerPrice[]): string[] {
  return tickers
    .filter(t => t.symbol.endsWith('USDT'))
    .map(t => t.symbol.slice(0, -4))
    .sort();
}

async function fetchPairs(): Promise<CachedPairs> {
  if (cachedPairs) return cachedPairs;
  if (fetchPromise) return fetchPromise;

  fetchPromise = Promise.all([
    fetch(SPOT_TICKERS_URL).then(r => r.json() as Promise<TickerPrice[]>),
    fetch(FUTURES_TICKERS_URL).then(r => r.json() as Promise<TickerPrice[]>),
  ]).then(([spotData, futuresData]) => {
    cachedPairs = {
      spotSymbols: extractUsdtBaseSymbols(spotData),
      futuresSymbols: extractUsdtBaseSymbols(futuresData),
    };
    return cachedPairs;
  });

  return fetchPromise;
}

export function useAvailablePairs(): AvailablePairsResult {
  const [spotSymbols, setSpotSymbols] = useState<string[]>(cachedPairs?.spotSymbols ?? []);
  const [futuresSymbols, setFuturesSymbols] = useState<string[]>(cachedPairs?.futuresSymbols ?? []);
  const [loading, setLoading] = useState(cachedPairs === null);

  useEffect(() => {
    if (cachedPairs) return;

    fetchPairs()
      .then(({ spotSymbols, futuresSymbols }) => {
        setSpotSymbols(spotSymbols);
        setFuturesSymbols(futuresSymbols);
      })
      .catch(() => {
        // Leave empty on error — fallback behaviour handled by callers
      })
      .finally(() => setLoading(false));
  }, []);

  const allSymbols = useMemo(
    () => Array.from(new Set([...spotSymbols, ...futuresSymbols])).sort(),
    [spotSymbols, futuresSymbols]
  );

  return { spotSymbols, futuresSymbols, allSymbols, loading };
}
