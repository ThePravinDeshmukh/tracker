import React from 'react';
import { MarketMover } from '../types';
import { baseAssetOf } from '../utils/watchlist';

interface Props {
  topGainers: MarketMover[];
  topLosers: MarketMover[];
}

function fmtPrice(price: number): string {
  if (price >= 1000) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 1) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  return price.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 });
}

function MoverRow({ mover }: { mover: MarketMover }) {
  const isUp = mover.priceChangePct >= 0;
  return (
    <div className="mover-row">
      <span className="mover-symbol mono">{baseAssetOf(mover.symbol)}</span>
      <span className="mover-price mono muted">${fmtPrice(mover.price)}</span>
      <span className={`mover-change mono ${isUp ? 'pos' : 'neg'}`}>
        {isUp ? '+' : ''}{mover.priceChangePct.toFixed(2)}%
      </span>
    </div>
  );
}

function MoverList({ movers, emptyText }: { movers: MarketMover[]; emptyText: string }) {
  if (movers.length === 0) {
    return <div className="watcher-empty">{emptyText}</div>;
  }
  return (
    <div className="mover-list">
      {movers.map(mover => (
        <MoverRow key={mover.symbol} mover={mover} />
      ))}
    </div>
  );
}

export default function MarketMoversPanel({ topGainers, topLosers }: Props) {
  return (
    <>
      <div className="watcher-section">
        <div className="watcher-section-label">
          <span>Top 10 Gainers</span>
        </div>
        <MoverList movers={topGainers} emptyText="Loading gainers…" />
      </div>

      <div className="watcher-section">
        <div className="watcher-section-label">
          <span>Top 10 Losers</span>
        </div>
        <MoverList movers={topLosers} emptyText="Loading losers…" />
      </div>
    </>
  );
}
