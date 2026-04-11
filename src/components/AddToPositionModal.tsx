import React, { useState, useEffect } from 'react';
import { Holding } from '../types';

interface Props {
  holding: Holding;
  onConfirm: (newPrice: number, newQty: number) => void;
  onClose: () => void;
}

function fmtPrice(n: number): string {
  if (n >= 1000) return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  return n.toLocaleString('en-US', { minimumFractionDigits: 6, maximumFractionDigits: 6 });
}

function fmt(n: number, decimals = 2): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export default function AddToPositionModal({ holding, onConfirm, onClose }: Props) {
  const [newPrice, setNewPrice] = useState('');
  const [newQty, setNewQty] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const parsedPrice = parseFloat(newPrice);
  const parsedQty = parseFloat(newQty);
  const valid = parsedPrice > 0 && parsedQty > 0;

  const newAvgPrice = valid
    ? (holding.avgPrice * holding.qty + parsedPrice * parsedQty) / (holding.qty + parsedQty)
    : null;
  const newTotalQty = valid ? holding.qty + parsedQty : null;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    if (!valid) return setError('Enter a valid price and quantity');
    onConfirm(parsedPrice, parsedQty);
    onClose();
  };

  const currentQtyDecimals = holding.qty < 1 ? 6 : 4;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal fade-in">
        <div className="modal-header">
          <h2>Add to {holding.symbol}</h2>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        <div className="add-to-current">
          <div className="add-to-stat">
            <div className="label">Current Avg Price</div>
            <div className="value mono">${fmtPrice(holding.avgPrice)}</div>
          </div>
          <div className="add-to-stat">
            <div className="label">Current Qty</div>
            <div className="value mono">{fmt(holding.qty, currentQtyDecimals)}</div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>New Buy Price (USD)</label>
            <input
              type="number"
              step="any"
              min="0"
              placeholder="e.g. 45000"
              value={newPrice}
              onChange={e => { setNewPrice(e.target.value); setError(''); }}
              autoFocus
            />
          </div>

          <div className="field">
            <label>Qty Bought</label>
            <input
              type="number"
              step="any"
              min="0"
              placeholder="e.g. 0.1"
              value={newQty}
              onChange={e => { setNewQty(e.target.value); setError(''); }}
            />
          </div>

          {valid && newAvgPrice !== null && newTotalQty !== null && (
            <div className="add-to-preview">
              <div className="add-to-preview-row">
                <span>New average price</span>
                <span className="mono">${fmtPrice(newAvgPrice)}</span>
              </div>
              <div className="add-to-preview-row">
                <span>New total qty</span>
                <span className="mono">{fmt(newTotalQty, newTotalQty < 1 ? 6 : 4)}</span>
              </div>
            </div>
          )}

          {error && <div className="error">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn primary">Add to Position</button>
          </div>
        </form>
      </div>
    </div>
  );
}
