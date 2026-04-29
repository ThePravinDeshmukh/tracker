import React, { useState, useEffect } from 'react';
import { Holding } from '../types';
import { getCoinIcon, getCoinColor } from '../hooks/useCryptoPrices';

interface Props {
  holding: Holding;
  livePrice: number | undefined;
  onConfirm: (sellQty: number) => void;
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

export default function SellModal({ holding, livePrice, onConfirm, onClose }: Props) {
  const { symbol, avgPrice, qty } = holding;
  const color = getCoinColor(symbol);

  const [sellPriceStr, setSellPriceStr] = useState(String(livePrice ?? avgPrice));
  const [sellQtyStr, setSellQtyStr] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const sellPrice = parseFloat(sellPriceStr) || 0;
  const sellQty = parseFloat(sellQtyStr) || 0;
  const isSellAll = sellQty >= qty;

  const isValid = sellPrice > 0 && sellQty > 0 && sellQty <= qty;

  const proceeds = isValid ? sellPrice * sellQty : null;
  const costBasis = isValid ? avgPrice * sellQty : null;
  const realizedPnl = proceeds !== null && costBasis !== null ? proceeds - costBasis : null;
  const realizedPnlPct = realizedPnl !== null && costBasis && costBasis > 0
    ? (realizedPnl / costBasis) * 100
    : null;
  const remainingQty = isValid ? qty - sellQty : null;

  const handleSellAll = (): void => {
    setSellQtyStr(String(qty));
    setError('');
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    if (sellPrice <= 0) return setError('Enter a valid sell price');
    if (sellQty <= 0) return setError('Enter a valid quantity');
    if (sellQty > qty) return setError(`Cannot sell more than ${fmt(qty, qty < 1 ? 6 : 4)} units`);
    onConfirm(sellQty);
    onClose();
  };

  const qtyDecimals = qty < 1 ? 6 : 4;

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
              <div style={{ fontWeight: 600, fontSize: 16 }}>Sell {symbol}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2, fontFamily: 'var(--mono)' }}>
                {fmt(qty, qtyDecimals)} units available
              </div>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        <div className="close-trade-stats">
          <div className="close-trade-stat">
            <div className="label">Avg Buy Price</div>
            <div className="value mono">${fmtPrice(avgPrice)}</div>
          </div>
          <div className="close-trade-stat">
            <div className="label">Live Price</div>
            <div className="value mono">{livePrice ? `$${fmtPrice(livePrice)}` : '—'}</div>
          </div>
          <div className="close-trade-stat">
            <div className="label">Holdings</div>
            <div className="value mono">{fmt(qty, qtyDecimals)}</div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Sell Price (USD)</label>
            <input
              type="number"
              step="any"
              min="0"
              value={sellPriceStr}
              onChange={e => { setSellPriceStr(e.target.value); setError(''); }}
              autoFocus
            />
          </div>

          <div className="field">
            <label>
              Qty to Sell
              <button
                type="button"
                className="sell-all-link"
                onClick={handleSellAll}
              >
                Sell all
              </button>
            </label>
            <input
              type="number"
              step="any"
              min="0"
              max={qty}
              placeholder={`max ${fmt(qty, qtyDecimals)}`}
              value={sellQtyStr}
              onChange={e => { setSellQtyStr(e.target.value); setError(''); }}
            />
          </div>

          {isValid && realizedPnl !== null && realizedPnlPct !== null && proceeds !== null && (
            <div className={`close-trade-pnl ${realizedPnl >= 0 ? 'pos' : 'neg'}`}>
              <div className="close-trade-pnl-row">
                <span>Proceeds</span>
                <span className="mono">${fmt(proceeds)}</span>
              </div>
              {!isSellAll && remainingQty !== null && (
                <div className="close-trade-pnl-row">
                  <span>Remaining qty</span>
                  <span className="mono">{fmt(remainingQty, remainingQty < 1 ? 6 : 4)}</span>
                </div>
              )}
              <div className="close-trade-pnl-row close-trade-pnl-main">
                <span>Realized P&amp;L</span>
                <span className={`mono ${realizedPnl >= 0 ? 'pos' : 'neg'}`}>
                  {realizedPnl >= 0 ? '+' : '−'}${fmt(Math.abs(realizedPnl))}
                  <span className="pct"> ({realizedPnlPct >= 0 ? '+' : ''}{fmt(realizedPnlPct)}%)</span>
                </span>
              </div>
            </div>
          )}

          {error && <div className="error">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn sell-confirm">
              {isSellAll && sellQty > 0 ? 'Sell All' : 'Confirm Sell'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
