import React from 'react';
import { MomentumRow, Regime } from '../types';
import { getCoinIcon, getCoinColor } from '../hooks/useCryptoPrices';

interface Props {
  rows: MomentumRow[];
}

function fmtPrice(price: number): string {
  if (price >= 1000) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 1) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  return price.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 });
}

function fmtPct(value: number | null): string {
  if (value === null) return '—';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

function fmtVol(value: number | null): string {
  if (value === null) return '—';
  return `${value.toFixed(3)}%`;
}

function RegimeBadge({ regime }: { regime: Regime }) {
  return (
    <span className={`regime-badge regime-badge--${regime}`}>
      {regime === 'high_vol' ? 'HIGH VOL' : regime === 'normal' ? 'NORMAL' : '…'}
    </span>
  );
}

export default function PulseTable({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <div className="pulse-table-empty">
        Waiting for price data…
      </div>
    );
  }

  return (
    <div className="pulse-table-wrap">
      <div className="pulse-table-header">
        <span>Asset</span>
        <span>Last Price</span>
        <span>1-min %</span>
        <span>5-min %</span>
        <span>15-min Vol</span>
        <span>Regime</span>
      </div>
      {rows.map(row => {
        const color = getCoinColor(row.symbol);
        const icon = getCoinIcon(row.symbol);
        return (
          <div key={row.symbol} className="pulse-table-row">
            <span className="pulse-asset">
              <span className="pulse-coin-icon" style={{ background: color }}>{icon}</span>
              <span className="pulse-symbol">{row.symbol}</span>
            </span>
            <span className="pulse-price mono">${fmtPrice(row.lastPrice)}</span>
            <span className={`pulse-ret mono ${row.ret1m !== null ? (row.ret1m >= 0 ? 'pos' : 'neg') : 'muted'}`}>
              {fmtPct(row.ret1m)}
            </span>
            <span className={`pulse-ret mono ${row.ret5m !== null ? (row.ret5m >= 0 ? 'pos' : 'neg') : 'muted'}`}>
              {fmtPct(row.ret5m)}
            </span>
            <span className="pulse-vol mono muted">{fmtVol(row.vol15m)}</span>
            <span>
              <RegimeBadge regime={row.regime} />
            </span>
          </div>
        );
      })}
    </div>
  );
}
