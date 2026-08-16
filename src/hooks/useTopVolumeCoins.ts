import { useState, useEffect } from 'react';
import { baseAssetOf } from '../utils/watchlist';

const FUTURES_TICKER24_URL = 'https://fapi.binance.com/fapi/v1/ticker/24hr';
const DEFAULT_TOP_VOLUME_COUNT = 10;
const REFRESH_INTERVAL_MS = 5 * 60_000;

interface Ticker24hVolume {
  symbol: string;
  quoteVolume: string;
}

// allowedBaseAssets narrows the candidates before ranking, e.g. to assets tradable on a
// specific exchange. Pass null to rank across all USDT pairs.
export function selectTopVolumeSymbols(
  tickers: Ticker24hVolume[],
  count: number,
  allowedBaseAssets: string[] | null = null
): string[] {
  const allowedSet = allowedBaseAssets ? new Set(allowedBaseAssets) : null;
  return [...tickers]
    .filter(ticker => ticker.symbol.endsWith('USDT'))
    .filter(ticker => allowedSet === null || allowedSet.has(baseAssetOf(ticker.symbol)))
    .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
    .slice(0, count)
    .map(ticker => ticker.symbol);
}

async function fetchTopVolumeSymbols(count: number, allowedBaseAssets: string[] | null): Promise<string[]> {
  const res = await fetch(FUTURES_TICKER24_URL);
  if (!res.ok) throw new Error(`Failed to fetch 24hr tickers: ${res.status}`);
  const tickers = await res.json() as Ticker24hVolume[];
  return selectTopVolumeSymbols(tickers, count, allowedBaseAssets);
}

export interface UseTopVolumeCoinsResult {
  topVolumeCoins: string[];
  loading: boolean;
}

// allowedBaseAssets narrows the ranked pool to a specific exchange's tradable assets.
// Pass null (the default) to rank across all USDT pairs, or while that allow-list is still loading.
export function useTopVolumeCoins(
  count: number = DEFAULT_TOP_VOLUME_COUNT,
  allowedBaseAssets: string[] | null = null
): UseTopVolumeCoinsResult {
  const [topVolumeCoins, setTopVolumeCoins] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    function load(): void {
      fetchTopVolumeSymbols(count, allowedBaseAssets)
        .then(symbols => { if (!cancelled) setTopVolumeCoins(symbols); })
        .catch(() => {})
        .finally(() => { if (!cancelled) setLoading(false); });
    }

    load();
    const intervalId = setInterval(load, REFRESH_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(intervalId); };
  }, [count, allowedBaseAssets ? allowedBaseAssets.join(',') : null]); // eslint-disable-line

  return { topVolumeCoins, loading };
}
