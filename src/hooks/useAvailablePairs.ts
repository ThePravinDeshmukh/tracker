import { useState, useEffect } from 'react';

const FUTURES_TICKERS_URL = 'https://fapi.binance.com/fapi/v1/ticker/price';

interface TickerPrice {
  symbol: string;
  price: string;
}

let cachedFuturesPairs: string[] | null = null;
let fetchPromise: Promise<string[]> | null = null;

function fetchAllFuturesPairs(): Promise<string[]> {
  if (cachedFuturesPairs) return Promise.resolve(cachedFuturesPairs);
  if (fetchPromise) return fetchPromise;

  fetchPromise = fetch(FUTURES_TICKERS_URL)
    .then(r => r.json() as Promise<TickerPrice[]>)
    .then(data => {
      cachedFuturesPairs = data
        .filter(t => t.symbol.endsWith('USDT'))
        .map(t => t.symbol)
        .sort();
      return cachedFuturesPairs;
    })
    .catch(err => {
      fetchPromise = null;
      throw err;
    });

  return fetchPromise;
}

export interface AvailablePairsResult {
  allSymbols: string[];
  loading: boolean;
}

export function useAvailablePairs(): AvailablePairsResult {
  const [symbols, setSymbols] = useState<string[]>(cachedFuturesPairs ?? []);
  const [loading, setLoading] = useState(cachedFuturesPairs === null);

  useEffect(() => {
    if (cachedFuturesPairs) return;
    fetchAllFuturesPairs()
      .then(pairs => setSymbols(pairs))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { allSymbols: symbols, loading };
}
