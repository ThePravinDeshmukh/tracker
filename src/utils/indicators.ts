import { UTCTimestamp } from 'lightweight-charts';

export interface MAPoint {
  time: UTCTimestamp;
  value: number;
}

export interface CloseSample {
  time: UTCTimestamp;
  close: number;
}

// A bar with no indicator value yet (e.g. still inside the warm-up window).
// lightweight-charts renders these as empty space but still counts them
// toward the series' timeline, which is what keeps a shorter indicator
// series' bar indices lined up with the full-length candle series.
export interface WhitespacePoint {
  time: UTCTimestamp;
}

// RSI/MACD only produce a value once their warm-up window (RSI_PERIOD, or
// MACD_SLOW_PERIOD+MACD_SIGNAL_PERIOD) is satisfied, so their data starts
// later than the candles. Left as-is, that shorter series would have its own
// bar index 0 land on a later timestamp than the candle pane's bar index 0,
// throwing off pane-to-pane alignment. Padding the front with whitespace
// points (one per skipped candle time) makes the indicator pane's timeline
// exactly match the candle pane's, so the same bar index is the same time
// in every pane.
export function padLeadingWhitespace<T extends { time: UTCTimestamp }>(
  fullTimes: UTCTimestamp[],
  data: T[]
): (T | WhitespacePoint)[] {
  const result: (T | WhitespacePoint)[] = [];
  let dataIndex = 0;
  for (const time of fullTimes) {
    if (dataIndex < data.length && data[dataIndex].time === time) {
      result.push(data[dataIndex]);
      dataIndex++;
    } else {
      result.push({ time });
    }
  }
  return result;
}

export const RSI_PERIOD = 14;
export const MACD_FAST_PERIOD = 12;
export const MACD_SLOW_PERIOD = 26;
export const MACD_SIGNAL_PERIOD = 9;

export interface MACDPoint {
  time: UTCTimestamp;
  macd: number;
  signal: number;
  histogram: number;
}

export function calcEMA(closes: CloseSample[], period: number): MAPoint[] {
  if (closes.length < period) return [];
  const k = 2 / (period + 1);
  let ema = closes.slice(0, period).reduce((s, c) => s + c.close, 0) / period;
  const result: MAPoint[] = [{ time: closes[period - 1].time, value: ema }];
  for (let i = period; i < closes.length; i++) {
    ema = closes[i].close * k + ema * (1 - k);
    result.push({ time: closes[i].time, value: ema });
  }
  return result;
}

export function calcSMA(closes: CloseSample[], period: number): MAPoint[] {
  const result: MAPoint[] = [];
  let sum = 0;
  for (let i = 0; i < closes.length; i++) {
    sum += closes[i].close;
    if (i >= period) sum -= closes[i - period].close;
    if (i >= period - 1) {
      result.push({ time: closes[i].time, value: sum / period });
    }
  }
  return result;
}

export function calcLastEMA(closes: CloseSample[], period: number): number | null {
  if (closes.length < period) return null;
  const k = 2 / (period + 1);
  let ema = closes.slice(0, period).reduce((s, c) => s + c.close, 0) / period;
  for (let i = period; i < closes.length; i++) {
    ema = closes[i].close * k + ema * (1 - k);
  }
  return ema;
}

export function calcLastSMA(closes: CloseSample[], period: number): number | null {
  if (closes.length < period) return null;
  const last = closes.slice(-period);
  return last.reduce((s, c) => s + c.close, 0) / period;
}

function rsiFromAverages(avgGain: number, avgLoss: number): number {
  if (avgLoss === 0) return 100;
  const relativeStrength = avgGain / avgLoss;
  return 100 - 100 / (1 + relativeStrength);
}

export function calcRSI(closes: CloseSample[], period: number = RSI_PERIOD): MAPoint[] {
  if (closes.length < period + 1) return [];

  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i <= period; i++) {
    const change = closes[i].close - closes[i - 1].close;
    if (change > 0) gainSum += change;
    else lossSum -= change;
  }
  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;
  const result: MAPoint[] = [{ time: closes[period].time, value: rsiFromAverages(avgGain, avgLoss) }];

  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i].close - closes[i - 1].close;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    result.push({ time: closes[i].time, value: rsiFromAverages(avgGain, avgLoss) });
  }
  return result;
}

export function calcLastRSI(closes: CloseSample[], period: number = RSI_PERIOD): number | null {
  const points = calcRSI(closes, period);
  return points.length > 0 ? points[points.length - 1].value : null;
}

function calcMacdLine(closes: CloseSample[], fastPeriod: number, slowPeriod: number): CloseSample[] {
  const fastEma = calcEMA(closes, fastPeriod);
  const slowEma = calcEMA(closes, slowPeriod);
  if (slowEma.length === 0) return [];

  const fastValueByTime = new Map(fastEma.map(point => [point.time, point.value]));
  const macdLine: CloseSample[] = [];
  for (const point of slowEma) {
    const fastValue = fastValueByTime.get(point.time);
    if (fastValue === undefined) continue;
    macdLine.push({ time: point.time, close: fastValue - point.value });
  }
  return macdLine;
}

export function calcMACD(
  closes: CloseSample[],
  fastPeriod: number = MACD_FAST_PERIOD,
  slowPeriod: number = MACD_SLOW_PERIOD,
  signalPeriod: number = MACD_SIGNAL_PERIOD
): MACDPoint[] {
  const macdLine = calcMacdLine(closes, fastPeriod, slowPeriod);
  const signalLine = calcEMA(macdLine, signalPeriod);
  const macdValueByTime = new Map(macdLine.map(point => [point.time, point.close]));

  return signalLine.map(point => {
    const macdValue = macdValueByTime.get(point.time) as number;
    return { time: point.time, macd: macdValue, signal: point.value, histogram: macdValue - point.value };
  });
}

export function calcLastMACD(
  closes: CloseSample[],
  fastPeriod: number = MACD_FAST_PERIOD,
  slowPeriod: number = MACD_SLOW_PERIOD,
  signalPeriod: number = MACD_SIGNAL_PERIOD
): MACDPoint | null {
  const points = calcMACD(closes, fastPeriod, slowPeriod, signalPeriod);
  return points.length > 0 ? points[points.length - 1] : null;
}
