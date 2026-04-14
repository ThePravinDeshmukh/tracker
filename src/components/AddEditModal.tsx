import React, { useState, useEffect, useRef } from 'react';
import { useAvailablePairs } from '../hooks/useAvailablePairs';
import { Holding } from '../types';

interface Props {
  existing: Holding | null;
  onSave: (symbol: string, avgPrice: string, qty: string, stopLoss: string) => void;
  onClose: () => void;
}

export default function AddEditModal({ existing, onSave, onClose }: Props) {
  const [symbol, setSymbol] = useState(existing?.symbol ?? '');
  const [coinSearch, setCoinSearch] = useState(existing?.symbol ?? '');
  const [showDropdown, setShowDropdown] = useState(false);
  const [avgPrice, setAvgPrice] = useState(existing?.avgPrice ? String(existing.avgPrice) : '');
  const [qty, setQty] = useState(existing?.qty ? String(existing.qty) : '');
  const [stopLoss, setStopLoss] = useState(existing?.stopLoss ? String(existing.stopLoss) : '');
  const [error, setError] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  const { allSymbols, loading: loadingCoins } = useAvailablePairs();

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredCoins = allSymbols.filter(c =>
    c.toLowerCase().includes(coinSearch.toLowerCase())
  );

  const handleCoinSelect = (coin: string): void => {
    setSymbol(coin);
    setCoinSearch(coin);
    setShowDropdown(false);
    setError('');
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const val = e.target.value.toUpperCase();
    setCoinSearch(val);
    setSymbol('');
    setShowDropdown(true);
    setError('');
    if (allSymbols.includes(val)) {
      setSymbol(val);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    if (!symbol) return setError('Select a coin from the list');
    if (!avgPrice || parseFloat(avgPrice) <= 0) return setError('Enter a valid avg price');
    if (!qty || parseFloat(qty) <= 0) return setError('Enter a valid quantity');
    onSave(symbol, avgPrice, qty, stopLoss);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal fade-in">
        <div className="modal-header">
          <h2>{existing ? 'Edit Holding' : 'Add Holding'}</h2>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Coin</label>
            {existing ? (
              <input type="text" value={symbol} disabled />
            ) : (
              <div className="coin-search-wrapper" ref={wrapperRef}>
                <input
                  type="text"
                  placeholder="Search coin… (e.g. BTC, ETH)"
                  value={coinSearch}
                  onChange={handleSearchChange}
                  onFocus={() => setShowDropdown(true)}
                  autoComplete="off"
                  autoFocus
                />
                {showDropdown && loadingCoins && (
                  <ul className="coin-dropdown">
                    <li className="no-match">Loading coins…</li>
                  </ul>
                )}
                {showDropdown && !loadingCoins && filteredCoins.length > 0 && (
                  <ul className="coin-dropdown">
                    {filteredCoins.map(c => (
                      <li
                        key={c}
                        className={c === symbol ? 'selected' : ''}
                        onMouseDown={() => handleCoinSelect(c)}
                      >
                        {c}
                      </li>
                    ))}
                  </ul>
                )}
                {showDropdown && !loadingCoins && coinSearch.length > 0 && filteredCoins.length === 0 && (
                  <ul className="coin-dropdown">
                    <li className="no-match">No coins found</li>
                  </ul>
                )}
              </div>
            )}
          </div>

          <div className="field">
            <label>Avg Buy Price (USD)</label>
            <input
              type="number"
              step="any"
              min="0"
              placeholder="e.g. 42000"
              value={avgPrice}
              onChange={e => { setAvgPrice(e.target.value); setError(''); }}
              autoFocus={!!existing}
            />
          </div>

          <div className="field">
            <label>Total Quantity</label>
            <input
              type="number"
              step="any"
              min="0"
              placeholder="e.g. 0.5"
              value={qty}
              onChange={e => { setQty(e.target.value); setError(''); }}
            />
          </div>

          <div className="field">
            <label>Stop Loss (USD) <span className="optional">optional</span></label>
            <input
              type="number"
              step="any"
              min="0"
              placeholder="e.g. 38000"
              value={stopLoss}
              onChange={e => setStopLoss(e.target.value)}
            />
          </div>

          {error && <div className="error">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn primary">
              {existing ? 'Update' : 'Add to Portfolio'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
