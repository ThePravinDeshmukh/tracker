import { UTCTimestamp } from 'lightweight-charts';

export interface MAPoint {
  time: UTCTimestamp;
  value: number;
}

interface CloseSample {
  time: UTCTimestamp;
  close: number;
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
