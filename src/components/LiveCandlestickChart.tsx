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
const BINANCE_YELLOW = '#F0B90B';

function fmtPrice(n: number): string {
  if (n >= 1000) return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  return n.toLocaleString('en-US', { minimumFractionDigits: 6, maximumFractionDigits: 6 });
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

export default function LiveCandlestickChart({ symbol, avgPrice, stopLoss, livePrice, onClose }: Props) {
  const [interval, setInterval] = useState<CandleInterval>('1m');
  const { initialCandles, candleUpdate, loading, error } = useLiveCandlesticks(symbol, interval);

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const initializedRef = useRef(false);
  // lightweight-charts requires setData([bar]) before update() works on an empty series
  const hasInitialBarRef = useRef(false);

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
    });

    const volumeSeries = chart.addHistogramSeries({
      color: VOL_UP,
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.78, bottom: 0 },
    });

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
      initializedRef.current = false;
      hasInitialBarRef.current = false;
    };
  }, []); // eslint-disable-line

  // Update timeScale options when interval changes
  useEffect(() => {
    chartRef.current?.timeScale().applyOptions({
      timeVisible: interval !== '1d',
      secondsVisible: interval === '1s',
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

  // Load initial historical data
  useEffect(() => {
    const series = candleSeriesRef.current;
    const volSeries = volumeSeriesRef.current;
    if (!series || !volSeries) return;

    if (interval === '1s') {
      // Clear for fresh 1s candles; first candleUpdate will use setData([bar])
      series.setData([]);
      volSeries.setData([]);
      hasInitialBarRef.current = false;
      initializedRef.current = true;
      return;
    }

    if (initialCandles.length === 0) return;

    series.setData(initialCandles.map(candleToCandlestickData));
    volSeries.setData(initialCandles.map(candleToHistogramData));
    chartRef.current?.timeScale().fitContent();
    hasInitialBarRef.current = true;
    initializedRef.current = true;
  }, [initialCandles, interval]);

  // Apply live candle updates
  useEffect(() => {
    const series = candleSeriesRef.current;
    const volSeries = volumeSeriesRef.current;
    if (!candleUpdate || !series || !volSeries) return;
    if (!initializedRef.current) return;

    if (!hasInitialBarRef.current) {
      // series.update() silently fails on a completely empty series — seed it first
      series.setData([candleToCandlestickData(candleUpdate)]);
      volSeries.setData([candleToHistogramData(candleUpdate)]);
      hasInitialBarRef.current = true;
    } else {
      series.update(candleToCandlestickData(candleUpdate));
      volSeries.update(candleToHistogramData(candleUpdate));
    }
  }, [candleUpdate]);

  const handleIntervalChange = useCallback((newInterval: CandleInterval) => {
    initializedRef.current = false;
    hasInitialBarRef.current = false;
    setInterval(newInterval);
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

      {/* OHLCV info bar */}
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
      </div>

      {/* Chart canvas area */}
      <div className="live-chart-container" ref={containerRef} />
    </div>
  );
}
