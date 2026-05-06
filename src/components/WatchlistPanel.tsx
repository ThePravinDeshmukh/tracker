import React, { useState, useEffect, useRef } from 'react';
import { PriceMap, WatchlistSortKey, MomentumRow } from '../types';
import { getCoinIcon, getCoinColor } from '../hooks/useCryptoPrices';
import { useAvailablePairs } from '../hooks/useAvailablePairs';
import CryptoDetailPanel from './CryptoDetailPanel';

function sortWatchlist(symbols: string[], sortBy: WatchlistSortKey, prices: PriceMap, change24h: PriceMap, volumes: PriceMap): string[] {
  return [...symbols].sort((a, b) => {
    if (sortBy === 'volume') return (volumes[b] ?? 0) - (volumes[a] ?? 0);
    if (sortBy === 'price')  return (prices[b] ?? 0) - (prices[a] ?? 0);
    if (sortBy === 'change') return (change24h[b] ?? 0) - (change24h[a] ?? 0);
    return a.localeCompare(b);
  });
}

interface Props {
  watchlist: string[];
  prices: PriceMap;
  prevPrices: PriceMap;
  change24h: PriceMap;
  volumes: PriceMap;
  high24h: PriceMap;
  low24h: PriceMap;
  trades24h: Record<string, number>;
  momentumRows: MomentumRow[];
  onAdd: (symbol: string) => void;
  onRemove: (symbol: string) => void;
  onViewChart: (symbol: string) => void;
}

function fmtVolume(vol: number | undefined): string {
  if (vol === undefined || isNaN(vol)) return '—';
  if (vol >= 1_000_000_000) return `$${(vol / 1_000_000_000).toFixed(2)}B`;
  if (vol >= 1_000_000)     return `$${(vol / 1_000_000).toFixed(2)}M`;
  if (vol >= 1_000)         return `$${(vol / 1_000).toFixed(1)}K`;
  return `$${vol.toFixed(0)}`;
}

function fmtPrice(price: number | undefined): string {
  if (price === undefined || isNaN(price)) return '—';
  if (price >= 1000) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 1)    return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  return price.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 });
}

// Popular coins shown before API pairs load
const POPULAR_COINS = [
  'BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT','ADAUSDT','AVAXUSDT','DOTUSDT','MATICUSDT','LINKUSDT',
  'LTCUSDT','UNIUSDT','ATOMUSDT','DOGEUSDT','SUIUSDT','APTUSDT','OPUSDT','ARBUSDT','NEARUSDT','PEPEUSDT',
  'TRXUSDT','TONUSDT','HBARUSDT','SHIBUSDT','FETUSDT','WIFUSDT','TIAUSDT','JUPUSDT','RENDERUSDT','SEIUSDT',
];

export default function WatchlistPanel({ watchlist, prices, prevPrices, change24h, volumes, high24h, low24h, trades24h, momentumRows, onAdd, onRemove, onViewChart }: Props) {
  const [search, setSearch] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [sortBy, setSortBy] = useState<WatchlistSortKey>('volume');
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { allSymbols, loading } = useAvailablePairs();

  const sorted = sortWatchlist(watchlist, sortBy, prices, change24h, volumes);

  // Use API symbols when loaded, fall back to popular coins
  const symbolPool = allSymbols.length > 0 ? allSymbols : POPULAR_COINS;

  const suggestions = symbolPool
    .filter(s => !watchlist.includes(s))
    .filter(s => search === '' || s.includes(search.toUpperCase()))
    .slice(0, 40);

  // Focus input when opened
  useEffect(() => {
    if (showInput) inputRef.current?.focus();
  }, [showInput]);

  const handleSelect = (symbol: string): void => {
    onAdd(symbol);
    setSearch('');
    inputRef.current?.focus();
  };

  const cancelAdd = (): void => {
    setShowInput(false);
    setSearch('');
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

      {/* Add coin search bar */}
      {showInput ? (
        <>
          <div className="watchlist-add-bar">
            <input
              ref={inputRef}
              className="watchlist-search-input"
              placeholder={loading ? 'Loading pairs… or press Enter to add' : 'Type to filter or press Enter to add'}
              value={search}
              onChange={e => setSearch(e.target.value.toUpperCase())}
              onKeyDown={e => { if (e.key === 'Enter' && search.trim()) handleSelect(search.trim()); }}
            />
            <button className="btn-icon" onClick={cancelAdd} title="Cancel">✕</button>
          </div>

          {/* Inline suggestions — part of normal flow, no absolute positioning */}
          <div className="watchlist-suggestions">
            {suggestions.length === 0
              ? <div className="watchlist-no-match muted">No matches for "{search}"</div>
              : suggestions.map(coin => {
                  const color = getCoinColor(coin);
                  const icon  = getCoinIcon(coin);
                  return (
                    <button
                      key={coin}
                      className="watchlist-suggestion"
                      onClick={() => handleSelect(coin)}
                    >
                      <span className="wsug-icon" style={{ background: color }}>{icon}</span>
                      <span className="wsug-symbol">{coin}</span>
                      <span className="wsug-add">+ Add</span>
                    </button>
                  );
                })
            }
          </div>
        </>
      ) : (
        <div className="watchlist-add-row">
          <select
            className="sort-select"
            value={sortBy}
            onChange={e => setSortBy(e.target.value as WatchlistSortKey)}
          >
            <option value="volume">Sort: Volume</option>
            <option value="name">Sort: Name</option>
            <option value="price">Sort: Price</option>
            <option value="change">Sort: 24h Change</option>
          </select>
          <button className="btn primary" onClick={() => setShowInput(true)}>+ Add Coin</button>
        </div>
      )}

      {/* Coin list */}
      {sorted.length > 0 && !showInput && (
        <>
          <div className="watchlist-header">
            <span>Asset</span>
            <span>Live Price</span>
            <span>24h Change</span>
            <span>24h Volume</span>
            <span></span>
          </div>
          {sorted.map(symbol => {
            const price     = prices[symbol];
            const color     = getCoinColor(symbol);
            const icon      = getCoinIcon(symbol);
            const changePct = change24h[symbol];
            const hasChange = changePct !== undefined && !isNaN(changePct);
            const priceDir  = hasChange ? (changePct > 0 ? 'pos' : changePct < 0 ? 'neg' : '') : '';
            const isExpanded = expandedSymbol === symbol;
            const momentumRow = momentumRows.find(r => r.symbol === symbol);

            const handleRowClick = (): void => {
              setExpandedSymbol(isExpanded ? null : symbol);
            };

            return (
              <div key={symbol} className={`watchlist-row-wrap${isExpanded ? ' expanded' : ''}`}>
                <div
                  className={`watchlist-row${isExpanded ? ' watchlist-row-expanded' : ''}`}
                  onClick={handleRowClick}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') handleRowClick(); }}
                >
                  <button
                    className="watchlist-asset watchlist-asset-btn"
                    onClick={e => { e.stopPropagation(); onViewChart(symbol); }}
                    title={`View ${symbol} chart`}
                  >
                    <span className="watchlist-coin-icon" style={{ background: color }}>{icon}</span>
                    <span className="watchlist-symbol">{symbol}</span>
                  </button>
                  <span className={`watchlist-price mono ${priceDir}`}>
                    {price !== undefined ? `$${fmtPrice(price)}` : '—'}
                  </span>
                  <span className={`watchlist-change mono ${priceDir}`}>
                    {hasChange
                      ? `${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%`
                      : '—'}
                  </span>
                  <span className="watchlist-volume mono muted">
                    {fmtVolume(volumes[symbol])}
                  </span>
                  <span className={`watchlist-chevron${isExpanded ? ' open' : ''}`}>▶</span>
                  <button
                    className="btn-icon del"
                    onClick={e => { e.stopPropagation(); onRemove(symbol); }}
                    title={`Remove ${symbol}`}
                  >
                    ×
                  </button>
                </div>
                {isExpanded && (
                  <CryptoDetailPanel
                    symbol={symbol}
                    price={price}
                    change24h={changePct}
                    volume24h={volumes[symbol]}
                    high24h={high24h[symbol]}
                    low24h={low24h[symbol]}
                    trades24h={trades24h[symbol]}
                    momentumRow={momentumRow}
                  />
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
