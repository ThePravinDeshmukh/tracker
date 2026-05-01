import React from 'react';
import { MomentumRow } from '../types';

interface Props {
  symbol: string;
  price: number | undefined;
  change24h: number | undefined;
  volume24h: number | undefined;
  high24h: number | undefined;
  low24h: number | undefined;
  trades24h: number | undefined;
  momentumRow: MomentumRow | undefined;
}

function fmtPct(value: number | null | undefined): { text: string; cls: string } {
  if (value === null || value === undefined || isNaN(value)) return { text: '—', cls: '' };
  const sign = value >= 0 ? '+' : '';
  return {
    text: `${sign}${value.toFixed(2)}%`,
    cls: value > 0 ? 'pos' : value < 0 ? 'neg' : '',
  };
}

function fmtVolume(vol: number | null | undefined): string {
  if (vol === null || vol === undefined || isNaN(vol) || vol <= 0) return '—';
  if (vol >= 1_000_000_000) return `$${(vol / 1_000_000_000).toFixed(2)}B`;
  if (vol >= 1_000_000)     return `$${(vol / 1_000_000).toFixed(2)}M`;
  if (vol >= 1_000)         return `$${(vol / 1_000).toFixed(1)}K`;
  return `$${vol.toFixed(0)}`;
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

export default function CryptoDetailPanel({ symbol, price, change24h, volume24h, high24h, low24h, trades24h, momentumRow }: Props) {
  const priceChanges = [
    { label: '1m', ...fmtPct(momentumRow?.ret1m) },
    { label: '5m', ...fmtPct(momentumRow?.ret5m) },
    { label: '1h', ...fmtPct(momentumRow?.ret1h) },
    { label: '24h', ...fmtPct(change24h) },
  ];

  const volumes = [
    { label: '1m', text: fmtVolume(momentumRow?.volAdded1m) },
    { label: '5m', text: fmtVolume(momentumRow?.volAdded5m) },
    { label: '1h', text: fmtVolume(momentumRow?.volAdded1h) },
    { label: '24h', text: fmtVolume(volume24h) },
  ];

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

      {/* Price Change % */}
      <div className="detail-section">
        <div className="detail-section-label">Price Change</div>
        <div className="detail-grid-4">
          {priceChanges.map(({ label, text, cls }) => (
            <div key={label} className="detail-cell">
              <span className="detail-cell-label">{label}</span>
              <span className={`detail-cell-value mono ${cls}`}>{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Volume */}
      <div className="detail-section">
        <div className="detail-section-label">Volume Added</div>
        <div className="detail-grid-4">
          {volumes.map(({ label, text }) => (
            <div key={label} className="detail-cell">
              <span className="detail-cell-label">{label}</span>
              <span className="detail-cell-value mono muted">{text}</span>
            </div>
          ))}
        </div>
      </div>

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
