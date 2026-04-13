import React, { useState, useEffect, useRef } from 'react';
import { CorrelationResult, MomentumRow, Regime } from '../types';
import { getCoinIcon, getCoinColor } from '../hooks/useCryptoPrices';

const CORR_THROTTLE_MS = 10_000;

interface Props {
  symbols: string[];
  momentumRows: MomentumRow[];
  computeCorrelations: (baseSymbol: string) => CorrelationResult[];
}

function lookbackLabel(regime: Regime): string {
  if (regime === 'high_vol') return '15 min lookback (high vol)';
  if (regime === 'normal') return '60 min lookback';
  return 'Accumulating data…';
}

export default function CorrelationCard({ symbols, momentumRows, computeCorrelations }: Props) {
  const [baseSymbol, setBaseSymbol] = useState<string>(symbols[0] ?? '');
  const [results, setResults] = useState<CorrelationResult[]>([]);
  const lastComputeRef = useRef<number>(0);

  // Update base symbol when symbols list changes (e.g. first coin added)
  useEffect(() => {
    if (baseSymbol === '' && symbols.length > 0) {
      setBaseSymbol(symbols[0]);
    }
  }, [symbols, baseSymbol]);

  // Reset throttle when the user picks a different base symbol so it computes immediately
  useEffect(() => {
    lastComputeRef.current = 0;
  }, [baseSymbol]);

  // Recompute correlations at most every 10s — momentumRows is in deps so the
  // effect re-runs on ticks, but the throttle gate prevents the expensive
  // computeCorrelations() call from executing more than once per 10s.
  useEffect(() => {
    if (!baseSymbol) return;
    const now = Date.now();
    if (now - lastComputeRef.current < CORR_THROTTLE_MS) return;
    lastComputeRef.current = now;
    setResults(computeCorrelations(baseSymbol));
  }, [baseSymbol, momentumRows, computeCorrelations]);

  const baseRow = momentumRows.find(r => r.symbol === baseSymbol);
  const regime = baseRow?.regime ?? 'loading';

  if (symbols.length === 0) {
    return <div className="correlation-empty">Add coins to see correlations.</div>;
  }

  return (
    <div className="correlation-card">
      <div className="correlation-controls">
        <select
          className="sort-select"
          value={baseSymbol}
          onChange={e => setBaseSymbol(e.target.value)}
        >
          {symbols.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <span className={`regime-badge regime-badge--${regime}`}>
          {regime === 'high_vol' ? 'HIGH VOL' : regime === 'normal' ? 'NORMAL' : '…'}
        </span>
      </div>
      <div className="correlation-lookback muted">{lookbackLabel(regime)}</div>

      {results.length === 0 ? (
        <div className="correlation-empty-msg muted">
          Accumulating price history to compute correlations…
        </div>
      ) : (
        <div className="correlation-list">
          {results.map(r => {
            const color = getCoinColor(r.symbol);
            const icon = getCoinIcon(r.symbol);
            const isPos = r.correlation >= 0;
            const barWidth = Math.abs(r.correlation) * 100;
            return (
              <div key={r.symbol} className="correlation-row">
                <span className="corr-coin-icon" style={{ background: color }}>{icon}</span>
                <span className="corr-symbol">{r.symbol}</span>
                <div className="corr-bar-wrap">
                  <div
                    className={`corr-bar ${isPos ? 'corr-bar--pos' : 'corr-bar--neg'}`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
                <span className={`corr-value mono ${isPos ? 'pos' : 'neg'}`}>
                  {isPos ? '+' : ''}{r.correlation.toFixed(2)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
