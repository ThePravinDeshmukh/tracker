import React, { useEffect } from 'react';
import { getCoinIcon, getCoinColor } from '../hooks/useCryptoPrices';

interface Props {
  symbol: string;
  livePrice: number | undefined;
  onClose: () => void;
}

function fmtFocusPrice(n: number | undefined): string {
  if (!n) return '—';
  if (n >= 1000) return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(4);
  return n.toFixed(6);
}

export default function PriceFocusView({ symbol, livePrice, onClose }: Props) {
  const base = symbol.replace(/USDT$/, '');
  const color = getCoinColor(symbol);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className="price-focus-overlay" onClick={onClose}>
      <div className="price-focus-content" onClick={e => e.stopPropagation()}>
        <div className="price-focus-icon" style={{ background: `${color}22`, color }}>
          {getCoinIcon(symbol)}
        </div>
        <div className="price-focus-name">{base}</div>
        <div className="price-focus-price">
          {livePrice !== undefined ? `$${fmtFocusPrice(livePrice)}` : <span className="price-focus-loading">•••</span>}
        </div>
        <button className="price-focus-close" onClick={onClose}>✕</button>
      </div>
    </div>
  );
}
