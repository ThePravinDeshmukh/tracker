import React from 'react';
import { MomentumRow, Regime } from '../types';
import { getCoinIcon, getCoinColor } from '../hooks/useCryptoPrices';

interface Props {
  rows: MomentumRow[];
}

function fmtPrice(price: number): string {
  if (price >= 1000) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 1)    return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  return price.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 });
}

function fmtPct(value: number | null): string {
  if (value === null) return '—';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

function fmtVol(value: number | null): string {
  if (value === null) return '—';
  return `σ ${value.toFixed(3)}%`;
}

function RegimeBadge({ regime }: { regime: Regime }) {
  return (
    <span className={`regime-badge regime-badge--${regime}`}>
      {regime === 'high_vol' ? 'HI VOL' : regime === 'normal' ? 'NORMAL' : '…'}
    </span>
  );
}

export default function PulseTable({ rows }: Props) {
  // Sort alphabetically by symbol name
  const sorted = [...rows].sort((a, b) => a.symbol.localeCompare(b.symbol));

  if (sorted.length === 0) {
    return <div className="pulse-empty muted">Waiting for price data…</div>;
  }

  return (
    <div className="pulse-table-list">
      {sorted.map(row => {
        const color = getCoinColor(row.symbol);
        const icon  = getCoinIcon(row.symbol);
        return (
          <div key={row.symbol} className="pulse-card">
            {/* Top line: icon + symbol | 1m% | regime */}
            <div className="pulse-card-top">
              <div className="pulse-asset">
                <span className="pulse-coin-icon" style={{ background: color }}>{icon}</span>
                <span className="pulse-symbol">{row.symbol}</span>
              </div>
              <div className="pulse-card-top-right">
                <span className={`pulse-ret mono ${row.ret1m !== null ? (row.ret1m >= 0 ? 'pos' : 'neg') : 'muted'}`}>
                  {fmtPct(row.ret1m)}
                </span>
                <RegimeBadge regime={row.regime} />
              </div>
            </div>
            {/* Bottom line: last price | 5m% | vol */}
            <div className="pulse-card-bottom">
              <span className="pulse-price mono muted">${fmtPrice(row.lastPrice)}</span>
              <div className="pulse-card-bottom-right">
                <span className={`pulse-ret-sm mono ${row.ret5m !== null ? (row.ret5m >= 0 ? 'pos' : 'neg') : 'muted'}`}>
                  5m {fmtPct(row.ret5m)}
                </span>
                <span className="pulse-vol-sm mono muted">{fmtVol(row.vol15m)}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
