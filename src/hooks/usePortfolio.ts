import { useState, useEffect } from 'react';
import { Holding } from '../types';

const STORAGE_KEY = 'crypto_portfolio_v1';

function loadFromStorage(): Holding[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? (JSON.parse(saved) as Holding[]) : [];
  } catch {
    return [];
  }
}

interface UsePortfolioResult {
  holdings: Holding[];
  addOrUpdateHolding: (symbol: string, avgPrice: string | number, qty: string | number) => void;
  addToHolding: (symbol: string, newPrice: number, newQty: number) => void;
  removeHolding: (symbol: string) => void;
}

export function usePortfolio(): UsePortfolioResult {
  const [holdings, setHoldings] = useState<Holding[]>(loadFromStorage);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(holdings));
  }, [holdings]);

  const addOrUpdateHolding = (symbol: string, avgPrice: string | number, qty: string | number): void => {
    setHoldings(prev => {
      const existingIndex = prev.findIndex(h => h.symbol === symbol);
      const holding: Holding = { symbol, avgPrice: parseFloat(String(avgPrice)), qty: parseFloat(String(qty)) };
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = holding;
        return updated;
      }
      return [...prev, holding];
    });
  };

  const addToHolding = (symbol: string, newPrice: number, newQty: number): void => {
    setHoldings(prev => prev.map(h => {
      if (h.symbol !== symbol) return h;
      const totalQty = h.qty + newQty;
      const newAvgPrice = (h.avgPrice * h.qty + newPrice * newQty) / totalQty;
      return { symbol, avgPrice: newAvgPrice, qty: totalQty };
    }));
  };

  const removeHolding = (symbol: string): void => {
    setHoldings(prev => prev.filter(h => h.symbol !== symbol));
  };

  return { holdings, addOrUpdateHolding, addToHolding, removeHolding };
}
