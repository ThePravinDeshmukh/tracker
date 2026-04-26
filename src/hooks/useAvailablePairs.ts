import { useState, useEffect, useMemo } from 'react';

const SPOT_TICKERS_URL = 'https://api.binance.com/api/v3/ticker/price';
const FUTURES_TICKERS_URL = 'https://fapi.binance.com/fapi/v1/ticker/price';

interface TickerPrice {
  symbol: string;
  price: string;
}

interface CachedAllPairs {
  spotSymbols: string[];
  futuresSymbols: string[];
}

// ── Cache for the bulk "all pairs" fetch (used by search dropdowns) ───────────
let cachedAllPairs: CachedAllPairs | null = null;
let allPairsFetchPromise: Promise<CachedAllPairs> | null = null;

function extractUsdtBaseSymbols(tickers: TickerPrice[]): string[] {
  return tickers
    .filter(t => t.symbol.endsWith('USDT'))
    .map(t => t.symbol.slice(0, -4))
    .sort();
}

function fetchAllPairs(): Promise<CachedAllPairs> {
  if (cachedAllPairs) return Promise.resolve(cachedAllPairs);
  if (allPairsFetchPromise) return allPairsFetchPromise;

  allPairsFetchPromise = Promise.all([
    fetch(SPOT_TICKERS_URL).then(r => r.json() as Promise<TickerPrice[]>),
    fetch(FUTURES_TICKERS_URL).then(r => r.json() as Promise<TickerPrice[]>),
  ]).then(([spotData, futuresData]) => {
    cachedAllPairs = {
      spotSymbols: extractUsdtBaseSymbols(spotData),
      futuresSymbols: extractUsdtBaseSymbols(futuresData),
    };
    return cachedAllPairs;
  });

  return allPairsFetchPromise;
}

// ── Per-symbol targeted check cache (used by price hooks) ─────────────────────
const spotCheckCache = new Map<string, boolean>(); // true = available on spot

async function isOnSpot(symbol: string): Promise<boolean> {
  const cached = spotCheckCache.get(symbol);
  if (cached !== undefined) return cached;

  try {
    const res = await fetch(`${SPOT_TICKERS_URL}?symbol=${symbol}USDT`);
    const result = res.ok;
    spotCheckCache.set(symbol, result);
    return result;
  } catch {
    spotCheckCache.set(symbol, false);
    return false;
  }
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export interface AvailablePairsResult {
  spotSymbols: string[];
  futuresSymbols: string[];
  allSymbols: string[];
  loading: boolean;
}

/**
 * Called with no args: bulk-fetches all Binance USDT pairs (for search dropdowns).
 * Called with a symbols array: does a targeted per-symbol spot check (fast path
 * used by useCryptoPrices to classify only the coins the user actually holds).
 */
export function useAvailablePairs(symbols?: string[]): AvailablePairsResult {
  const targeted = symbols !== undefined;

  // ── Targeted mode ─────────────────────────────────────────────────────────
  const [spotTargeted, setSpotTargeted] = useState<string[]>([]);
  const [futuresTargeted, setFuturesTargeted] = useState<string[]>([]);
  const [loadingTargeted, setLoadingTargeted] = useState(targeted && (symbols?.length ?? 0) > 0);

  const symbolsKey = targeted ? (symbols ?? []).slice().sort().join(',') : '';

  useEffect(() => {
    if (!targeted) return;
    const syms = symbols ?? [];
    if (syms.length === 0) {
      setSpotTargeted([]);
      setFuturesTargeted([]);
      setLoadingTargeted(false);
      return;
    }

    const allCached = syms.every(s => spotCheckCache.has(s));
    if (allCached) {
      setSpotTargeted(syms.filter(s => spotCheckCache.get(s) === true));
      setFuturesTargeted(syms.filter(s => spotCheckCache.get(s) === false));
      setLoadingTargeted(false);
      return;
    }

    setLoadingTargeted(true);
    Promise.all(syms.map(async s => ({ symbol: s, onSpot: await isOnSpot(s) })))
      .then(results => {
        setSpotTargeted(results.filter(r => r.onSpot).map(r => r.symbol));
        setFuturesTargeted(results.filter(r => !r.onSpot).map(r => r.symbol));
      })
      .catch(() => {
        setSpotTargeted(syms);
        setFuturesTargeted([]);
      })
      .finally(() => setLoadingTargeted(false));
  }, [symbolsKey]); // eslint-disable-line

  // ── Bulk mode ─────────────────────────────────────────────────────────────
  const [spotBulk, setSpotBulk] = useState<string[]>(cachedAllPairs?.spotSymbols ?? []);
  const [futuresBulk, setFuturesBulk] = useState<string[]>(cachedAllPairs?.futuresSymbols ?? []);
  const [loadingBulk, setLoadingBulk] = useState(cachedAllPairs === null);

  useEffect(() => {
    if (targeted) return;
    if (cachedAllPairs) return;

    fetchAllPairs()
      .then(({ spotSymbols, futuresSymbols }) => {
        setSpotBulk(spotSymbols);
        setFuturesBulk(futuresSymbols);
      })
      .catch(() => {})
      .finally(() => setLoadingBulk(false));
  }, []); // eslint-disable-line

  const allBulk = useMemo(
    () => Array.from(new Set([...spotBulk, ...futuresBulk])).sort(),
    [spotBulk, futuresBulk]
  );

  // ── Return correct mode ───────────────────────────────────────────────────
  if (targeted) {
    return {
      spotSymbols: spotTargeted,
      futuresSymbols: futuresTargeted,
      allSymbols: symbols ?? [],
      loading: loadingTargeted,
    };
  }

  return {
    spotSymbols: spotBulk,
    futuresSymbols: futuresBulk,
    allSymbols: allBulk,
    loading: loadingBulk,
  };
}
