import React from 'react';
import { MomentumRow } from '../types';

interface Props {
  price: number | undefined;
  high24h: number | undefined;
  low24h: number | undefined;
  trades24h: number | undefined;
  momentumRow: MomentumRow | undefined;
}

function fmtPrice(price: number): string {
  if (price >= 1000) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 1)    return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  return price.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 });
}

function rangeHint(pct: number): string {
  if (pct <= 33) return 'near low';
  if (pct >= 67) return 'near high';
  return 'mid-range';
}

export default function CryptoDetailPanel({ price, high24h, low24h, trades24h, momentumRow }: Props) {
  const hasRange = high24h !== undefined && low24h !== undefined && price !== undefined
    && !isNaN(high24h) && !isNaN(low24h) && high24h > low24h;

  const rangePct = hasRange
    ? Math.round(((price! - low24h!) / (high24h! - low24h!)) * 100)
    : null;

  const regime = momentumRow?.regime;
  const regimeCls = regime === 'high_vol' ? 'high-vol' : regime === 'normal' ? 'calm' : 'loading';
  const regimeLabel = regime === 'high_vol' ? 'HIGH VOL' : regime === 'normal' ? 'CALM' : '…';

  return (
    <div className="crypto-detail-panel">

      {/* 24h Range */}
      {hasRange && rangePct !== null && (
        <div className="detail-section">
          <div className="detail-section-label">24h Range</div>
          <div className="range-bar-wrap">
            <div className="range-bar-ends">
              <span className="mono muted">${fmtPrice(low24h!)}</span>
              <span className="mono muted">${fmtPrice(high24h!)}</span>
            </div>
            <div className="range-bar-track">
              <div className="range-bar-marker" style={{ left: `${rangePct}%` }} />
            </div>
            <div className="range-bar-label">
              <span className="mono">{rangePct}% of range</span>
              <span className="muted range-hint">({rangeHint(rangePct)})</span>
            </div>
          </div>
        </div>
      )}

      {/* Market Stats */}
      <div className="detail-section detail-section-stats">
        <div className="detail-stat">
          <span className="detail-section-label">Trades 24h</span>
          <span className="detail-cell-value mono">
            {trades24h !== undefined ? trades24h.toLocaleString() : '—'}
          </span>
        </div>
        <div className="detail-stat">
          <span className="detail-section-label">Volatility</span>
          <span className={`regime-badge ${regimeCls}`}>{regimeLabel}</span>
        </div>
      </div>

    </div>
  );
}
