import React from 'react';
import { MarketMover } from '../types';
import { baseAssetOf } from '../utils/watchlist';

interface Props {
  topByVolume: MarketMover[];
  topGainers: MarketMover[];
  topLosers: MarketMover[];
}

function fmtPrice(price: number): string {
  if (price >= 1000) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 1) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  return price.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 });
}

function fmtVolume(volume: number): string {
  if (volume >= 1_000_000_000) return `$${(volume / 1_000_000_000).toFixed(2)}B`;
  if (volume >= 1_000_000) return `$${(volume / 1_000_000).toFixed(1)}M`;
  return `$${(volume / 1_000).toFixed(0)}K`;
}

function MoverRow({ mover, metric }: { mover: MarketMover; metric: 'volume' | 'change' }) {
  const isUp = mover.priceChangePct >= 0;
  return (
    <div className="mover-row">
      <span className="mover-symbol mono">{baseAssetOf(mover.symbol)}</span>
      <span className="mover-price mono muted">${fmtPrice(mover.price)}</span>
      {metric === 'volume' ? (
        <span className="mover-volume mono muted">{fmtVolume(mover.quoteVolume)}</span>
      ) : (
        <span className={`mover-change mono ${isUp ? 'pos' : 'neg'}`}>
          {isUp ? '+' : ''}{mover.priceChangePct.toFixed(2)}%
        </span>
      )}
    </div>
  );
}

function MoverList({ movers, metric, emptyText }: { movers: MarketMover[]; metric: 'volume' | 'change'; emptyText: string }) {
  if (movers.length === 0) {
    return <div className="watcher-empty">{emptyText}</div>;
  }
  return (
    <div className="mover-list">
      {movers.map(mover => (
        <MoverRow key={mover.symbol} mover={mover} metric={metric} />
      ))}
    </div>
  );
}

export default function MarketMoversPanel({ topByVolume, topGainers, topLosers }: Props) {
  return (
    <>
      <div className="watcher-section">
        <div className="watcher-section-label">
          <span>Top 20 by Volume</span>
        </div>
        <MoverList movers={topByVolume} metric="volume" emptyText="Loading volume leaders…" />
      </div>

      <div className="watcher-section">
        <div className="watcher-section-label">
          <span>Top 10 Gainers</span>
        </div>
        <MoverList movers={topGainers} metric="change" emptyText="Loading gainers…" />
      </div>

      <div className="watcher-section">
        <div className="watcher-section-label">
          <span>Top 10 Losers</span>
        </div>
        <MoverList movers={topLosers} metric="change" emptyText="Loading losers…" />
      </div>
    </>
  );
}
