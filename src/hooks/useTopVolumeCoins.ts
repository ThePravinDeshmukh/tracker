import { useState, useEffect } from 'react';

const FUTURES_TICKER24_URL = 'https://fapi.binance.com/fapi/v1/ticker/24hr';
const DEFAULT_TOP_VOLUME_COUNT = 10;
const REFRESH_INTERVAL_MS = 5 * 60_000;

interface Ticker24hVolume {
  symbol: string;
  quoteVolume: string;
}

export function selectTopVolumeSymbols(tickers: Ticker24hVolume[], count: number): string[] {
  return [...tickers]
    .filter(ticker => ticker.symbol.endsWith('USDT'))
    .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
    .slice(0, count)
    .map(ticker => ticker.symbol);
}

async function fetchTopVolumeSymbols(count: number): Promise<string[]> {
  const res = await fetch(FUTURES_TICKER24_URL);
  if (!res.ok) throw new Error(`Failed to fetch 24hr tickers: ${res.status}`);
  const tickers = await res.json() as Ticker24hVolume[];
  return selectTopVolumeSymbols(tickers, count);
}

export interface UseTopVolumeCoinsResult {
  topVolumeCoins: string[];
  loading: boolean;
}

export function useTopVolumeCoins(count: number = DEFAULT_TOP_VOLUME_COUNT): UseTopVolumeCoinsResult {
  const [topVolumeCoins, setTopVolumeCoins] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    function load(): void {
      fetchTopVolumeSymbols(count)
        .then(symbols => { if (!cancelled) setTopVolumeCoins(symbols); })
        .catch(() => {})
        .finally(() => { if (!cancelled) setLoading(false); });
    }

    load();
    const intervalId = setInterval(load, REFRESH_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(intervalId); };
  }, [count]);

  return { topVolumeCoins, loading };
}
