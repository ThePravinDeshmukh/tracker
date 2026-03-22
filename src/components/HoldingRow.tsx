import React, { useEffect, useRef, useState } from 'react';
import { getCoinIcon, getCoinColor } from '../hooks/useCryptoPrices';
import { Holding, RecommendationDetail } from '../types';

interface Props {
  holding: Holding;
  livePrice: number | undefined;
  prevPrice: number | undefined;
  volume: number | undefined;
  recommendation: RecommendationDetail | undefined;
  onEdit: (holding: Holding) => void;
  onDelete: (symbol: string) => void;
  onViewChart: (symbol: string) => void;
  onVolumeClick: (symbol: string) => void;
  onCloseTrade: (holding: Holding) => void;
}

function fmtVolume(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
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

export default function HoldingRow({ holding, livePrice, prevPrice, volume, recommendation, onEdit, onDelete, onViewChart, onVolumeClick, onCloseTrade }: Props) {
  const { symbol, avgPrice, qty } = holding;
  const [flash, setFlash] = useState('');
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const prevRef = useRef<number | undefined>(prevPrice);
  const badgeRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!livePrice || !prevRef.current) { prevRef.current = livePrice; return; }
    if (livePrice !== prevRef.current) {
      setFlash(livePrice > prevRef.current ? 'up' : 'down');
      const t = setTimeout(() => setFlash(''), 600);
      prevRef.current = livePrice;
      return () => clearTimeout(t);
    }
  }, [livePrice]);

  useEffect(() => {
    if (!showTooltip) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        tooltipRef.current && !tooltipRef.current.contains(e.target as Node) &&
        badgeRef.current && !badgeRef.current.contains(e.target as Node)
      ) {
        setShowTooltip(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showTooltip]);

  const handleBadgeClick = () => {
    if (showTooltip) { setShowTooltip(false); return; }
    const rect = badgeRef.current?.getBoundingClientRect();
    if (!rect) return;
    const tooltipWidth = 280;
    const left = Math.min(rect.left, window.innerWidth - tooltipWidth - 12);
    setTooltipStyle({ position: 'fixed', top: rect.bottom + 8, left, width: tooltipWidth, zIndex: 500 });
    setShowTooltip(true);
  };

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
        <div className="label">24h Volume</div>
        <div
          className="value mono vol-value"
          onClick={() => onVolumeClick(symbol)}
          title="View volume chart"
        >
          {volume !== undefined ? fmtVolume(volume) : <span className="loading-dot">•••</span>}
        </div>
      </div>

      <div className="col">
        <div className="label">Signal</div>
        {recommendation ? (
          <span
            ref={badgeRef}
            className={`rec-badge rec-${recommendation.signal.toLowerCase()} rec-badge-clickable`}
            onClick={handleBadgeClick}
            title="Tap for signal breakdown"
          >
            {recommendation.signal}
          </span>
        ) : (
          <span className="loading-dot">•••</span>
        )}
      </div>

      <div className="row-actions">
        <button className="btn-icon edit" onClick={() => onEdit(holding)} title="Edit">✎</button>
        <button className="btn-icon close-trade" onClick={() => onCloseTrade(holding)} title="Close trade">⊗</button>
        <button className="btn-icon del" onClick={() => onDelete(symbol)} title="Remove">✕</button>
      </div>

      {showTooltip && recommendation && (
        <div ref={tooltipRef} className="signal-tooltip" style={tooltipStyle}>
          <div className="signal-tooltip-header">Signal Breakdown — {symbol}</div>
          {recommendation.details.map(detail => (
            <div key={detail.indicator} className="signal-tooltip-row">
              <div className="signal-tooltip-indicator">
                <span className="signal-tooltip-name">{detail.indicator}</span>
                <span className={`rec-badge rec-${detail.signal.toLowerCase()} signal-tooltip-badge`}>
                  {detail.signal}
                </span>
              </div>
              <div className="signal-tooltip-reason">{detail.reason}</div>
            </div>
          ))}
          <div className="signal-tooltip-footer">
            60 × 1h candles · refreshed every 5 min · not financial advice
          </div>
        </div>
      )}
    </div>
  );
}
