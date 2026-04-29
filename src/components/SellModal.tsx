import React, { useState, useEffect } from 'react';
import { Holding, PriceMap } from '../types';
import { getCoinIcon, getCoinColor } from '../hooks/useCryptoPrices';

interface Props {
  holding: Holding | null;
  holdings: Holding[];
  prices: PriceMap;
  onConfirm: (symbol: string, sellQty: number) => void;
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

export default function SellModal({ holding: initialHolding, holdings, prices, onConfirm, onClose }: Props) {
  const [selectedHolding, setSelectedHolding] = useState<Holding | null>(initialHolding);
  const [sellPriceStr, setSellPriceStr] = useState('');
  const [sellQtyStr, setSellQtyStr] = useState('');
  const [error, setError] = useState('');

  const livePrice = selectedHolding ? prices[selectedHolding.symbol] : undefined;

  useEffect(() => {
    if (selectedHolding) {
      setSellPriceStr(String(livePrice ?? selectedHolding.avgPrice));
      setSellQtyStr('');
      setError('');
    }
  }, [selectedHolding, livePrice]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleSelectHolding = (h: Holding): void => {
    setSelectedHolding(h);
    setError('');
  };

  const sellPrice = parseFloat(sellPriceStr) || 0;
  const sellQty = parseFloat(sellQtyStr) || 0;

  const isValid = selectedHolding !== null && sellPrice > 0 && sellQty > 0 && sellQty <= selectedHolding.qty;
  const isSellAll = selectedHolding !== null && sellQty >= selectedHolding.qty;

  const proceeds = isValid ? sellPrice * sellQty : null;
  const costBasis = isValid && selectedHolding ? selectedHolding.avgPrice * sellQty : null;
  const realizedPnl = proceeds !== null && costBasis !== null ? proceeds - costBasis : null;
  const realizedPnlPct = realizedPnl !== null && costBasis && costBasis > 0
    ? (realizedPnl / costBasis) * 100
    : null;
  const remainingQty = isValid && selectedHolding ? selectedHolding.qty - sellQty : null;

  const handleSellAll = (): void => {
    if (!selectedHolding) return;
    setSellQtyStr(String(selectedHolding.qty));
    setError('');
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    if (!selectedHolding) return setError('Select a holding to sell');
    if (sellPrice <= 0) return setError('Enter a valid sell price');
    if (sellQty <= 0) return setError('Enter a valid quantity');
    if (sellQty > selectedHolding.qty) return setError(`Cannot sell more than ${fmt(selectedHolding.qty, selectedHolding.qty < 1 ? 6 : 4)} units`);
    onConfirm(selectedHolding.symbol, sellQty);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal fade-in">

        <div className="modal-header">
          <h2>Sell Crypto</h2>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        {/* Holding picker — shown when no holding was pre-selected */}
        {!initialHolding && (
          <div className="field">
            <label>Select holding to sell</label>
            <div className="sell-holding-list">
              {holdings.length === 0 && (
                <div className="sell-holding-empty">No holdings to sell</div>
              )}
              {holdings.map(h => {
                const color = getCoinColor(h.symbol);
                const price = prices[h.symbol];
                const isSelected = selectedHolding?.symbol === h.symbol;
                return (
                  <button
                    key={h.symbol}
                    type="button"
                    className={`sell-holding-item${isSelected ? ' selected' : ''}`}
                    onClick={() => handleSelectHolding(h)}
                  >
                    <div className="coin-icon" style={{ background: `${color}22`, color, width: 30, height: 30, borderRadius: 8, flexShrink: 0, fontSize: 14 }}>
                      {getCoinIcon(h.symbol)}
                    </div>
                    <div className="sell-holding-item-info">
                      <span className="sell-holding-symbol">{h.symbol}</span>
                      <span className="sell-holding-qty">{fmt(h.qty, h.qty < 1 ? 6 : 4)} units</span>
                    </div>
                    <div className="sell-holding-item-price mono">
                      {price ? `$${fmtPrice(price)}` : '—'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Sell form — shown once a holding is selected */}
        {selectedHolding && (
          <>
            {initialHolding && (
              <div className="close-trade-stats">
                <div className="close-trade-stat">
                  <div className="label">Avg Buy Price</div>
                  <div className="value mono">${fmtPrice(selectedHolding.avgPrice)}</div>
                </div>
                <div className="close-trade-stat">
                  <div className="label">Live Price</div>
                  <div className="value mono">{livePrice ? `$${fmtPrice(livePrice)}` : '—'}</div>
                </div>
                <div className="close-trade-stat">
                  <div className="label">Holdings</div>
                  <div className="value mono">{fmt(selectedHolding.qty, selectedHolding.qty < 1 ? 6 : 4)}</div>
                </div>
              </div>
            )}

            {!initialHolding && (
              <div className="sell-selected-summary">
                <span>Selling: <strong>{selectedHolding.symbol}</strong></span>
                <span className="mono muted">{fmt(selectedHolding.qty, selectedHolding.qty < 1 ? 6 : 4)} units · avg ${fmtPrice(selectedHolding.avgPrice)}</span>
              </div>
            )}

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
                  <button type="button" className="sell-all-link" onClick={handleSellAll}>
                    Sell all
                  </button>
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  max={selectedHolding.qty}
                  placeholder={`max ${fmt(selectedHolding.qty, selectedHolding.qty < 1 ? 6 : 4)}`}
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
          </>
        )}

        {/* No holding selected yet and opened from toolbar */}
        {!initialHolding && !selectedHolding && holdings.length > 0 && (
          <div className="modal-actions" style={{ marginTop: 0 }}>
            <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
          </div>
        )}

        {/* No holdings at all */}
        {!initialHolding && holdings.length === 0 && (
          <div className="modal-actions">
            <button type="button" className="btn secondary" onClick={onClose}>Close</button>
          </div>
        )}

      </div>
    </div>
  );
}
