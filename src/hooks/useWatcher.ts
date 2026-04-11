import { useState, useEffect, useRef, useCallback } from 'react';
import { WatcherSignal } from '../types';
import {
  PricePoint,
  checkPriceMomentum,
  checkVolumeSpike,
} from '../utils/watcherSignals';

const STORAGE_KEY = 'watcher-watchlist';
const MAX_WATCHLIST = 20;
const MAX_PAST_SIGNALS = 20;
const KLINES_LIMIT = 6;
const SPOT_KLINES_URL = 'https://api.binance.com/api/v3/klines';
const FUTURES_KLINES_URL = 'https://fapi.binance.com/fapi/v1/klines';

function toUsdtPair(symbol: string): string {
  return `${symbol.toUpperCase()}USDT`;
}

type KlineRow = [number, string, string, string, string, string, ...unknown[]];

async function fetchKlinesForSymbol(symbol: string): Promise<KlineRow[] | null> {
  const pair = toUsdtPair(symbol);
  for (const baseUrl of [SPOT_KLINES_URL, FUTURES_KLINES_URL]) {
    try {
      const res = await fetch(`${baseUrl}?symbol=${pair}&interval=1m&limit=${KLINES_LIMIT}`);
      if (res.ok) return (await res.json()) as KlineRow[];
    } catch {
      continue;
    }
  }
  return null;
}

export interface RefreshResult {
  newCount: number;
  checkedAt: number;
}

export interface UseWatcherResult {
  watchlist: string[];
  currentSignals: WatcherSignal[];
  pastSignals: WatcherSignal[];
  prices: Record<string, number>;
  activeToast: WatcherSignal | null;
  isChecking: boolean;
  lastChecked: number | null;
  refreshResult: RefreshResult | null;
  addToWatchlist: (symbol: string) => void;
  removeFromWatchlist: (symbol: string) => void;
  dismissToast: () => void;
  refresh: () => void;
}

export function useWatcher(): UseWatcherResult {
  const [watchlist, setWatchlist] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? (JSON.parse(saved) as string[]) : [];
    } catch {
      return [];
    }
  });

  const [prices, setPrices] = useState<Record<string, number>>({});
  const [currentSignals, setCurrentSignals] = useState<WatcherSignal[]>([]);
  const [pastSignals, setPastSignals] = useState<WatcherSignal[]>([]);
  const [toastQueue, setToastQueue] = useState<WatcherSignal[]>([]);
  const [activeToast, setActiveToast] = useState<WatcherSignal | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<number | null>(null);
  const [refreshResult, setRefreshResult] = useState<RefreshResult | null>(null);

  const currentSignalsRef = useRef<WatcherSignal[]>([]);
  const watchlistRef = useRef<string[]>(watchlist);
  watchlistRef.current = watchlist;

  // Persist watchlist
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(watchlist));
  }, [watchlist]);

  // Advance toast queue when activeToast clears
  useEffect(() => {
    if (activeToast !== null) return;
    if (toastQueue.length === 0) return;
    setToastQueue(queue => {
      const [next, ...rest] = queue;
      setActiveToast(next);
      return rest;
    });
  }, [activeToast, toastQueue.length]);

  const checkSignals = useCallback(async (symbolList: string[]) => {
    if (symbolList.length === 0) return;
    setIsChecking(true);

    const previousSymbols = new Set(currentSignalsRef.current.map(s => s.symbol));
    const newCurrentSignals: WatcherSignal[] = [];
    const newPrices: Record<string, number> = {};
    const now = Date.now();

    await Promise.all(
      symbolList.map(async (symbol) => {
        const klines = await fetchKlinesForSymbol(symbol);
        if (!klines || klines.length < 3) return;

        const closePrices = klines.map(k => parseFloat(k[4]));
        const volumes = klines.map(k => parseFloat(k[5]));
        const currentPrice = closePrices[closePrices.length - 1];

        newPrices[symbol] = currentPrice;

        // Reconstruct price history from kline close prices spaced 1 minute apart
        const priceHistory: PricePoint[] = klines.map((k, i) => ({
          price: parseFloat(k[4]),
          timestamp: now - (klines.length - 1 - i) * 60 * 1000,
        }));

        const priceResult = checkPriceMomentum(priceHistory, now);
        const volumeResult = checkVolumeSpike(volumes);

        if (priceResult.met && volumeResult.met) {
          newCurrentSignals.push({
            symbol,
            price: currentPrice,
            priceChangePct: priceResult.changePct,
            volumeRatio: volumeResult.ratio,
            enteredAt: now,
          });
        }
      })
    );

    // Move signals that exited to past
    const exited = currentSignalsRef.current.filter(
      s => !newCurrentSignals.some(ns => ns.symbol === s.symbol)
    );
    if (exited.length > 0) {
      const exitedWithTime = exited.map(s => ({ ...s, exitedAt: now }));
      setPastSignals(prev => [...exitedWithTime, ...prev].slice(0, MAX_PAST_SIGNALS));
    }

    const newlyFound = newCurrentSignals.filter(s => !previousSymbols.has(s.symbol));

    setPrices(newPrices);
    currentSignalsRef.current = newCurrentSignals;
    setCurrentSignals(newCurrentSignals);
    setLastChecked(now);
    setRefreshResult({ newCount: newlyFound.length, checkedAt: now });
    setIsChecking(false);

    if (newlyFound.length > 0) {
      setToastQueue(q => [...q, ...newlyFound]);
    }
  }, []);

  // Single check on page load
  useEffect(() => {
    checkSignals(watchlistRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = useCallback(() => {
    checkSignals(watchlistRef.current);
  }, [checkSignals]);

  const addToWatchlist = useCallback((symbol: string) => {
    setWatchlist(prev => {
      if (prev.includes(symbol) || prev.length >= MAX_WATCHLIST) return prev;
      return [...prev, symbol];
    });
  }, []);

  const removeFromWatchlist = useCallback((symbol: string) => {
    setWatchlist(prev => prev.filter(s => s !== symbol));
    const updated = currentSignalsRef.current.filter(s => s.symbol !== symbol);
    currentSignalsRef.current = updated;
    setCurrentSignals(updated);
  }, []);

  const dismissToast = useCallback(() => {
    setActiveToast(null);
  }, []);

  return {
    watchlist,
    currentSignals,
    pastSignals,
    prices,
    activeToast,
    isChecking,
    lastChecked,
    refreshResult,
    addToWatchlist,
    removeFromWatchlist,
    dismissToast,
    refresh,
  };
}
