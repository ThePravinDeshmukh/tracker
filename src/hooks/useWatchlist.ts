import { useState, useEffect } from 'react';

const STORAGE_KEY = 'crypto_watchlist_v1';

function toFullPair(symbol: string): string {
  return symbol.endsWith('USDT') ? symbol : `${symbol}USDT`;
}

function loadFromStorage(): string[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const watchlist = saved ? (JSON.parse(saved) as string[]) : [];
    return watchlist.map(toFullPair);
  } catch {
    return [];
  }
}

interface UseWatchlistResult {
  watchlist: string[];
  addToWatchlist: (symbol: string) => void;
  removeFromWatchlist: (symbol: string) => void;
}

export function useWatchlist(): UseWatchlistResult {
  const [watchlist, setWatchlist] = useState<string[]>(loadFromStorage);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(watchlist));
  }, [watchlist]);

  const addToWatchlist = (symbol: string): void => {
    setWatchlist(prev => prev.includes(symbol) ? prev : [...prev, symbol]);
  };

  const removeFromWatchlist = (symbol: string): void => {
    setWatchlist(prev => prev.filter(s => s !== symbol));
  };

  return { watchlist, addToWatchlist, removeFromWatchlist };
}
