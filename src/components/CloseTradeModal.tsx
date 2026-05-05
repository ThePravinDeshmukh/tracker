import React, { useState } from 'react';
import { Holding } from '../types';
import { getCoinIcon, getCoinColor } from '../hooks/useCryptoPrices';

interface Props {
  holding: Holding;
  livePrice: number | undefined;
  onConfirm: (symbol: string) => void;
  onClose: () => void;
}

function fmt(n: number, decimals = 2): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtPrice(n: number): string {
  if (n >= 1000) return fmt(n, 2);
  if (n >= 1) return fmt(n, 4);
  if (n >= 0.01) return fmt(n, 6);
  return fmt(n, 8);
}

function calcSliderRange(avgPrice: number): { min: number; max: number; step: number } {
  const min = avgPrice * 0.8;
  const max = avgPrice * 1.2;
  const step = (max - min) / 1000;
  return { min, max, step };
}

export default function CloseTradeModal({ holding, livePrice, onConfirm, onClose }: Props) {
  const { symbol, avgPrice, qty } = holding;
  const defaultClose = livePrice ?? avgPrice;

  // Use a string state so the user can type freely (e.g. "0.000")
  const [closePriceStr, setClosePriceStr] = useState(String(defaultClose));
  const closePrice = parseFloat(closePriceStr) || defaultClose;

  const { min: sliderMin, max: sliderMax, step: sliderStep } = calcSliderRange(avgPrice);

  const isShort = holding.type === 'short';
  const invested = avgPrice * qty;
  const closeValue = closePrice * qty;
  const pnl = isShort ? (invested - closeValue) : (closeValue - invested);
  const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;
  const isProfit = pnl >= 0;

  const color = getCoinColor(symbol);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setClosePriceStr(e.target.value);
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const val = parseFloat(e.target.value);
    setClosePriceStr(String(val));
  };

  const handleConfirm = (): void => {
    onConfirm(symbol);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal fade-in">

        <div className="modal-header">
          <div className="close-trade-title">
            <div
              className="coin-icon"
              style={{ background: `${color}22`, color, width: 34, height: 34, borderRadius: 9, flexShrink: 0 }}
            >
              {getCoinIcon(symbol)}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 16 }}>Close Position: {symbol}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2, fontFamily: 'var(--mono)' }}>
                {fmt(qty, isShort ? 0 : qty < 1 ? 6 : 4)} units
              </div>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        {/* Position summary */}
        <div className="close-trade-stats close-trade-stats-2col">
          <div className="close-trade-stat">
            <div className="label">Notional @ {isShort ? 'Avg Short' : 'Avg Buy'}</div>
            <div className="value mono">${fmt(invested)}</div>
            <div className="sublabel mono">${fmtPrice(avgPrice)} × {fmt(qty, isShort ? 0 : qty < 1 ? 6 : 4)}</div>
          </div>
          <div className="close-trade-stat">
            <div className="label">Notional @ Mark</div>
            <div className="value mono">{livePrice ? `$${fmt(livePrice * qty)}` : '—'}</div>
            <div className="sublabel mono">{livePrice ? `$${fmtPrice(livePrice)} × ${fmt(qty, isShort ? 0 : qty < 1 ? 6 : 4)}` : '—'}</div>
          </div>
        </div>

        {/* Closing price input */}
        <div className="field">
          <label>Closing Price (USD)</label>
          <input
            type="number"
            step="any"
            min="0"
            value={closePriceStr}
            onChange={handleInputChange}
            autoFocus
          />
        </div>

        {/* Slider */}
        <div className="field">
          <label>Slide to Adjust</label>
          <input
            type="range"
            min={sliderMin}
            max={sliderMax}
            step={sliderStep}
            value={Math.min(Math.max(closePrice, sliderMin), sliderMax)}
            onChange={handleSliderChange}
            className="close-trade-slider"
          />
          <div className="slider-range-labels">
            <span>${fmtPrice(sliderMin)}</span>
            <span>${fmtPrice(sliderMax)}</span>
          </div>
        </div>

        {/* P&L result */}
        <div className={`close-trade-pnl ${isProfit ? 'pos' : 'neg'}`}>
          <div className="close-trade-pnl-row">
            <span>Close Value</span>
            <span className="mono">${fmt(closeValue)}</span>
          </div>
          <div className="close-trade-pnl-row close-trade-pnl-main">
            <span>Estimated P&amp;L</span>
            <span className={`mono ${isProfit ? 'pos' : 'neg'}`}>
              {isProfit ? '+' : '−'}${fmt(Math.abs(pnl))}
              <span className="pct"> ({isProfit ? '+' : ''}{fmt(pnlPct)}%)</span>
            </span>
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn secondary" onClick={onClose}>Cancel</button>
          <button className="btn danger" onClick={handleConfirm}>Close Position</button>
        </div>

      </div>
    </div>
  );
}
