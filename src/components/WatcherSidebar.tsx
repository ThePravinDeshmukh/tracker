import React, { useState, useRef, useEffect } from 'react';
import { WatcherSignal } from '../types';
import { useAvailablePairs } from '../hooks/useAvailablePairs';

const MAX_WATCHLIST = 20;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  watchlist: string[];
  currentSignals: WatcherSignal[];
  pastSignals: WatcherSignal[];
  prices: Record<string, number>;
  onAdd: (symbol: string) => void;
  onRemove: (symbol: string) => void;
}

function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}min ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

function fmtPrice(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function WatcherSidebar({
  isOpen,
  onClose,
  watchlist,
  currentSignals,
  pastSignals,
  prices,
  onAdd,
  onRemove,
}: Props) {
  const [coinSearch, setCoinSearch] = useState('');
  const [showAddInput, setShowAddInput] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const { allSymbols } = useAvailablePairs();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close add input when sidebar closes
  useEffect(() => {
    if (!isOpen) {
      setShowAddInput(false);
      setCoinSearch('');
    }
  }, [isOpen]);

  const filteredCoins = allSymbols
    .filter(c => !watchlist.includes(c))
    .filter(c => c.toLowerCase().includes(coinSearch.toLowerCase()))
    .slice(0, 30);

  const handleSelect = (symbol: string): void => {
    onAdd(symbol);
    setCoinSearch('');
    setShowAddInput(false);
    setShowDropdown(false);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setCoinSearch(e.target.value.toUpperCase());
    setShowDropdown(true);
  };

  return (
    <>
      {isOpen && <div className="watcher-overlay" onClick={onClose} />}
      <div className={`watcher-sidebar${isOpen ? ' open' : ''}`}>
        {/* Header */}
        <div className="watcher-header">
          <span className="watcher-title">Watcher</span>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        <div className="watcher-body">
          {/* Current Signals */}
          <div className="watcher-section">
            <div className="watcher-section-label">
              {currentSignals.length > 0 && <span className="pulse-dot" />}
              Current Signals ({currentSignals.length})
            </div>
            {currentSignals.length === 0 ? (
              <div className="watcher-empty">No active signals</div>
            ) : (
              currentSignals.map(signal => (
                <div key={signal.symbol} className="watcher-signal-card current">
                  <div className="watcher-signal-top">
                    <span className="watcher-signal-sym">{signal.symbol}</span>
                    <span className="watcher-signal-price mono">${fmtPrice(signal.price)}</span>
                  </div>
                  <div className="watcher-signal-meta">
                    <span className="pos">+{signal.priceChangePct.toFixed(1)}% 5min</span>
                    <span className="muted-text">{signal.volumeRatio.toFixed(1)}× vol</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Past Signals */}
          <div className="watcher-section">
            <div className="watcher-section-label">Past Signals</div>
            {pastSignals.length === 0 ? (
              <div className="watcher-empty">None yet</div>
            ) : (
              pastSignals.map((signal, index) => (
                <div key={`${signal.symbol}-${signal.exitedAt ?? index}`} className="watcher-signal-card past">
                  <div className="watcher-signal-top">
                    <span className="watcher-signal-sym">{signal.symbol}</span>
                    <span className="watcher-signal-price mono">${fmtPrice(signal.price)}</span>
                  </div>
                  <div className="watcher-signal-meta">
                    <span className="muted-text">
                      {signal.exitedAt ? formatRelativeTime(signal.exitedAt) : '—'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Watchlist */}
          <div className="watcher-section">
            <div className="watcher-section-label">
              <span>Watchlist</span>
              <button
                className="btn-icon add"
                onClick={() => setShowAddInput(v => !v)}
                disabled={watchlist.length >= MAX_WATCHLIST}
                title={watchlist.length >= MAX_WATCHLIST ? 'Watchlist full (20 max)' : 'Add coin'}
              >
                +
              </button>
            </div>

            {showAddInput && (
              <div className="coin-search-wrapper" ref={searchRef}>
                <input
                  className="watcher-search-input"
                  placeholder="Search coin..."
                  value={coinSearch}
                  onChange={handleSearchChange}
                  autoFocus
                />
                {showDropdown && coinSearch.length > 0 && (
                  <ul className="coin-dropdown">
                    {filteredCoins.length > 0
                      ? filteredCoins.map(coin => (
                          <li key={coin} onClick={() => handleSelect(coin)}>{coin}</li>
                        ))
                      : <li className="no-match">No matches</li>
                    }
                  </ul>
                )}
              </div>
            )}

            {watchlist.length === 0 ? (
              <div className="watcher-empty">No coins — click + to add</div>
            ) : (
              watchlist.map(symbol => (
                <div key={symbol} className="watcher-coin-row">
                  <span className="watcher-signal-sym">{symbol}</span>
                  <span className="watcher-signal-price mono">
                    {prices[symbol] != null ? `$${fmtPrice(prices[symbol])}` : '—'}
                  </span>
                  <button className="btn-icon del" onClick={() => onRemove(symbol)}>×</button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}
