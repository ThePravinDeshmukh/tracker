import React, { useEffect, useRef, useState } from 'react';
import { getCoinIcon, getCoinColor } from '../hooks/useCryptoPrices';
import { Holding, Recommendation } from '../types';

interface Props {
  holding: Holding;
  livePrice: number | undefined;
  prevPrice: number | undefined;
  recommendation: Recommendation | undefined;
  onEdit: (holding: Holding) => void;
  onDelete: (symbol: string) => void;
  onViewChart: (symbol: string) => void;
}

function fmt(n: number | null | undefined, decimals = 2): string {
  if (n === undefined || n === null || isNaN(n)) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtPrice(n: number | undefined): string {
  if (!n) return '—';
  if (n >= 1000) return fmt(n, 2);
  if (n >= 1) return fmt(n, 4);
  return fmt(n, 6);
}

export default function HoldingRow({ holding, livePrice, prevPrice, recommendation, onEdit, onDelete, onViewChart }: Props) {
  const { symbol, avgPrice, qty } = holding;
  const [flash, setFlash] = useState('');
  const prevRef = useRef<number | undefined>(prevPrice);

  useEffect(() => {
    if (!livePrice || !prevRef.current) { prevRef.current = livePrice; return; }
    if (livePrice !== prevRef.current) {
      setFlash(livePrice > prevRef.current ? 'up' : 'down');
      const t = setTimeout(() => setFlash(''), 600);
      prevRef.current = livePrice;
      return () => clearTimeout(t);
    }
  }, [livePrice]);

  const invested = avgPrice * qty;
  const currentValue = livePrice ? livePrice * qty : null;
  const pnl = currentValue !== null ? currentValue - invested : null;
  const pnlPct = pnl !== null && invested > 0 ? (pnl / invested) * 100 : null;
  const color = getCoinColor(symbol);

  return (
    <div className="holding-row fade-in">
      <div className="coin-info" onClick={() => onViewChart(symbol)} title="View chart" style={{ cursor: 'pointer' }}>
        <div className="coin-icon" style={{ background: `${color}22`, color }}>
          {getCoinIcon(symbol)}
        </div>
        <div>
          <div className="coin-symbol">{symbol}</div>
          <div className="coin-qty">{fmt(qty, qty < 1 ? 6 : 4)} units</div>
        </div>
      </div>

      <div className="col">
        <div className="label">Avg Price</div>
        <div className="value mono">${fmtPrice(avgPrice)}</div>
      </div>

      <div className="col">
        <div className="label">Live Price</div>
        <div className={`value mono live-price ${flash}`}>
          {livePrice ? `$${fmtPrice(livePrice)}` : <span className="loading-dot">•••</span>}
        </div>
      </div>

      <div className="col">
        <div className="label">Value</div>
        <div className="value mono">{currentValue !== null ? `$${fmt(currentValue)}` : '—'}</div>
      </div>

      <div className="col">
        <div className="label">P&L</div>
        <div className={`value mono pnl ${pnl === null ? '' : pnl >= 0 ? 'pos' : 'neg'}`}>
          {pnl !== null ? (
            <>
              <span>{pnl >= 0 ? '+' : ''}${fmt(Math.abs(pnl))}</span>
              <span className="pct"> ({(pnlPct ?? 0) >= 0 ? '+' : ''}{fmt(pnlPct)}%)</span>
            </>
          ) : '—'}
        </div>
      </div>

      <div className="col">
        <div className="label">Signal</div>
        {recommendation ? (
          <span className={`rec-badge rec-${recommendation.toLowerCase()}`}>{recommendation}</span>
        ) : (
          <span className="loading-dot">•••</span>
        )}
      </div>

      <div className="row-actions">
        <button className="btn-icon edit" onClick={() => onEdit(holding)} title="Edit">✎</button>
        <button className="btn-icon del" onClick={() => onDelete(symbol)} title="Remove">✕</button>
      </div>
    </div>
  );
}
