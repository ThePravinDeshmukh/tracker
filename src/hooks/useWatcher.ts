import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { WatcherSignal } from '../types';
import { useAvailablePairs } from './useAvailablePairs';
import {
  PricePoint,
  checkPriceMomentum,
  checkVolumeSpike,
  pruneOldPriceHistory,
  MAX_VOLUME_READINGS,
} from '../utils/watcherSignals';

const STORAGE_KEY = 'watcher-watchlist';
const MAX_WATCHLIST = 20;
const MAX_PAST_SIGNALS = 20;
const SPOT_WS_URL = 'wss://stream.binance.com:9443/stream';
const FUTURES_WS_URL = 'wss://fstream.binance.com/stream';
const FALLBACK_FUTURES_ONLY = new Set<string>(['DUSK', 'HANA']);

function toUsdtPair(symbol: string): string {
  return `${symbol.toUpperCase()}USDT`;
}

function buildStreamUrl(baseWsUrl: string, pairs: string[]): string {
  const streams = pairs.map(p => `${p.toLowerCase()}@ticker`).join('/');
  return `${baseWsUrl}?streams=${streams}`;
}

export interface UseWatcherResult {
  watchlist: string[];
  currentSignals: WatcherSignal[];
  pastSignals: WatcherSignal[];
  prices: Record<string, number>;
  activeToast: WatcherSignal | null;
  addToWatchlist: (symbol: string) => void;
  removeFromWatchlist: (symbol: string) => void;
  dismissToast: () => void;
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

  // Refs hold mutable history without triggering re-renders on every tick
  const priceHistoryRef = useRef<Record<string, PricePoint[]>>({});
  const volumeHistoryRef = useRef<Record<string, number[]>>({});
  const currentSignalsRef = useRef<WatcherSignal[]>([]);

  const { spotSymbols: availableSpot, futuresSymbols: availableFutures } = useAvailablePairs();

  const futuresOnlySet = useMemo(() => {
    if (availableSpot.length === 0 && availableFutures.length === 0) return FALLBACK_FUTURES_ONLY;
    const spotSet = new Set(availableSpot);
    return new Set(availableFutures.filter(s => !spotSet.has(s)));
  }, [availableSpot, availableFutures]);

  // Persist watchlist
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(watchlist));
  }, [watchlist]);

  // Advance toast queue when activeToast is dismissed
  useEffect(() => {
    if (activeToast !== null) return;
    if (toastQueue.length === 0) return;
    setToastQueue(queue => {
      const [next, ...rest] = queue;
      setActiveToast(next);
      return rest;
    });
  }, [activeToast, toastQueue.length]);

  const processTick = useCallback((symbol: string, price: number, volume: number) => {
    const now = Date.now();

    // Update price history
    const rawHistory = priceHistoryRef.current[symbol] ?? [];
    priceHistoryRef.current[symbol] = pruneOldPriceHistory(
      [...rawHistory, { price, timestamp: now }],
      now
    );

    // Update volume history
    if (!isNaN(volume) && volume > 0) {
      const volHistory = volumeHistoryRef.current[symbol] ?? [];
      volumeHistoryRef.current[symbol] = [...volHistory, volume].slice(-MAX_VOLUME_READINGS);
    }

    setPrices(prev => ({ ...prev, [symbol]: price }));

    const priceResult = checkPriceMomentum(priceHistoryRef.current[symbol], now);
    const volumeResult = checkVolumeSpike(volumeHistoryRef.current[symbol] ?? []);
    const conditionMet = priceResult.met && volumeResult.met;
    const wasSignaling = currentSignalsRef.current.some(s => s.symbol === symbol);

    if (conditionMet && !wasSignaling) {
      const newSignal: WatcherSignal = {
        symbol,
        price,
        priceChangePct: priceResult.changePct,
        volumeRatio: volumeResult.ratio,
        enteredAt: now,
      };
      const updated = [...currentSignalsRef.current, newSignal];
      currentSignalsRef.current = updated;
      setCurrentSignals(updated);
      setToastQueue(q => [...q, newSignal]);
    } else if (conditionMet && wasSignaling) {
      // Keep stats live while signal is active
      const updated = currentSignalsRef.current.map(s =>
        s.symbol === symbol
          ? { ...s, price, priceChangePct: priceResult.changePct, volumeRatio: volumeResult.ratio }
          : s
      );
      currentSignalsRef.current = updated;
      setCurrentSignals(updated);
    } else if (!conditionMet && wasSignaling) {
      const exiting = currentSignalsRef.current.find(s => s.symbol === symbol);
      if (exiting) {
        const exited: WatcherSignal = { ...exiting, exitedAt: now };
        const updatedCurrent = currentSignalsRef.current.filter(s => s.symbol !== symbol);
        currentSignalsRef.current = updatedCurrent;
        setCurrentSignals(updatedCurrent);
        setPastSignals(prev => [exited, ...prev].slice(0, MAX_PAST_SIGNALS));
      }
    }
  }, []);

  // WebSocket connections — reconnect when watchlist or futures routing changes
  const futuresKey = useMemo(
    () => Array.from(futuresOnlySet).sort().join(','),
    [futuresOnlySet]
  );

  useEffect(() => {
    if (watchlist.length === 0) return;

    const upper = watchlist.map(s => s.toUpperCase());
    const spotSymbols = upper.filter(s => !futuresOnlySet.has(s));
    const futuresSymbols = upper.filter(s => futuresOnlySet.has(s));
    const connections: WebSocket[] = [];

    const openStream = (baseUrl: string, symbols: string[]): WebSocket => {
      const ws = new WebSocket(buildStreamUrl(baseUrl, symbols.map(toUsdtPair)));
      ws.onmessage = (event: MessageEvent) => {
        try {
          const { data } = JSON.parse(event.data as string);
          if (!data?.s || !data?.c) return;
          const symbol = (data.s as string).replace(/USDT$/, '');
          processTick(symbol, parseFloat(data.c as string), parseFloat(data.q as string));
        } catch {}
      };
      return ws;
    };

    if (spotSymbols.length > 0) connections.push(openStream(SPOT_WS_URL, spotSymbols));
    if (futuresSymbols.length > 0) connections.push(openStream(FUTURES_WS_URL, futuresSymbols));

    return () => connections.forEach(ws => ws.close());
  }, [watchlist.join(','), futuresKey, processTick]); // eslint-disable-line

  const addToWatchlist = useCallback((symbol: string) => {
    setWatchlist(prev => {
      if (prev.includes(symbol) || prev.length >= MAX_WATCHLIST) return prev;
      return [...prev, symbol];
    });
  }, []);

  const removeFromWatchlist = useCallback((symbol: string) => {
    setWatchlist(prev => prev.filter(s => s !== symbol));
    // Clear state for removed coin
    const updated = currentSignalsRef.current.filter(s => s.symbol !== symbol);
    currentSignalsRef.current = updated;
    setCurrentSignals(updated);
    delete priceHistoryRef.current[symbol];
    delete volumeHistoryRef.current[symbol];
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
    addToWatchlist,
    removeFromWatchlist,
    dismissToast,
  };
}
