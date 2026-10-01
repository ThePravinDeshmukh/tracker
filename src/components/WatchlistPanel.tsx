import React, { useState, useEffect, useRef } from 'react';
import { PriceMap, WatchlistSortKey, MomentumRow, VolumeMomentumMap } from '../types';
import { getCoinIcon, getCoinColor } from '../hooks/useCryptoPrices';
import { useAvailablePairs } from '../hooks/useAvailablePairs';
import { TOP_VOLUME_COUNT } from '../hooks/useTopVolumeCoins';
import { filterByDeltaAvailability, sortWatchlistSymbols } from '../utils/watchlist';
import WatchlistRows from './WatchlistRows';

interface Props {
  watchlist: string[];
  topVolumeCoins: string[];
  deltaTradableAssets: string[] | null;
  prices: PriceMap;
  change24h: PriceMap;
  volumes: PriceMap;
  high24h: PriceMap;
  low24h: PriceMap;
  trades24h: Record<string, number>;
  momentumRows: MomentumRow[];
  volumeMomentum: VolumeMomentumMap;
  onAdd: (symbol: string) => void;
  onRemove: (symbol: string) => void;
  onViewChart: (symbol: string) => void;
}

function SortSelect({ value, onChange }: { value: WatchlistSortKey; onChange: (sortBy: WatchlistSortKey) => void }) {
  return (
    <select
      className="sort-select"
      value={value}
      onChange={e => onChange(e.target.value as WatchlistSortKey)}
    >
      <option value="volume">Sort: Volume</option>
      <option value="name">Sort: Name</option>
      <option value="price">Sort: Price</option>
      <option value="change">Sort: 24h Change</option>
    </select>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="watchlist-section-title">{children}</div>;
}

// Popular coins shown before API pairs load
const POPULAR_COINS = [
  'BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT','ADAUSDT','AVAXUSDT','DOTUSDT','MATICUSDT','LINKUSDT',
  'LTCUSDT','UNIUSDT','ATOMUSDT','DOGEUSDT','SUIUSDT','APTUSDT','OPUSDT','ARBUSDT','NEARUSDT','PEPEUSDT',
  'TRXUSDT','TONUSDT','HBARUSDT','SHIBUSDT','FETUSDT','WIFUSDT','TIAUSDT','JUPUSDT','RENDERUSDT','SEIUSDT',
  'HUSDT',
];

export default function WatchlistPanel({ watchlist, topVolumeCoins, deltaTradableAssets, prices, change24h, volumes, high24h, low24h, trades24h, momentumRows, volumeMomentum, onAdd, onRemove, onViewChart }: Props) {
  const [search, setSearch] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [sortBy, setSortBy] = useState<WatchlistSortKey>('volume');
  const inputRef = useRef<HTMLInputElement>(null);
  const { allSymbols, loading } = useAvailablePairs();

  const marketData = { prices, change24h, volumes };
  const sortedWatchlist = sortWatchlistSymbols(watchlist, sortBy, marketData);
  const sortedTopVolume = sortWatchlistSymbols(topVolumeCoins, sortBy, marketData);
  const rowProps = { userAddedSymbols: watchlist, prices, change24h, volumes, high24h, low24h, trades24h, momentumRows, volumeMomentum, onAdd, onRemove, onViewChart };

  // Use API symbols when loaded, fall back to popular coins
  const symbolPool = allSymbols.length > 0 ? allSymbols : POPULAR_COINS;

  const suggestions = filterByDeltaAvailability(symbolPool, deltaTradableAssets)
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
          <SortSelect value={sortBy} onChange={setSortBy} />
          <button className="btn primary" onClick={() => setShowInput(true)}>+ Add Coin</button>
        </div>
      )}

      <SectionTitle>Watching</SectionTitle>
      {sortedWatchlist.length === 0
        ? <div className="watcher-empty watchlist-section-empty">No watchlist coins yet — add coins to monitor their live prices and momentum</div>
        : <WatchlistRows symbols={sortedWatchlist} {...rowProps} />}

      <SectionTitle>Top {TOP_VOLUME_COUNT} by 24h Volume</SectionTitle>
      {sortedTopVolume.length === 0
        ? <div className="watcher-empty watchlist-section-empty">Loading top coins by volume…</div>
        : <WatchlistRows symbols={sortedTopVolume} {...rowProps} />}
    </div>
  );
}
