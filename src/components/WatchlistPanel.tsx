import React, { useState, useRef, useEffect } from 'react';
import { PriceMap } from '../types';
import { getCoinIcon, getCoinColor } from '../hooks/useCryptoPrices';
import { useAvailablePairs } from '../hooks/useAvailablePairs';

interface Props {
  watchlist: string[];
  prices: PriceMap;
  prevPrices: PriceMap;
  onAdd: (symbol: string) => void;
  onRemove: (symbol: string) => void;
}

function fmtPrice(price: number | undefined): string {
  if (price === undefined || isNaN(price)) return '—';
  if (price >= 1000) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 1)    return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  return price.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 });
}

export default function WatchlistPanel({ watchlist, prices, prevPrices, onAdd, onRemove }: Props) {
  const [search, setSearch] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const { allSymbols, loading } = useAvailablePairs();

  // Sort watchlist alphabetically by name
  const sorted = [...watchlist].sort((a, b) => a.localeCompare(b));

  const suggestions = allSymbols
    .filter(s => !watchlist.includes(s))
    .filter(s => s.includes(search.toUpperCase()))
    .slice(0, 30);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (symbol: string): void => {
    onAdd(symbol);
    setSearch('');
    setShowInput(false);
    setShowDropdown(false);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setSearch(e.target.value.toUpperCase());
    setShowDropdown(true);
  };

  if (sorted.length === 0 && !showInput) {
    return (
      <div className="empty-state">
        <div className="empty-icon">◉</div>
        <p>No watchlist coins yet</p>
        <p className="empty-sub">Add coins to monitor their live prices and momentum</p>
        <button className="btn primary" onClick={() => setShowInput(true)}>+ Add Coin</button>
      </div>
    );
  }

  return (
    <div className="watchlist-panel">
      {/* Add coin row */}
      <div className="watchlist-add-row">
        {showInput ? (
          <div className="watchlist-search-wrap" ref={searchRef}>
            <input
              className="watcher-search-input"
              placeholder={loading ? 'Loading pairs…' : 'Search symbol…'}
              value={search}
              onChange={handleSearchChange}
              autoFocus
              onFocus={() => search.length > 0 && setShowDropdown(true)}
            />
            {showDropdown && search.length > 0 && (
              <ul className="coin-dropdown">
                {suggestions.length > 0
                  ? suggestions.map(coin => (
                      <li key={coin} onClick={() => handleSelect(coin)}>{coin}</li>
                    ))
                  : <li className="no-match">No matches</li>
                }
              </ul>
            )}
            <button className="btn secondary" onClick={() => { setShowInput(false); setSearch(''); }}>
              Cancel
            </button>
          </div>
        ) : (
          <button className="btn primary" onClick={() => setShowInput(true)}>+ Add Coin</button>
        )}
      </div>

      {/* Watchlist header row */}
      {sorted.length > 0 && (
        <div className="watchlist-header">
          <span>Asset</span>
          <span>Live Price</span>
          <span>Change</span>
          <span></span>
        </div>
      )}

      {/* Watchlist rows */}
      {sorted.map(symbol => {
        const price = prices[symbol];
        const prev  = prevPrices[symbol];
        const color = getCoinColor(symbol);
        const icon  = getCoinIcon(symbol);
        const changePct = price !== undefined && prev !== undefined && prev > 0
          ? ((price - prev) / prev) * 100
          : null;
        const priceDir = changePct !== null ? (changePct > 0 ? 'pos' : changePct < 0 ? 'neg' : '') : '';

        return (
          <div key={symbol} className="watchlist-row">
            <div className="watchlist-asset">
              <span className="watchlist-coin-icon" style={{ background: color }}>{icon}</span>
              <span className="watchlist-symbol">{symbol}</span>
            </div>
            <span className={`watchlist-price mono ${priceDir}`}>
              {price !== undefined ? `$${fmtPrice(price)}` : '—'}
            </span>
            <span className={`watchlist-change mono ${priceDir}`}>
              {changePct !== null
                ? `${changePct >= 0 ? '+' : ''}${changePct.toFixed(3)}%`
                : '—'}
            </span>
            <button
              className="btn-icon del"
              onClick={() => onRemove(symbol)}
              title={`Remove ${symbol}`}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
