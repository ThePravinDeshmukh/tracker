import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, LineStyle, TickMarkType, UTCTimestamp } from 'lightweight-charts';
import { MAPoint, RSI_PERIOD, WhitespacePoint } from '../utils/indicators';
import { formatIstTick, formatIstCrosshair } from '../utils/timeFormat';

export interface RsiChartHandle {
  getChart: () => IChartApi | null;
  setData: (points: (MAPoint | WhitespacePoint)[]) => void;
  update: (point: MAPoint) => void;
  clear: () => void;
}

interface Props {
  secondsVisible: boolean;
  dateOnly: boolean;
}

const CHART_BG = '#0b0e11';
const CHART_BORDER = '#1E2329';
const CHART_TEXT = '#848E9C';
const RSI_LINE_COLOR = '#8B5CF6';
const RSI_GUIDE_COLOR = '#363C45';
const RSI_OVERBOUGHT = 70;
const RSI_OVERSOLD = 30;

const RsiChart = forwardRef<RsiChartHandle, Props>(function RsiChart({ secondsVisible, dateOnly }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Line'> | null>(null);

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
        // Time labels only appear on the bottom-most pane (MACD) — see
        // MacdChart.tsx — so this pane's own axis stays hidden.
        visible: false,
        tickMarkFormatter: (time: UTCTimestamp, tickMarkType: TickMarkType) =>
          formatIstTick(time, tickMarkType, dateOnly),
      },
      handleScroll: true,
      handleScale: true,
    });

    const series = chart.addLineSeries({
      color: RSI_LINE_COLOR,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      autoscaleInfoProvider: () => ({
        priceRange: { minValue: 0, maxValue: 100 },
      }),
    });

    series.createPriceLine({
      price: RSI_OVERBOUGHT,
      color: RSI_GUIDE_COLOR,
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: '',
    });
    series.createPriceLine({
      price: RSI_OVERSOLD,
      color: RSI_GUIDE_COLOR,
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: '',
    });

    chartRef.current = chart;
    seriesRef.current = series;

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
      seriesRef.current = null;
    };
  }, []); // eslint-disable-line

  useEffect(() => {
    chartRef.current?.timeScale().applyOptions({
      timeVisible: !dateOnly,
      secondsVisible,
    });
    chartRef.current?.applyOptions({
      timeScale: {
        tickMarkFormatter: (time: UTCTimestamp, tickMarkType: TickMarkType) =>
          formatIstTick(time, tickMarkType, dateOnly),
      },
      localization: {
        timeFormatter: (time: UTCTimestamp) => formatIstCrosshair(time, secondsVisible),
      },
    });
  }, [secondsVisible, dateOnly]);

  useImperativeHandle(ref, () => ({
    getChart: () => chartRef.current,
    setData: (points: (MAPoint | WhitespacePoint)[]) => seriesRef.current?.setData(points),
    update: (point: MAPoint) => seriesRef.current?.update(point),
    clear: () => seriesRef.current?.setData([]),
  }), []);

  return (
    <div className="indicator-pane">
      <div className="indicator-pane-label">RSI ({RSI_PERIOD})</div>
      <div className="indicator-pane-container" ref={containerRef} />
    </div>
  );
});

export default RsiChart;
