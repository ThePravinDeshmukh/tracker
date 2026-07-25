import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  createChart,
  ColorType,
  CrosshairMode,
  LineStyle,
  IChartApi,
  ISeriesApi,
  UTCTimestamp,
  MouseEventParams,
  Range,
  Time,
} from 'lightweight-charts';
import { CandleInterval, CandlePoint } from '../types';
import { useLiveCandlesticks } from '../hooks/useLiveCandlesticks';
import { getCoinIcon, getCoinColor } from '../hooks/useCryptoPrices';
import {
  calcEMA,
  calcSMA,
  calcLastEMA,
  calcLastSMA,
  calcRSI,
  calcLastRSI,
  calcMACD,
  calcLastMACD,
  MAPoint,
  CloseSample,
  RSI_PERIOD,
  MACD_FAST_PERIOD,
  MACD_SLOW_PERIOD,
  MACD_SIGNAL_PERIOD,
} from '../utils/indicators';
import { formatIstTick, formatIstCrosshair } from '../utils/timeFormat';
import RsiChart, { RsiChartHandle } from './RsiChart';
import MacdChart, { MacdChartHandle } from './MacdChart';

interface Props {
  symbol: string;
  avgPrice?: number;
  stopLoss?: number;
  livePrice?: number;
  onClose: () => void;
}

interface OhlcvInfo {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const TIMEFRAMES: { key: CandleInterval; label: string }[] = [
  { key: '1s', label: '1s' },
  { key: '1m', label: '1m' },
  { key: '5m', label: '5m' },
  { key: '15m', label: '15m' },
  { key: '30m', label: '30m' },
  { key: '1h', label: '1h' },
  { key: '4h', label: '4h' },
  { key: '1d', label: '1d' },
];

const CANDLE_UP = '#0ECB81';
const CANDLE_DOWN = '#F6465D';
const VOL_UP = 'rgba(14,203,129,0.4)';
const VOL_DOWN = 'rgba(246,70,93,0.4)';
const CHART_BG = '#0b0e11';
const CHART_SURFACE = '#161A1E';
const CHART_BORDER = '#1E2329';
const CHART_TEXT = '#848E9C';

const MA_EMA9_COLOR = '#F0B90B';
const MA_EMA21_COLOR = '#4CAF50';
const MA_SMA50_COLOR = '#A855F7';
const MA_SMA200_COLOR = '#F6465D';

function fmtPrice(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 6, maximumFractionDigits: 6 });
}

function candleOpenTime(nowMs: number, iv: CandleInterval): number {
  const s = Math.floor(nowMs / 1000);
  const periods: Record<CandleInterval, number> = {
    '1s': 1, '1m': 60, '5m': 300, '15m': 900,
    '30m': 1800, '1h': 3600, '4h': 14400, '1d': 86400,
  };
  return s - (s % periods[iv]);
}

function fmtVolume(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function candleToCandlestickData(c: CandlePoint) {
  return { time: c.time as UTCTimestamp, open: c.open, high: c.high, low: c.low, close: c.close };
}

function candleToHistogramData(c: CandlePoint) {
  return {
    time: c.time as UTCTimestamp,
    value: c.volume,
    color: c.close >= c.open ? VOL_UP : VOL_DOWN,
  };
}

function makeMASeries(chart: IChartApi, color: string): ISeriesApi<'Line'> {
  return chart.addLineSeries({
    color,
    lineWidth: 1,
    crosshairMarkerVisible: false,
    priceLineVisible: false,
    lastValueVisible: false,
  });
}

export default function LiveCandlestickChart({ symbol, avgPrice, stopLoss, livePrice, onClose }: Props) {
  const [interval, setInterval] = useState<CandleInterval>('1m');
  const [reloadKey, setReloadKey] = useState(0);
  const { initialCandles, candleUpdate, loading, error } = useLiveCandlesticks(symbol, interval, reloadKey);

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const ema9SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ema21SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const sma50SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const sma200SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const rsiChartRef = useRef<RsiChartHandle>(null);
  const macdChartRef = useRef<MacdChartHandle>(null);

  const initializedRef = useRef(false);
  // lightweight-charts requires setData([bar]) before update() works on an empty series
  const hasInitialBarRef = useRef(false);
  // accumulates all close prices for MA/RSI/MACD computation across initial + live data
  const closesRef = useRef<CloseSample[]>([]);
  const currentCandleRef = useRef<CandlePoint | null>(null);

  const [hoveredOhlcv, setHoveredOhlcv] = useState<OhlcvInfo | null>(null);

  const icon = getCoinIcon(symbol);
  const color = getCoinColor(symbol);
  const baseSymbol = symbol.replace(/USDT$/, '');
  const secondsVisible = interval === '1s';
  const dateOnly = interval === '1d';

  // Create chart once
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: CHART_BG },
        textColor: CHART_TEXT,
        fontFamily: "'Space Mono', monospace",
        fontSize: 11,
      },
      localization: {
        timeFormatter: (time: UTCTimestamp) =>
          formatIstCrosshair(time, true),
      },
      grid: {
        vertLines: { color: CHART_BORDER },
        horzLines: { color: CHART_BORDER },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: CHART_TEXT,
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#2B3139',
        },
        horzLine: {
          color: CHART_TEXT,
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#2B3139',
        },
      },
      rightPriceScale: {
        borderColor: CHART_BORDER,
        textColor: CHART_TEXT,
      },
      timeScale: {
        borderColor: CHART_BORDER,
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: (time: UTCTimestamp) =>
          formatIstTick(time, false, false),
      },
      handleScroll: true,
      handleScale: true,
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: CANDLE_UP,
      downColor: CANDLE_DOWN,
      borderUpColor: CANDLE_UP,
      borderDownColor: CANDLE_DOWN,
      wickUpColor: CANDLE_UP,
      wickDownColor: CANDLE_DOWN,
      priceLineVisible: true,
      priceLineWidth: 1,
      priceLineColor: CHART_TEXT,
      priceLineStyle: LineStyle.Dashed,
      lastValueVisible: true,
      priceFormat: { type: 'price', precision: 6, minMove: 0.000001 },
    });

    const volumeSeries = chart.addHistogramSeries({
      color: VOL_UP,
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.78, bottom: 0 },
    });

    ema9SeriesRef.current = makeMASeries(chart, MA_EMA9_COLOR);
    ema21SeriesRef.current = makeMASeries(chart, MA_EMA21_COLOR);
    sma50SeriesRef.current = makeMASeries(chart, MA_SMA50_COLOR);
    sma200SeriesRef.current = makeMASeries(chart, MA_SMA200_COLOR);

    // Subscribe to crosshair for OHLCV info bar
    chart.subscribeCrosshairMove((param: MouseEventParams) => {
      if (!param.point || !candleSeries || !volumeSeries) {
        setHoveredOhlcv(null);
        return;
      }
      const cData = param.seriesData.get(candleSeries);
      const vData = param.seriesData.get(volumeSeries);
      if (cData && 'open' in cData) {
        setHoveredOhlcv({
          open: (cData as { open: number; high: number; low: number; close: number }).open,
          high: (cData as { open: number; high: number; low: number; close: number }).high,
          low: (cData as { open: number; high: number; low: number; close: number }).low,
          close: (cData as { open: number; high: number; low: number; close: number }).close,
          volume: vData && 'value' in vData ? (vData as { value: number }).value : 0,
        });
      } else {
        setHoveredOhlcv(null);
      }
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    initializedRef.current = false;

    // Resize observer
    const observer = new ResizeObserver(entries => {
      const entry = entries[0];
      if (entry && chartRef.current) {
        const { width, height } = entry.contentRect;
        chartRef.current.applyOptions({ width, height });
      }
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      ema9SeriesRef.current = null;
      ema21SeriesRef.current = null;
      sma50SeriesRef.current = null;
      sma200SeriesRef.current = null;
      initializedRef.current = false;
      hasInitialBarRef.current = false;
      closesRef.current = [];
      currentCandleRef.current = null;
    };
  }, []); // eslint-disable-line

  // Update timeScale options when interval changes
  useEffect(() => {
    chartRef.current?.timeScale().applyOptions({
      timeVisible: !dateOnly,
      secondsVisible,
    });
    chartRef.current?.applyOptions({
      timeScale: {
        tickMarkFormatter: (time: UTCTimestamp) =>
          formatIstTick(time, secondsVisible, dateOnly),
      },
      localization: {
        timeFormatter: (time: UTCTimestamp) =>
          formatIstCrosshair(time, secondsVisible),
      },
    });
  }, [secondsVisible, dateOnly]);

  // The candlestick, RSI, and MACD panes each size their own right price
  // scale to fit their own labels (e.g. "112,862.524017" vs "51.96" vs
  // "0.0016"). Unequal price-scale widths shift each pane's plot area by a
  // different number of pixels, making the same timestamp land at different
  // x-positions across panes even when their visible time ranges match.
  // Force all three to the widest one.
  const syncPriceScaleWidths = useCallback(() => {
    const mainChart = chartRef.current;
    const rsiChart = rsiChartRef.current?.getChart() ?? null;
    const macdChart = macdChartRef.current?.getChart() ?? null;
    if (!mainChart || !rsiChart || !macdChart) return;

    const charts = [mainChart, rsiChart, macdChart];
    const maxWidth = Math.max(...charts.map(chart => chart.priceScale('right').width()));
    if (maxWidth <= 0) return;
    for (const chart of charts) {
      chart.priceScale('right').applyOptions({ minimumWidth: maxWidth });
    }
  }, []);

  // Link pan/zoom across the candlestick, RSI, and MACD panes so scrubbing one
  // moves them all together, like a standard multi-pane chart layout.
  //
  // This syncs by *time* range, not logical (bar-index) range. RSI/MACD need
  // a warm-up window (RSI_PERIOD / MACD_SLOW_PERIOD+MACD_SIGNAL_PERIOD bars)
  // before they emit a first value, so their series start later than the
  // candles — logical index 0 on the RSI/MACD panes is a later timestamp
  // than logical index 0 on the candle pane. Syncing by bar index would line
  // up the wrong bars across panes; syncing by the actual time window keeps
  // every pane showing the same wall-clock span.
  useEffect(() => {
    const mainChart = chartRef.current;
    const rsiChart = rsiChartRef.current?.getChart() ?? null;
    const macdChart = macdChartRef.current?.getChart() ?? null;
    if (!mainChart || !rsiChart || !macdChart) return;

    const charts = [mainChart, rsiChart, macdChart];
    let syncing = false;

    const subscriptions = charts.map(chart => {
      const handler = (range: Range<Time> | null) => {
        if (syncing || !range) return;
        syncing = true;
        try {
          for (const other of charts) {
            if (other === chart) continue;
            try {
              // Throws if `other` has no data covering `range` yet (e.g. still
              // loading, or mid-timeframe-switch) — skip that pane this tick.
              other.timeScale().setVisibleRange(range);
            } catch {}
          }
        } finally {
          syncing = false;
        }
        syncPriceScaleWidths();
      };
      chart.timeScale().subscribeVisibleTimeRangeChange(handler);
      return { chart, handler };
    });

    syncPriceScaleWidths();

    return () => {
      subscriptions.forEach(({ chart, handler }) => chart.timeScale().unsubscribeVisibleTimeRangeChange(handler));
    };
  }, [syncPriceScaleWidths]);

  // Set avg/stopLoss price lines when series is ready and values change
  useEffect(() => {
    const series = candleSeriesRef.current;
    if (!series) return;

    if (avgPrice !== undefined) {
      series.createPriceLine({
        price: avgPrice,
        color: '#64748b',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `Avg ${fmtPrice(avgPrice)}`,
      });
    }
    if (stopLoss !== undefined) {
      series.createPriceLine({
        price: stopLoss,
        color: '#f24e53',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `SL ${fmtPrice(stopLoss)}`,
      });
    }
  }, [avgPrice, stopLoss]); // eslint-disable-line

  // 1s-specific setup: clears all series and enables live-only mode immediately.
  // Runs on every interval change; only acts when switching to '1s'.
  // Kept separate so it fires right away on the interval-change render — without
  // waiting for initialCandles/loading to update (which 1s never does via REST).
  useEffect(() => {
    if (interval !== '1s') return;
    const series = candleSeriesRef.current;
    const volSeries = volumeSeriesRef.current;
    if (!series || !volSeries) return;
    series.setData([]);
    volSeries.setData([]);
    ema9SeriesRef.current?.setData([]);
    ema21SeriesRef.current?.setData([]);
    sma50SeriesRef.current?.setData([]);
    sma200SeriesRef.current?.setData([]);
    rsiChartRef.current?.clear();
    macdChartRef.current?.clear();
    closesRef.current = [];
    hasInitialBarRef.current = false;
    initializedRef.current = true;
  }, [interval]);

  // Load initial historical data and compute MAs.
  // Intentionally omits `interval` from deps: adding it caused a stale-data
  // race where the effect fired immediately on timeframe switch with bars from
  // the old interval still in initialCandles, leading to out-of-order timestamp
  // errors in series.update() that crashed the entire React app.
  // By depending only on initialCandles/loading, this effect only runs after
  // the hook has already reset its state, so `interval` in the closure is
  // always the new (correct) value.
  useEffect(() => {
    if (interval === '1s') return; // handled by the effect above
    const series = candleSeriesRef.current;
    const volSeries = volumeSeriesRef.current;
    if (!series || !volSeries) return;

    if (initialCandles.length === 0) {
      closesRef.current = [];
      rsiChartRef.current?.clear();
      macdChartRef.current?.clear();
      // REST finished with no data — still allow kline WS updates to flow through
      if (!loading) initializedRef.current = true;
      return;
    }

    series.setData(initialCandles.map(candleToCandlestickData));
    volSeries.setData(initialCandles.map(candleToHistogramData));
    chartRef.current?.timeScale().fitContent();
    hasInitialBarRef.current = true;
    initializedRef.current = true;
    currentCandleRef.current = initialCandles[initialCandles.length - 1];

    const closes: CloseSample[] = initialCandles.map(c => ({ time: c.time as UTCTimestamp, close: c.close }));
    closesRef.current = closes;

    ema9SeriesRef.current?.setData(calcEMA(closes, 9) as MAPoint[]);
    ema21SeriesRef.current?.setData(calcEMA(closes, 21) as MAPoint[]);
    sma50SeriesRef.current?.setData(calcSMA(closes, 50) as MAPoint[]);
    sma200SeriesRef.current?.setData(calcSMA(closes, 200) as MAPoint[]);
    rsiChartRef.current?.setData(calcRSI(closes, RSI_PERIOD));
    macdChartRef.current?.setData(calcMACD(closes, MACD_FAST_PERIOD, MACD_SLOW_PERIOD, MACD_SIGNAL_PERIOD));
    syncPriceScaleWidths();
  }, [initialCandles, loading]); // eslint-disable-line

  // Apply live candle updates and update MA last values
  useEffect(() => {
    const series = candleSeriesRef.current;
    const volSeries = volumeSeriesRef.current;
    if (!candleUpdate || !series || !volSeries) return;
    if (!initializedRef.current) return;

    const t = candleUpdate.time as UTCTimestamp;
    currentCandleRef.current = { ...candleUpdate };

    // Maintain closes array for incremental MA computation
    const closes = closesRef.current;
    if (closes.length > 0 && closes[closes.length - 1].time === t) {
      closes[closes.length - 1] = { time: t, close: candleUpdate.close };
    } else {
      closes.push({ time: t, close: candleUpdate.close });
    }

    // Update MA series with latest computed value
    const lastEma9 = calcLastEMA(closes, 9);
    const lastEma21 = calcLastEMA(closes, 21);
    const lastSma50 = calcLastSMA(closes, 50);
    const lastSma200 = calcLastSMA(closes, 200);
    if (lastEma9 !== null) ema9SeriesRef.current?.update({ time: t, value: lastEma9 });
    if (lastEma21 !== null) ema21SeriesRef.current?.update({ time: t, value: lastEma21 });
    if (lastSma50 !== null) sma50SeriesRef.current?.update({ time: t, value: lastSma50 });
    if (lastSma200 !== null) sma200SeriesRef.current?.update({ time: t, value: lastSma200 });

    // Update RSI/MACD panes with latest computed value
    const lastRsi = calcLastRSI(closes, RSI_PERIOD);
    const lastMacd = calcLastMACD(closes, MACD_FAST_PERIOD, MACD_SLOW_PERIOD, MACD_SIGNAL_PERIOD);
    if (lastRsi !== null) rsiChartRef.current?.update({ time: t, value: lastRsi });
    if (lastMacd !== null) macdChartRef.current?.update(lastMacd);
    syncPriceScaleWidths();

    if (!hasInitialBarRef.current) {
      // series.update() silently fails on a completely empty series — seed it first
      series.setData([candleToCandlestickData(candleUpdate)]);
      volSeries.setData([candleToHistogramData(candleUpdate)]);
      hasInitialBarRef.current = true;
      if (interval === '1s') {
        // Visible range is still from a previous timeframe — 1s bars are sub-pixel width.
        // Reset to a 65-second window so the bar is actually visible.
        const now = candleUpdate.time;
        chartRef.current?.timeScale().setVisibleRange({
          from: (now - 60) as UTCTimestamp,
          to: (now + 5) as UTCTimestamp,
        });
      }
    } else {
      series.update(candleToCandlestickData(candleUpdate));
      volSeries.update(candleToHistogramData(candleUpdate));
    }
  }, [candleUpdate]); // eslint-disable-line

  // Drive the forming candle from the aggTrade price feed so the chart ticks in
  // real-time even when the kline WS is throttled or hasn't delivered an update yet.
  useEffect(() => {
    if (livePrice === undefined || !initializedRef.current) return;
    const series = candleSeriesRef.current;
    const volSeries = volumeSeriesRef.current;
    if (!series || !volSeries) return;

    const current = currentCandleRef.current;
    if (!current) return;

    const candleTime = candleOpenTime(Date.now(), interval) as UTCTimestamp;
    let updated: CandlePoint;
    if (current.time === candleTime) {
      updated = {
        ...current,
        close: livePrice,
        high: Math.max(current.high, livePrice),
        low: Math.min(current.low, livePrice),
      };
    } else {
      updated = { time: candleTime, open: livePrice, high: livePrice, low: livePrice, close: livePrice, volume: 0 };
    }
    currentCandleRef.current = updated;

    if (!hasInitialBarRef.current) {
      series.setData([candleToCandlestickData(updated)]);
      volSeries.setData([candleToHistogramData(updated)]);
      hasInitialBarRef.current = true;
    } else {
      series.update(candleToCandlestickData(updated));
    }
  }, [livePrice]); // eslint-disable-line

  const handleIntervalChange = useCallback((newInterval: CandleInterval) => {
    initializedRef.current = false;
    hasInitialBarRef.current = false;
    currentCandleRef.current = null;
    setInterval(newInterval);
  }, []);

  const handleRefresh = useCallback(() => {
    initializedRef.current = false;
    hasInitialBarRef.current = false;
    closesRef.current = [];
    currentCandleRef.current = null;
    candleSeriesRef.current?.setData([]);
    volumeSeriesRef.current?.setData([]);
    ema9SeriesRef.current?.setData([]);
    ema21SeriesRef.current?.setData([]);
    sma50SeriesRef.current?.setData([]);
    sma200SeriesRef.current?.setData([]);
    rsiChartRef.current?.clear();
    macdChartRef.current?.clear();
    setReloadKey(k => k + 1);
  }, []);

  // Determine displayed OHLCV: hovered candle or latest update
  const displayOhlcv: OhlcvInfo | null = hoveredOhlcv ?? (candleUpdate
    ? { open: candleUpdate.open, high: candleUpdate.high, low: candleUpdate.low, close: candleUpdate.close, volume: candleUpdate.volume }
    : null);

  const ohlcvColor = displayOhlcv && displayOhlcv.close >= displayOhlcv.open ? CANDLE_UP : CANDLE_DOWN;

  return (
    <div className="live-chart-overlay">
      {/* Header */}
      <div className="live-chart-header">
        <div className="live-chart-coin">
          <div className="live-chart-icon" style={{ background: `${color}22`, color }}>
            {icon}
          </div>
          <div className="live-chart-symbol-block">
            <span className="live-chart-symbol">{baseSymbol}/USDT</span>
            <span className="live-chart-market">USDT Perpetual</span>
          </div>
        </div>

        {livePrice !== undefined && (
          <div className="live-chart-price-block">
            <span className="live-chart-live-price">${fmtPrice(livePrice)}</span>
          </div>
        )}

        <button
          className="live-chart-close"
          onClick={handleRefresh}
          title="Refresh"
          disabled={loading}
          style={{ marginRight: 8 }}
        >
          ⟳
        </button>
        <button className="live-chart-close" onClick={onClose} title="Close">✕</button>
      </div>

      {/* Timeframe strip */}
      <div className="live-chart-timeframes">
        {TIMEFRAMES.map(tf => (
          <button
            key={tf.key}
            className={`live-chart-tf-btn${interval === tf.key ? ' active' : ''}`}
            onClick={() => handleIntervalChange(tf.key)}
          >
            {tf.label}
          </button>
        ))}
      </div>

      {/* OHLCV info bar + MA legend */}
      <div className="live-chart-ohlcv-bar">
        {displayOhlcv ? (
          <>
            <span style={{ color: CHART_TEXT }}>O</span>
            <span style={{ color: ohlcvColor }}>{fmtPrice(displayOhlcv.open)}</span>
            <span style={{ color: CHART_TEXT }}>H</span>
            <span style={{ color: CANDLE_UP }}>{fmtPrice(displayOhlcv.high)}</span>
            <span style={{ color: CHART_TEXT }}>L</span>
            <span style={{ color: CANDLE_DOWN }}>{fmtPrice(displayOhlcv.low)}</span>
            <span style={{ color: CHART_TEXT }}>C</span>
            <span style={{ color: ohlcvColor }}>{fmtPrice(displayOhlcv.close)}</span>
            <span style={{ color: CHART_TEXT, marginLeft: 8 }}>Vol</span>
            <span style={{ color: CHART_TEXT }}>{fmtVolume(displayOhlcv.volume)}</span>
          </>
        ) : (
          <span style={{ color: CHART_TEXT }}>
            {loading ? 'Loading…' : error ? `Error: ${error}` : ''}
          </span>
        )}
        <span className="live-chart-ma-legend">
          <span style={{ color: MA_EMA9_COLOR }}>EMA9</span>
          <span style={{ color: MA_EMA21_COLOR }}>EMA21</span>
          <span style={{ color: MA_SMA50_COLOR }}>SMA50</span>
          <span style={{ color: MA_SMA200_COLOR }}>SMA200</span>
        </span>
      </div>

      {/* Chart canvas area + indicator panes */}
      <div className="live-chart-panes">
        <div className="live-chart-container" ref={containerRef} />
        <RsiChart ref={rsiChartRef} secondsVisible={secondsVisible} dateOnly={dateOnly} />
        <MacdChart ref={macdChartRef} secondsVisible={secondsVisible} dateOnly={dateOnly} />
      </div>
    </div>
  );
}
