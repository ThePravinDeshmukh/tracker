import React, { useEffect, useRef, useState } from 'react';
import { getCoinIcon, getCoinColor } from '../hooks/useCryptoPrices';
import { Holding } from '../types';

interface Props {
  holding: Holding;
  livePrice: number | undefined;
  prevPrice: number | undefined;
  onEdit: (holding: Holding) => void;
  onDelete: (symbol: string) => void;
  onViewChart: (symbol: string) => void;
  onCloseTrade: (holding: Holding) => void;
  onAddTo: (holding: Holding) => void;
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

export default function HoldingRow({ holding, livePrice, prevPrice, onEdit, onDelete, onViewChart, onCloseTrade, onAddTo }: Props) {
  const { symbol, avgPrice, qty } = holding;
  const isShort = holding.type === 'short';
  const [flash, setFlash] = useState('');
  const [expanded, setExpanded] = useState(false);
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
  const pnl = currentValue !== null
    ? (isShort ? invested - currentValue : currentValue - invested)
    : null;
  const pnlPct = pnl !== null && invested > 0 ? (pnl / invested) * 100 : null;
  const color = getCoinColor(symbol);

  return (
    <div className={`holding-card fade-in${isShort ? ' short-card' : ''}`}>
      <div className="holding-card-header">
        <div className="coin-info" onClick={() => onViewChart(symbol)} title="View chart" style={{ cursor: 'pointer' }}>
          <div className="coin-icon" style={{ background: `${color}22`, color }}>
            {getCoinIcon(symbol)}
          </div>
          <div>
            <div className="coin-symbol">
              {symbol}
              {isShort && <span className="short-badge">SHORT</span>}
            </div>
          </div>
        </div>
        <div className={`holding-card-pnl-pct ${pnlPct === null ? '' : pnlPct >= 0 ? 'pos' : 'neg'}`}>
          {pnlPct !== null ? `${pnlPct >= 0 ? '+' : ''}${fmt(pnlPct)}%` : '—'}
        </div>
      </div>

      <div className="holding-card-stats">
        <div className="holding-card-stat">
          <div className="holding-card-stat-label">Quantity</div>
          <div className="holding-card-stat-value mono">{fmt(qty, qty < 1 ? 6 : 4)}</div>
        </div>
        <div className="holding-card-stat">
          <div className="holding-card-stat-label">Mark Price</div>
          <div className={`holding-card-stat-value mono live-price ${flash}`}>
            {livePrice ? fmtPrice(livePrice) : <span className="loading-dot">•••</span>}
          </div>
        </div>
        <div className="holding-card-stat">
          <div className="holding-card-stat-label">UPL@Mark</div>
          <div className={`holding-card-stat-value mono ${pnl === null ? '' : pnl >= 0 ? 'pos' : 'neg'}`}>
            {pnl !== null ? `${pnl >= 0 ? '+' : ''}${fmt(pnl)} USD` : '—'}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="holding-card-details holding-card-details-3col">
          <div className="holding-card-stat">
            <div className="holding-card-stat-label">{isShort ? 'Avg Sell' : 'Avg Buy'}</div>
            <div className="holding-card-stat-value mono">${fmtPrice(avgPrice)}</div>
          </div>
          <div className="holding-card-stat">
            <div className="holding-card-stat-label">Notional</div>
            <div className="holding-card-stat-value mono">${fmt(invested)}</div>
          </div>
          <div className="holding-card-stat">
            <div className="holding-card-stat-label">Notional @ Mark</div>
            <div className="holding-card-stat-value mono">
              {currentValue !== null ? `$${fmt(currentValue)}` : '—'}
            </div>
          </div>
        </div>
      )}

      <div className="holding-card-actions">
        <button className="hca-btn hca-add" onClick={() => onAddTo(holding)}>Add</button>
        <button className="hca-btn hca-close" onClick={() => onCloseTrade(holding)}>Close</button>
        <button className="hca-btn hca-edit" onClick={() => onEdit(holding)}>Edit</button>
        <button
          className="hca-btn hca-toggle"
          onClick={() => setExpanded(prev => !prev)}
          title={expanded ? 'Collapse details' : 'Expand details'}
        >
          {expanded ? '▲' : '▼'}
        </button>
      </div>
    </div>
  );
}
