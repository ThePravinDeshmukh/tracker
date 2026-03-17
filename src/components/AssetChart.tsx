import React, { useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { TooltipContentProps } from 'recharts';
import type { ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent';
import { useAssetHistory, TimeframeKey, PricePoint } from '../hooks/useAssetHistory';
import { getCoinIcon, COIN_COLORS } from '../hooks/useCryptoPrices';

interface Props {
  symbol: string;
  livePrice: number | undefined;
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

function fmtPrice(n: number): string {
  if (n >= 1000) return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  return n.toLocaleString('en-US', { minimumFractionDigits: 6, maximumFractionDigits: 6 });
}

function fmtAxisTime(ts: number, interval: TimeframeKey): string {
  const d = new Date(ts);
  if (interval === '1d') {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function calcDomain(data: PricePoint[]): [number, number] {
  const prices = data.map(d => d.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const pad = (max - min) * 0.05 || max * 0.001;
  return [min - pad, max + pad];
}

function isRising(data: PricePoint[]): boolean {
  return data.length >= 2 && data[data.length - 1].price >= data[0].price;
}

export default function AssetChart({ symbol, livePrice, onClose }: Props) {
  const [interval, setInterval] = useState<TimeframeKey>('1h');
  const { data, loading, error } = useAssetHistory(symbol, interval);

  const color = COIN_COLORS[symbol] ?? '#7c6dfa';
  const icon = getCoinIcon(symbol);
  const lineColor = data.length > 0 ? (isRising(data) ? '#34d48a' : '#fa5252') : '#7c6dfa';
  const domain = data.length > 0 ? calcDomain(data) : undefined;

  const renderTooltip = ({ active, payload }: TooltipContentProps<ValueType, NameType>) => {
    if (!active || !payload?.length) return null;
    const point = payload[0].payload as PricePoint;
    return (
      <div className="chart-tooltip">
        <div className="chart-tooltip-time">{fmtAxisTime(point.time, interval)}</div>
        <div className="chart-tooltip-price">${fmtPrice(point.price)}</div>
      </div>
    );
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal chart-modal" onClick={e => e.stopPropagation()}>

        <div className="modal-header">
          <div className="chart-title">
            <div
              className="coin-icon"
              style={{ background: `${color}22`, color }}
            >
              {icon}
            </div>
            <div>
              <div className="chart-title-symbol">{symbol}/USDT</div>
              {livePrice !== undefined && (
                <div className="chart-title-price">${fmtPrice(livePrice)}</div>
              )}
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
          {error && <div className="chart-error">Failed to load price data</div>}
          {!loading && !error && data.length > 0 && (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <XAxis
                  dataKey="time"
                  tickFormatter={ts => fmtAxisTime(ts as number, interval)}
                  tick={{ fontSize: 10, fill: 'var(--muted)', fontFamily: 'var(--mono)' }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={60}
                />
                <YAxis
                  domain={domain}
                  tickFormatter={v => fmtPrice(v as number)}
                  tick={{ fontSize: 10, fill: 'var(--muted)', fontFamily: 'var(--mono)' }}
                  axisLine={false}
                  tickLine={false}
                  width={80}
                />
                <Tooltip content={renderTooltip} />
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke={lineColor}
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

      </div>
    </div>
  );
}
