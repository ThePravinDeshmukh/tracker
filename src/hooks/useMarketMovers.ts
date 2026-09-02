import { useState, useEffect } from 'react';
import { MarketMover } from '../types';

const FUTURES_TICKER24_URL = 'https://fapi.binance.com/fapi/v1/ticker/24hr';
const TOP_MOVER_COUNT = 10;
const REFRESH_INTERVAL_MS = 5 * 60_000;

interface Ticker24hStats {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  quoteVolume: string;
}

function toMarketMover(ticker: Ticker24hStats): MarketMover {
  return {
    symbol: ticker.symbol,
    price: parseFloat(ticker.lastPrice),
    priceChangePct: parseFloat(ticker.priceChangePercent),
    quoteVolume: parseFloat(ticker.quoteVolume),
  };
}

export interface MarketMoversResult {
  topGainers: MarketMover[];
  topLosers: MarketMover[];
}

export function deriveMarketMovers(tickers: Ticker24hStats[]): MarketMoversResult {
  const usdtMovers = tickers
    .filter(ticker => ticker.symbol.endsWith('USDT'))
    .map(toMarketMover);

  const topGainers = [...usdtMovers]
    .sort((a, b) => b.priceChangePct - a.priceChangePct)
    .slice(0, TOP_MOVER_COUNT);

  const topLosers = [...usdtMovers]
    .sort((a, b) => a.priceChangePct - b.priceChangePct)
    .slice(0, TOP_MOVER_COUNT);

  return { topGainers, topLosers };
}

async function fetchMarketMovers(): Promise<MarketMoversResult> {
  const res = await fetch(FUTURES_TICKER24_URL);
  if (!res.ok) throw new Error(`Failed to fetch 24hr tickers: ${res.status}`);
  const tickers = await res.json() as Ticker24hStats[];
  return deriveMarketMovers(tickers);
}

const EMPTY_RESULT: MarketMoversResult = { topGainers: [], topLosers: [] };

export function useMarketMovers(): MarketMoversResult & { loading: boolean } {
  const [movers, setMovers] = useState<MarketMoversResult>(EMPTY_RESULT);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    function load(): void {
      fetchMarketMovers()
        .then(result => { if (!cancelled) setMovers(result); })
        .catch(() => {})
        .finally(() => { if (!cancelled) setLoading(false); });
    }

    load();
    const intervalId = setInterval(load, REFRESH_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(intervalId); };
  }, []);

  return { ...movers, loading };
}
