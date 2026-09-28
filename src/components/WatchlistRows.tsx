import React, { useState } from 'react';
import { PriceMap, MomentumRow, VolumeMomentumMap } from '../types';
import { getCoinIcon, getCoinColor } from '../hooks/useCryptoPrices';
import { TOP_VOLUME_COUNT } from '../hooks/useTopVolumeCoins';
import { MOMENTUM_WINDOW_HOURS } from '../utils/volumeMomentum';
import CryptoDetailPanel from './CryptoDetailPanel';

interface Props {
  symbols: string[];
  userAddedSymbols: string[];
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

export default function WatchlistRows({ symbols, userAddedSymbols, prices, change24h, volumes, high24h, low24h, trades24h, momentumRows, volumeMomentum, onAdd, onRemove, onViewChart }: Props) {
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);

  return (
    <>
      <div className="watchlist-header">
        <span>Asset</span>
        <span>Live Price</span>
        <span>24h Change</span>
        <span>24h Volume</span>
        <span></span>
      </div>
      {symbols.map(symbol => {
        const price     = prices[symbol];
        const color     = getCoinColor(symbol);
        const icon      = getCoinIcon(symbol);
        const changePct = change24h[symbol];
        const hasChange = changePct !== undefined && !isNaN(changePct);
        const priceDir  = hasChange ? (changePct > 0 ? 'pos' : changePct < 0 ? 'neg' : '') : '';
        const isExpanded = expandedSymbol === symbol;
        const momentumRow = momentumRows.find(r => r.symbol === symbol);
        const isUserAdded = userAddedSymbols.includes(symbol);

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
                {volumeMomentum[symbol] !== undefined && (
                  <span
                    className="volume-surge-badge"
                    title={`Last ${MOMENTUM_WINDOW_HOURS}h volume is ${volumeMomentum[symbol].toFixed(1)}x the day's average pace`}
                  >
                    🔥 {volumeMomentum[symbol].toFixed(1)}x
                  </span>
                )}
              </span>
              <span className="watchlist-add-slot">
                {!isUserAdded && (
                  <button
                    className="btn-icon add"
                    onClick={e => { e.stopPropagation(); onAdd(symbol); }}
                    title={`Add ${symbol} to watchlist`}
                  >
                    +
                  </button>
                )}
              </span>
              <span className={`watchlist-chevron${isExpanded ? ' open' : ''}`}>▶</span>
              {isUserAdded ? (
                <button
                  className="btn-icon del"
                  onClick={e => { e.stopPropagation(); onRemove(symbol); }}
                  title={`Remove ${symbol}`}
                >
                  ×
                </button>
              ) : (
                <span className="watchlist-default-badge" title={`Top ${TOP_VOLUME_COUNT} by 24h volume`}>
                  TOP{TOP_VOLUME_COUNT}
                </span>
              )}
            </div>
            {isExpanded && (
              <CryptoDetailPanel
                price={price}
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
  );
}
