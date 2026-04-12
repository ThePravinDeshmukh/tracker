import React, { useState, useEffect } from 'react';
import { CorrelationResult, MomentumRow, Regime } from '../types';
import { getCoinIcon, getCoinColor } from '../hooks/useCryptoPrices';

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

  // Update base symbol when symbols list changes (e.g. first coin added)
  useEffect(() => {
    if (baseSymbol === '' && symbols.length > 0) {
      setBaseSymbol(symbols[0]);
    }
  }, [symbols, baseSymbol]);

  // Recompute whenever base symbol or rows change
  useEffect(() => {
    if (!baseSymbol) return;
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
