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
  const [actionPriceStr, setActionPriceStr] = useState('');
  const [actionQtyStr, setActionQtyStr] = useState('');
  const [error, setError] = useState('');

  const isShort = selectedHolding?.type === 'short';
  const livePrice = selectedHolding ? prices[selectedHolding.symbol] : undefined;

  useEffect(() => {
    if (selectedHolding) {
      setActionPriceStr(String(livePrice ?? selectedHolding.avgPrice));
      setActionQtyStr('');
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

  const actionPrice = parseFloat(actionPriceStr) || 0;
  const actionQty = parseFloat(actionQtyStr) || 0;

  const isValid = selectedHolding !== null && actionPrice > 0 && actionQty > 0 && actionQty <= selectedHolding.qty;
  const isFullClose = selectedHolding !== null && actionQty >= selectedHolding.qty;

  const proceeds = isValid ? actionPrice * actionQty : null;
  const costBasis = isValid && selectedHolding ? selectedHolding.avgPrice * actionQty : null;
  // For short: realized PnL = costBasis - proceeds (profit when price falls)
  const realizedPnl = proceeds !== null && costBasis !== null
    ? (isShort ? costBasis - proceeds : proceeds - costBasis)
    : null;
  const realizedPnlPct = realizedPnl !== null && costBasis && costBasis > 0
    ? (realizedPnl / costBasis) * 100
    : null;
  const remainingQty = isValid && selectedHolding ? selectedHolding.qty - actionQty : null;

  const handleCloseAll = (): void => {
    if (!selectedHolding) return;
    setActionQtyStr(String(selectedHolding.qty));
    setError('');
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    if (!selectedHolding) return setError(`Select a holding to ${isShort ? 'cover' : 'sell'}`);
    if (actionPrice <= 0) return setError(`Enter a valid ${isShort ? 'cover' : 'sell'} price`);
    if (actionQty <= 0) return setError('Enter a valid quantity');
    if (actionQty > selectedHolding.qty) return setError(`Cannot ${isShort ? 'cover' : 'sell'} more than ${fmt(selectedHolding.qty, selectedHolding.qty < 1 ? 6 : 4)} units`);
    onConfirm(selectedHolding.symbol, actionQty);
    onClose();
  };

  const pickerLabel = isShort ? 'Select short to cover' : 'Select holding to sell';
  const priceLabel = isShort ? 'Cover Price (USD)' : 'Sell Price (USD)';
  const qtyLabel = isShort ? 'Qty to Cover' : 'Qty to Sell';
  const closeAllLabel = isShort ? 'Cover all' : 'Sell all';
  const confirmLabel = isFullClose && actionQty > 0
    ? (isShort ? 'Cover All' : 'Sell All')
    : (isShort ? 'Confirm Cover' : 'Confirm Sell');
  const proceedsLabel = isShort ? 'Cost to Cover' : 'Proceeds';

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal fade-in">

        <div className="modal-header">
          <h2>{initialHolding?.type === 'short' ? 'Cover Short' : 'Sell / Cover'}</h2>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        {/* Holding picker — shown when no holding was pre-selected */}
        {!initialHolding && (
          <div className="field">
            <label>{pickerLabel}</label>
            <div className="sell-holding-list">
              {holdings.length === 0 && (
                <div className="sell-holding-empty">No holdings to sell or cover</div>
              )}
              {holdings.map(h => {
                const color = getCoinColor(h.symbol);
                const price = prices[h.symbol];
                const isSelected = selectedHolding?.symbol === h.symbol;
                const holdingIsShort = h.type === 'short';
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
                      <span className="sell-holding-symbol">
                        {h.symbol}
                        {holdingIsShort && <span className="short-badge" style={{ marginLeft: 6 }}>SHORT</span>}
                      </span>
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

        {/* Action form — shown once a holding is selected */}
        {selectedHolding && (
          <>
            {initialHolding && (
              <div className="close-trade-stats">
                <div className="close-trade-stat">
                  <div className="label">{isShort ? 'Entry Price' : 'Avg Buy Price'}</div>
                  <div className="value mono">${fmtPrice(selectedHolding.avgPrice)}</div>
                </div>
                <div className="close-trade-stat">
                  <div className="label">Live Price</div>
                  <div className="value mono">{livePrice ? `$${fmtPrice(livePrice)}` : '—'}</div>
                </div>
                <div className="close-trade-stat">
                  <div className="label">Qty</div>
                  <div className="value mono">{fmt(selectedHolding.qty, selectedHolding.qty < 1 ? 6 : 4)}</div>
                </div>
              </div>
            )}

            {!initialHolding && (
              <div className="sell-selected-summary">
                <span>
                  {isShort ? 'Covering: ' : 'Selling: '}
                  <strong>{selectedHolding.symbol}</strong>
                  {isShort && <span className="short-badge" style={{ marginLeft: 6 }}>SHORT</span>}
                </span>
                <span className="mono muted">{fmt(selectedHolding.qty, selectedHolding.qty < 1 ? 6 : 4)} units · entry ${fmtPrice(selectedHolding.avgPrice)}</span>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="field">
                <label>{priceLabel}</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={actionPriceStr}
                  onChange={e => { setActionPriceStr(e.target.value); setError(''); }}
                  autoFocus
                />
              </div>

              <div className="field">
                <label>
                  {qtyLabel}
                  <button type="button" className="sell-all-link" onClick={handleCloseAll}>
                    {closeAllLabel}
                  </button>
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  max={selectedHolding.qty}
                  placeholder={`max ${fmt(selectedHolding.qty, selectedHolding.qty < 1 ? 6 : 4)}`}
                  value={actionQtyStr}
                  onChange={e => { setActionQtyStr(e.target.value); setError(''); }}
                />
              </div>

              {isValid && realizedPnl !== null && realizedPnlPct !== null && proceeds !== null && (
                <div className={`close-trade-pnl ${realizedPnl >= 0 ? 'pos' : 'neg'}`}>
                  <div className="close-trade-pnl-row">
                    <span>{proceedsLabel}</span>
                    <span className="mono">${fmt(proceeds)}</span>
                  </div>
                  {!isFullClose && remainingQty !== null && (
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
                <button type="submit" className={`btn ${isShort ? 'short-confirm' : 'sell-confirm'}`}>
                  {confirmLabel}
                </button>
              </div>
            </form>
          </>
        )}

        {!initialHolding && !selectedHolding && holdings.length > 0 && (
          <div className="modal-actions" style={{ marginTop: 0 }}>
            <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
          </div>
        )}

        {!initialHolding && holdings.length === 0 && (
          <div className="modal-actions">
            <button type="button" className="btn secondary" onClick={onClose}>Close</button>
          </div>
        )}

      </div>
    </div>
  );
}
