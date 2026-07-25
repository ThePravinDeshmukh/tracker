import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, UTCTimestamp } from 'lightweight-charts';
import { MACDPoint, MACD_FAST_PERIOD, MACD_SLOW_PERIOD, MACD_SIGNAL_PERIOD, WhitespacePoint } from '../utils/indicators';
import { formatIstTick, formatIstCrosshair } from '../utils/timeFormat';

export interface MacdChartHandle {
  getChart: () => IChartApi | null;
  setData: (points: (MACDPoint | WhitespacePoint)[]) => void;
  update: (point: MACDPoint) => void;
  clear: () => void;
}

function isMacdPoint(point: MACDPoint | WhitespacePoint): point is MACDPoint {
  return 'macd' in point;
}

interface Props {
  secondsVisible: boolean;
  dateOnly: boolean;
}

const CHART_BG = '#0b0e11';
const CHART_BORDER = '#1E2329';
const CHART_TEXT = '#848E9C';
const MACD_LINE_COLOR = '#2196F3';
const SIGNAL_LINE_COLOR = '#FF9800';
const HIST_UP_COLOR = 'rgba(14,203,129,0.6)';
const HIST_DOWN_COLOR = 'rgba(246,70,93,0.6)';

function histogramColor(value: number): string {
  return value >= 0 ? HIST_UP_COLOR : HIST_DOWN_COLOR;
}

const MacdChart = forwardRef<MacdChartHandle, Props>(function MacdChart({ secondsVisible, dateOnly }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const macdSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const signalSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const histSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

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
        timeFormatter: (time: UTCTimestamp) => formatIstCrosshair(time, secondsVisible),
      },
      grid: {
        vertLines: { color: CHART_BORDER },
        horzLines: { color: CHART_BORDER },
      },
      rightPriceScale: {
        borderColor: CHART_BORDER,
        textColor: CHART_TEXT,
      },
      timeScale: {
        borderColor: CHART_BORDER,
        timeVisible: !dateOnly,
        secondsVisible,
        tickMarkFormatter: (time: UTCTimestamp) => formatIstTick(time, secondsVisible, dateOnly),
      },
      handleScroll: true,
      handleScale: true,
    });

    const histSeries = chart.addHistogramSeries({
      priceFormat: { type: 'price', precision: 4, minMove: 0.0001 },
      priceLineVisible: false,
      lastValueVisible: false,
    });
    const macdSeries = chart.addLineSeries({
      color: MACD_LINE_COLOR,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
    });
    const signalSeries = chart.addLineSeries({
      color: SIGNAL_LINE_COLOR,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    chartRef.current = chart;
    macdSeriesRef.current = macdSeries;
    signalSeriesRef.current = signalSeries;
    histSeriesRef.current = histSeries;

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
      macdSeriesRef.current = null;
      signalSeriesRef.current = null;
      histSeriesRef.current = null;
    };
  }, []); // eslint-disable-line

  useEffect(() => {
    chartRef.current?.timeScale().applyOptions({
      timeVisible: !dateOnly,
      secondsVisible,
    });
    chartRef.current?.applyOptions({
      timeScale: {
        tickMarkFormatter: (time: UTCTimestamp) => formatIstTick(time, secondsVisible, dateOnly),
      },
      localization: {
        timeFormatter: (time: UTCTimestamp) => formatIstCrosshair(time, secondsVisible),
      },
    });
  }, [secondsVisible, dateOnly]);

  useImperativeHandle(ref, () => ({
    getChart: () => chartRef.current,
    setData: (points: (MACDPoint | WhitespacePoint)[]) => {
      macdSeriesRef.current?.setData(
        points.map(p => (isMacdPoint(p) ? { time: p.time, value: p.macd } : { time: p.time }))
      );
      signalSeriesRef.current?.setData(
        points.map(p => (isMacdPoint(p) ? { time: p.time, value: p.signal } : { time: p.time }))
      );
      histSeriesRef.current?.setData(
        points.map(p => (isMacdPoint(p) ? { time: p.time, value: p.histogram, color: histogramColor(p.histogram) } : { time: p.time }))
      );
    },
    update: (point: MACDPoint) => {
      macdSeriesRef.current?.update({ time: point.time, value: point.macd });
      signalSeriesRef.current?.update({ time: point.time, value: point.signal });
      histSeriesRef.current?.update({
        time: point.time,
        value: point.histogram,
        color: histogramColor(point.histogram),
      });
    },
    clear: () => {
      macdSeriesRef.current?.setData([]);
      signalSeriesRef.current?.setData([]);
      histSeriesRef.current?.setData([]);
    },
  }), []);

  return (
    <div className="indicator-pane">
      <div className="indicator-pane-label">
        MACD ({MACD_FAST_PERIOD},{MACD_SLOW_PERIOD},{MACD_SIGNAL_PERIOD})
      </div>
      <div className="indicator-pane-container indicator-pane-container--macd" ref={containerRef} />
    </div>
  );
});

export default MacdChart;
