import { useState, useEffect } from 'react';

const STORAGE_KEY = 'crypto_watchlist_v1';

function loadFromStorage(): string[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? (JSON.parse(saved) as string[]) : [];
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
