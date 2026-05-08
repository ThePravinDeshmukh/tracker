import React, { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer,
} from 'recharts';
import { ClosedTrade } from '../types';
import { getCoinIcon, getCoinColor } from '../hooks/useCryptoPrices';

interface Props {
  trades: ClosedTrade[];
  onClear: () => void;
}

type Period = 'today' | '7d' | '30d' | 'all';

const PERIOD_LABELS: Record<Period, string> = {
  today: 'Today',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  all: 'All time',
};

const PERIOD_MS: Record<Exclude<Period, 'all'>, number> = {
  today: 86_400_000,
  '7d': 7 * 86_400_000,
  '30d': 30 * 86_400_000,
};

function fmt(n: number, decimals = 2): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function filterByPeriod(trades: ClosedTrade[], period: Period): ClosedTrade[] {
  if (period === 'all') return trades;
  const cutoff = Date.now() - PERIOD_MS[period];
  return trades.filter(t => t.closedAt >= cutoff);
}

interface DayBar { date: string; pnl: number; }

function groupByDay(trades: ClosedTrade[]): DayBar[] {
  const map = new Map<string, number>();
  for (const t of trades) {
    const key = new Date(t.closedAt).toLocaleDateString('en-CA'); // YYYY-MM-DD
    map.set(key, (map.get(key) ?? 0) + t.pnl);
  }
  return Array.from(map.entries())
    .map(([date, pnl]) => ({ date, pnl }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

interface Stats {
  totalPnl: number;
  winRate: number | null;
  avgWin: number | null;
  avgLoss: number | null;
  tradeCount: number;
}

function calcStats(trades: ClosedTrade[]): Stats {
  if (trades.length === 0) {
    return { totalPnl: 0, winRate: null, avgWin: null, avgLoss: null, tradeCount: 0 };
  }
  const wins = trades.filter(t => t.pnl > 0);
  const losses = trades.filter(t => t.pnl <= 0);
  const totalPnl = trades.reduce((s, t) => s + t.pnl, 0);
  const winRate = (wins.length / trades.length) * 100;
  const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : null;
  const avgLoss = losses.length > 0 ? losses.reduce((s, t) => s + t.pnl, 0) / losses.length : null;
  return { totalPnl, winRate, avgWin, avgLoss, tradeCount: trades.length };
}

interface TooltipPayload { date: string; pnl: number; }

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: TooltipPayload }[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const { date, pnl } = payload[0].payload;
  const d = new Date(date);
  const label = d.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <div className="history-chart-tooltip">
      <div className="history-chart-tooltip-date">{label}</div>
      <div className={`history-chart-tooltip-pnl ${pnl >= 0 ? 'pos' : 'neg'}`}>
        {pnl >= 0 ? '+' : ''}${fmt(Math.abs(pnl))}
      </div>
    </div>
  );
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

function fmtPrice(n: number): string {
  if (n >= 1000) return fmt(n, 2);
  if (n >= 1) return fmt(n, 4);
  if (n >= 0.01) return fmt(n, 6);
  return fmt(n, 8);
}

export default function TradeHistoryPanel({ trades, onClear }: Props) {
  const [period, setPeriod] = useState<Period>('30d');

  const filtered = useMemo(() => filterByPeriod(trades, period), [trades, period]);
  const stats = useMemo(() => calcStats(filtered), [filtered]);
  const dailyData = useMemo(() => groupByDay(filtered), [filtered]);

  const xTickFormatter = (date: string): string => {
    const d = new Date(date);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  return (
    <div className="history-panel">
      {/* Period filter */}
      <div className="history-period-bar">
        {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
          <button
            key={p}
            className={`period-btn${period === p ? ' active' : ''}`}
            onClick={() => setPeriod(p)}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {/* Stats strip */}
      <div className="history-stats-grid">
        <div className="history-stat">
          <div className="history-stat-label">Total Realized P&L</div>
          <div className={`history-stat-value mono ${stats.totalPnl >= 0 ? 'pos' : 'neg'}`}>
            {stats.tradeCount === 0 ? '—' : `${stats.totalPnl >= 0 ? '+' : ''}$${fmt(Math.abs(stats.totalPnl))}`}
          </div>
        </div>
        <div className="history-stat">
          <div className="history-stat-label">Win Rate</div>
          <div className="history-stat-value mono">
            {stats.winRate !== null ? `${fmt(stats.winRate)}%` : '—'}
          </div>
        </div>
        <div className="history-stat">
          <div className="history-stat-label">Avg Win</div>
          <div className="history-stat-value mono pos">
            {stats.avgWin !== null ? `+$${fmt(stats.avgWin)}` : '—'}
          </div>
        </div>
        <div className="history-stat">
          <div className="history-stat-label">Avg Loss</div>
          <div className="history-stat-value mono neg">
            {stats.avgLoss !== null ? `$${fmt(stats.avgLoss)}` : '—'}
          </div>
        </div>
        <div className="history-stat">
          <div className="history-stat-label">#Trades</div>
          <div className="history-stat-value mono">{stats.tradeCount}</div>
        </div>
      </div>

      {/* Bar chart */}
      {dailyData.length > 0 && (
        <div className="history-chart-section">
          <div className="history-chart-header">
            <span className="history-chart-title">Realized P&L</span>
            <span className={`history-chart-total mono ${stats.totalPnl >= 0 ? 'pos' : 'neg'}`}>
              {stats.totalPnl >= 0 ? '+' : ''}${fmt(Math.abs(stats.totalPnl))}
            </span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dailyData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={xTickFormatter}
                tick={{ fill: 'var(--muted)', fontSize: 11, fontFamily: 'var(--mono)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={v => `$${Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}K` : v}`}
                tick={{ fill: 'var(--muted)', fontSize: 11, fontFamily: 'var(--mono)' }}
                axisLine={false}
                tickLine={false}
                width={56}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <Bar dataKey="pnl" radius={[3, 3, 0, 0]} maxBarSize={40}>
                {dailyData.map((entry, index) => (
                  <Cell
                    key={index}
                    fill={entry.pnl >= 0 ? 'var(--green)' : 'var(--red)'}
                    fillOpacity={0.85}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Trade table */}
      {filtered.length === 0 ? (
        <div className="history-empty">
          <div className="empty-icon">◈</div>
          <p>No closed trades</p>
          <p className="empty-sub">Close a position to start tracking history</p>
        </div>
      ) : (
        <div className="history-table-wrap">
          <div className="history-table-header">
            <span>Currency</span>
            <span>Side</span>
            <span className="right">Qty</span>
            <span className="right">Entry</span>
            <span className="right">Close</span>
            <span className="right">P&L</span>
            <span className="right">Date / Time</span>
          </div>
          <div className="history-table-body">
            {filtered.map(trade => {
              const color = getCoinColor(trade.symbol);
              const isProfit = trade.pnl >= 0;
              return (
                <div key={trade.id} className="history-table-row">
                  <div className="history-trade-asset">
                    <div
                      className="coin-icon history-coin-icon"
                      style={{ background: `${color}22`, color, width: 28, height: 28, borderRadius: 7, fontSize: 11 }}
                    >
                      {getCoinIcon(trade.symbol)}
                    </div>
                    <span className="history-trade-symbol mono">{trade.symbol.replace('USDT', '')}</span>
                  </div>
                  <span>
                    <span className={`history-side-badge ${trade.side}`}>
                      {trade.side === 'long' ? '↑ Long' : '↓ Short'}
                    </span>
                  </span>
                  <span className="right mono history-cell-muted">{fmt(trade.qty, trade.qty < 1 ? 4 : 2)}</span>
                  <span className="right mono history-cell-muted">${fmtPrice(trade.entryPrice)}</span>
                  <span className="right mono history-cell-muted">${fmtPrice(trade.closePrice)}</span>
                  <span className={`right mono ${isProfit ? 'pos' : 'neg'}`}>
                    {isProfit ? '+' : ''}${fmt(Math.abs(trade.pnl))}
                    <span className="history-pnl-pct"> ({isProfit ? '+' : ''}{fmt(trade.pnlPct)}%)</span>
                  </span>
                  <span className="right history-cell-muted history-date">{formatDate(trade.closedAt)}</span>
                </div>
              );
            })}
          </div>
          {trades.length > 0 && (
            <div className="history-table-footer">
              <button className="history-clear-btn" onClick={onClear}>Clear all history</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
