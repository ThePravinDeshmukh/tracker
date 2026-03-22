import React, { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
  ResponsiveContainer,
} from 'recharts';
import type { TooltipContentProps } from 'recharts';
import type { ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent';
import { useAssetHistory, TimeframeKey } from '../hooks/useAssetHistory';
import { VolumePoint } from '../types';
import { getCoinIcon, getCoinColor } from '../hooks/useCryptoPrices';

interface Props {
  symbol: string;
  liveVolume: number | undefined;
  onClose: () => void;
}

const TIMEFRAMES: { key: TimeframeKey; label: string }[] = [
  { key: '1m', label: '1m' },
  { key: '5m', label: '5m' },
  { key: '15m', label: '15m' },
  { key: '30m', label: '30m' },
  { key: '1h', label: '1h' },
  { key: '4h', label: '4h' },
  { key: '1d', label: '1d' },
];

const VOL_UP_COLOR = 'rgba(52, 212, 138, 0.75)';
const VOL_DOWN_COLOR = 'rgba(250, 82, 82, 0.75)';

function fmtVolume(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function fmtAxisTime(ts: number, interval: TimeframeKey): string {
  const d = new Date(ts);
  if (interval === '1d') {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export default function VolumeChart({ symbol, liveVolume, onClose }: Props) {
  const [interval, setInterval] = useState<TimeframeKey>('1h');
  const { volumeHistory, loading, error } = useAssetHistory(symbol, interval);

  const color = getCoinColor(symbol);
  const icon = getCoinIcon(symbol);

  const renderTooltip = ({ active, payload }: TooltipContentProps<ValueType, NameType>) => {
    if (!active || !payload?.length) return null;
    const point = payload[0].payload as VolumePoint;
    return (
      <div className="chart-tooltip">
        <div className="chart-tooltip-time">{fmtAxisTime(point.time, interval)}</div>
        <div className="chart-tooltip-price">{fmtVolume(point.volume)}</div>
        <div className="vol-tooltip-dir" style={{ color: point.isUp ? 'var(--green)' : 'var(--red)', fontSize: 11, marginTop: 2 }}>
          {point.isUp ? '▲ up candle' : '▼ down candle'}
        </div>
      </div>
    );
  };

  const maxVol = volumeHistory.length > 0 ? Math.max(...volumeHistory.map(v => v.volume)) : undefined;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal chart-modal" onClick={e => e.stopPropagation()}>

        <div className="modal-header">
          <div className="chart-title">
            <div className="coin-icon" style={{ background: `${color}22`, color }}>
              {icon}
            </div>
            <div>
              <div className="chart-title-symbol">{symbol} — Volume</div>
              <div className="chart-title-price">
                {liveVolume !== undefined
                  ? `24h ${fmtVolume(liveVolume)}`
                  : 'Loading live volume…'}
              </div>
            </div>
          </div>
          <button className="btn-icon del" onClick={onClose} title="Close">✕</button>
        </div>

        <div className="chart-timeframes">
          {TIMEFRAMES.map(tf => (
            <button
              key={tf.key}
              className={`tf-btn${interval === tf.key ? ' active' : ''}`}
              onClick={() => setInterval(tf.key)}
            >
              {tf.label}
            </button>
          ))}
        </div>

        <div className="chart-area">
          {loading && <div className="chart-loading">Loading…</div>}
          {error && <div className="chart-error">Failed to load volume data</div>}
          {!loading && !error && volumeHistory.length > 0 && (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={volumeHistory} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="15%">
                <XAxis
                  dataKey="time"
                  tickFormatter={ts => fmtAxisTime(ts as number, interval)}
                  tick={{ fontSize: 10, fill: 'var(--muted)', fontFamily: 'var(--mono)' }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={60}
                />
                <YAxis
                  domain={[0, maxVol ? maxVol * 1.1 : 'auto']}
                  tickFormatter={v => fmtVolume(v as number)}
                  tick={{ fontSize: 10, fill: 'var(--muted)', fontFamily: 'var(--mono)' }}
                  axisLine={false}
                  tickLine={false}
                  width={72}
                />
                <Tooltip content={renderTooltip} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar dataKey="volume" isAnimationActive={false} radius={[2, 2, 0, 0]}>
                  {volumeHistory.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.isUp ? VOL_UP_COLOR : VOL_DOWN_COLOR}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

      </div>
    </div>
  );
}
