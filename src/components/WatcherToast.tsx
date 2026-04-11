import React, { useEffect } from 'react';
import { WatcherSignal } from '../types';

const TOAST_DURATION_MS = 4000;

interface Props {
  signal: WatcherSignal | null;
  onDismiss: () => void;
}

function fmtPrice(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function WatcherToast({ signal, onDismiss }: Props) {
  useEffect(() => {
    if (!signal) return;
    const timer = setTimeout(onDismiss, TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [signal, onDismiss]);

  if (!signal) return null;

  return (
    <div className="watcher-toast fade-in">
      <div className="watcher-toast-row">
        <span className="watcher-toast-symbol">{signal.symbol}</span>
        <span className="watcher-toast-tag">Buy Signal</span>
        <button className="btn-icon" onClick={onDismiss}>✕</button>
      </div>
      <div className="watcher-toast-price mono">${fmtPrice(signal.price)}</div>
      <div className="watcher-toast-stats">
        <span className="watcher-toast-stat pos">+{signal.priceChangePct.toFixed(1)}% 5min</span>
        <span className="watcher-toast-stat muted">{signal.volumeRatio.toFixed(1)}× vol</span>
      </div>
    </div>
  );
}
