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
} from 'lightweight-charts';
import { CandleInterval, CandlePoint } from '../types';
import { useLiveCandlesticks } from '../hooks/useLiveCandlesticks';
import { getCoinIcon, getCoinColor } from '../hooks/useCryptoPrices';
import { calcEMA, calcSMA, calcLastEMA, calcLastSMA, MAPoint } from '../utils/indicators';

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

interface CloseSample {
  time: UTCTimestamp;
  close: number;
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

const IST_TZ = 'Asia/Kolkata';

function toIstDate(time: UTCTimestamp): Date {
  return new Date((time as number) * 1000);
}

function formatIstTick(time: UTCTimestamp, secondsVisible: boolean, dateOnly: boolean): string {
  const d = toIstDate(time);
  if (dateOnly) {
    return d.toLocaleDateString('en-GB', { timeZone: IST_TZ, day: '2-digit', month: 'short' });
  }
  return d.toLocaleTimeString('en-GB', {
    timeZone: IST_TZ,
    hour: '2-digit',
    minute: '2-digit',
    second: secondsVisible ? '2-digit' : undefined,
    hour12: false,
  });
}

function formatIstCrosshair(time: UTCTimestamp, secondsVisible: boolean): string {
  const d = toIstDate(time);
  const date = d.toLocaleDateString('en-GB', { timeZone: IST_TZ, day: '2-digit', month: 'short', year: 'numeric' });
  const t = d.toLocaleTimeString('en-GB', {
    timeZone: IST_TZ,
    hour: '2-digit',
    minute: '2-digit',
    second: secondsVisible ? '2-digit' : undefined,
    hour12: false,
  });
  return `${date} ${t} IST`;
}

function fmtPrice(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
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

  const initializedRef = useRef(false);
  // lightweight-charts requires setData([bar]) before update() works on an empty series
  const hasInitialBarRef = useRef(false);
  // accumulates all close prices for MA computation across initial + live data
  const closesRef = useRef<CloseSample[]>([]);
  const currentCandleRef = useRef<CandlePoint | null>(null);

  const [hoveredOhlcv, setHoveredOhlcv] = useState<OhlcvInfo | null>(null);

  const icon = getCoinIcon(symbol);
  const color = getCoinColor(symbol);
  const baseSymbol = symbol.replace(/USDT$/, '');

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
      priceFormat: { type: 'price', precision: 4, minMove: 0.0001 },
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
    const secondsVisible = interval === '1s';
    const dateOnly = interval === '1d';
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
  }, [interval]);

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
        color: '#ff4d4d',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `SL ${fmtPrice(stopLoss)}`,
      });
    }
  }, [avgPrice, stopLoss]); // eslint-disable-line

  // Load initial historical data and compute MAs
  useEffect(() => {
    const series = candleSeriesRef.current;
    const volSeries = volumeSeriesRef.current;
    if (!series || !volSeries) return;

    if (interval === '1s') {
      series.setData([]);
      volSeries.setData([]);
      ema9SeriesRef.current?.setData([]);
      ema21SeriesRef.current?.setData([]);
      sma50SeriesRef.current?.setData([]);
      sma200SeriesRef.current?.setData([]);
      closesRef.current = [];
      hasInitialBarRef.current = false;
      initializedRef.current = true;
      return;
    }

    if (initialCandles.length === 0) {
      closesRef.current = [];
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
  }, [initialCandles, interval, loading]);

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

      {/* Chart canvas area */}
      <div className="live-chart-container" ref={containerRef} />
    </div>
  );
}
