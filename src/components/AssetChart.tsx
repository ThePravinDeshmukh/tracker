import React, { useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine,
  BarChart, Bar, Cell,
} from 'recharts';
import type { TooltipContentProps } from 'recharts';
import type { ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent';
import { useAssetHistory, TimeframeKey, PricePoint } from '../hooks/useAssetHistory';
import { VolumePoint } from '../types';
import { getCoinIcon, getCoinColor } from '../hooks/useCryptoPrices';

interface Props {
  symbol: string;
  avgPrice: number;
  livePrice: number | undefined;
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
const Y_AXIS_WIDTH = 80;

function fmtPrice(n: number): string {
  if (n >= 1000) return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  return n.toLocaleString('en-US', { minimumFractionDigits: 6, maximumFractionDigits: 6 });
}

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

function calcDomain(data: PricePoint[], avgPrice: number): [number, number] {
  const prices = [...data.map(d => d.price), avgPrice];
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const pad = (max - min) * 0.05 || max * 0.001;
  return [min - pad, max + pad];
}

function isRising(data: PricePoint[]): boolean {
  return data.length >= 2 && data[data.length - 1].price >= data[0].price;
}

export default function AssetChart({ symbol, avgPrice, livePrice, liveVolume, onClose }: Props) {
  const [interval, setInterval] = useState<TimeframeKey>('1m');
  const { data, volumeHistory, loading, error } = useAssetHistory(symbol, interval);

  const color = getCoinColor(symbol);
  const icon = getCoinIcon(symbol);
  const lineColor = data.length > 0 ? (isRising(data) ? '#34d48a' : '#fa5252') : '#7c6dfa';
  const domain = data.length > 0 ? calcDomain(data, avgPrice) : undefined;
  const maxVol = volumeHistory.length > 0 ? Math.max(...volumeHistory.map(v => v.volume)) : undefined;

  const syncId = `asset-${symbol}`;
  const hasData = !loading && !error && data.length > 0 && volumeHistory.length > 0;

  const renderPriceTooltip = ({ active, payload }: TooltipContentProps<ValueType, NameType>) => {
    if (!active || !payload?.length) return null;
    const point = payload[0].payload as PricePoint;
    return (
      <div className="chart-tooltip">
        <div className="chart-tooltip-time">{fmtAxisTime(point.time, interval)}</div>
        <div className="chart-tooltip-price">${fmtPrice(point.price)}</div>
      </div>
    );
  };

  const renderVolumeTooltip = ({ active, payload }: TooltipContentProps<ValueType, NameType>) => {
    if (!active || !payload?.length) return null;
    const point = payload[0].payload as VolumePoint;
    return (
      <div className="chart-tooltip">
        <div className="chart-tooltip-price">{fmtVolume(point.volume)}</div>
        <div style={{ color: point.isUp ? 'var(--green)' : 'var(--red)', fontSize: 11, marginTop: 2 }}>
          {point.isUp ? '▲ up candle' : '▼ down candle'}
        </div>
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
              <div className="chart-title-price">
                {livePrice !== undefined && `$${fmtPrice(livePrice)}`}
                {liveVolume !== undefined && (
                  <span style={{ marginLeft: 8, color: 'var(--muted)', fontSize: 12 }}>
                    Vol {fmtVolume(liveVolume)}
                  </span>
                )}
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
          {error && <div className="chart-error">Failed to load chart data</div>}
          {hasData && (
            <div style={{ width: '100%' }}>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={data} syncId={syncId} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <XAxis dataKey="time" hide />
                  <YAxis
                    domain={domain}
                    tickFormatter={(v: number) => fmtPrice(v)}
                    tick={{ fontSize: 10, fill: 'var(--muted)', fontFamily: 'var(--mono)' }}
                    axisLine={false}
                    tickLine={false}
                    width={Y_AXIS_WIDTH}
                  />
                  <Tooltip content={renderPriceTooltip} />
                  <ReferenceLine
                    y={avgPrice}
                    stroke="var(--accent)"
                    strokeDasharray="4 3"
                    strokeWidth={1}
                    label={{ value: `Avg $${fmtPrice(avgPrice)}`, position: 'insideTopRight', fontSize: 10, fill: 'var(--accent)', fontFamily: 'var(--mono)' }}
                  />
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

              <ResponsiveContainer width="100%" height={90}>
                <BarChart data={volumeHistory} syncId={syncId} margin={{ top: 4, right: 8, bottom: 0, left: 0 }} barCategoryGap="15%">
                  <XAxis
                    dataKey="time"
                    tickFormatter={(ts: number) => fmtAxisTime(ts, interval)}
                    tick={{ fontSize: 10, fill: 'var(--muted)', fontFamily: 'var(--mono)' }}
                    axisLine={false}
                    tickLine={false}
                    minTickGap={60}
                  />
                  <YAxis
                    domain={[0, maxVol ? maxVol * 1.1 : 'auto']}
                    tickFormatter={(v: number) => fmtVolume(v)}
                    tick={{ fontSize: 10, fill: 'var(--muted)', fontFamily: 'var(--mono)' }}
                    axisLine={false}
                    tickLine={false}
                    width={Y_AXIS_WIDTH}
                  />
                  <Tooltip content={renderVolumeTooltip} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
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
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
