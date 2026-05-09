import { useState, useEffect } from 'react';
import { ClosedTrade } from '../types';

const HISTORY_KEY = 'crypto_trade_history_v1';

function loadFromStorage(): ClosedTrade[] {
  try {
    const saved = localStorage.getItem(HISTORY_KEY);
    return saved ? (JSON.parse(saved) as ClosedTrade[]) : [];
  } catch {
    return [];
  }
}

interface UseTradeHistoryResult {
  trades: ClosedTrade[];
  addTrade: (trade: Omit<ClosedTrade, 'id'>) => void;
  clearHistory: () => void;
}

export function useTradeHistory(): UseTradeHistoryResult {
  const [trades, setTrades] = useState<ClosedTrade[]>(loadFromStorage);

  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(trades));
  }, [trades]);

  const addTrade = (trade: Omit<ClosedTrade, 'id'>): void => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setTrades(prev => [{ id, ...trade }, ...prev]);
  };

  const clearHistory = (): void => setTrades([]);

  return { trades, addTrade, clearHistory };
}
