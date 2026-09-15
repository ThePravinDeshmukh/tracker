import type { CandlestickSeriesPartialOptions } from 'lightweight-charts';

export const CANDLE_UP_COLOR = '#0ECB81';
export const CANDLE_DOWN_COLOR = '#F6465D';

const TRANSPARENT = 'rgba(0,0,0,0)';

export type CandleVisibility = 'shown' | 'hidden';

/**
 * Candles are hidden by painting them transparent rather than by setting the
 * series' `visible: false`, because hiding the series would also drop
 * everything anchored to it — the avg/stop-loss price lines, the last-price
 * label and the crosshair OHLCV readout — and would rescale the price axis
 * away from the candle range the moving averages are read against.
 */
export function candleColorOptions(visibility: CandleVisibility): CandlestickSeriesPartialOptions {
  const upColor = visibility === 'shown' ? CANDLE_UP_COLOR : TRANSPARENT;
  const downColor = visibility === 'shown' ? CANDLE_DOWN_COLOR : TRANSPARENT;
  return {
    upColor,
    downColor,
    borderUpColor: upColor,
    borderDownColor: downColor,
    wickUpColor: upColor,
    wickDownColor: downColor,
  };
}
