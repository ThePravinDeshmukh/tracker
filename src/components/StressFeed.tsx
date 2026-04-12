import React from 'react';
import { StressEvent } from '../types';
import { getCoinIcon, getCoinColor } from '../hooks/useCryptoPrices';

interface Props {
  events: StressEvent[];
}

function timeAgo(triggeredAt: number): string {
  const diffMs = Date.now() - triggeredAt;
  const diffSec = Math.floor(diffMs / 1_000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  return `${Math.floor(diffMin / 60)}h ago`;
}

function fmtPrice(price: number): string {
  if (price >= 1000) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 1) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  return price.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 });
}

export default function StressFeed({ events }: Props) {
  if (events.length === 0) {
    return (
      <div className="stress-feed-empty">
        <span className="stress-feed-empty-icon">◎</span>
        <span>No stress events yet</span>
        <span className="stress-feed-empty-sub">Fires when any coin moves ≥1.5% in 1 min</span>
      </div>
    );
  }

  return (
    <div className="stress-feed-list">
      {events.map((evt, i) => {
        const color = getCoinColor(evt.symbol);
        const icon = getCoinIcon(evt.symbol);
        const isUp = evt.ret1m >= 0;
        return (
          <div key={`${evt.symbol}-${evt.triggeredAt}-${i}`} className="stress-event-card">
            <span className="stress-coin-icon" style={{ background: color }}>{icon}</span>
            <div className="stress-event-body">
              <div className="stress-event-top">
                <span className="stress-symbol">{evt.symbol}</span>
                <span className={`stress-ret mono ${isUp ? 'pos' : 'neg'}`}>
                  {isUp ? '+' : ''}{evt.ret1m.toFixed(2)}%
                </span>
              </div>
              <div className="stress-event-bottom">
                <span className="stress-price mono muted">${fmtPrice(evt.price)}</span>
                <span className="stress-time muted">{timeAgo(evt.triggeredAt)}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
