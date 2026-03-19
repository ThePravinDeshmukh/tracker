import { Recommendation } from '../types';

export interface OHLCVPoint {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const OBV_SMA_PERIOD = 20;
const MFI_PERIOD = 14;
const VOL_MA_WINDOW = 5;
const VOL_SPIKE_FACTOR = 2;
const PRICE_SPIKE_PCT = 0.02;

export function computeSMA(data: number[], window: number): number[] {
  return data.map((_, i) => {
    if (i < window - 1) return NaN;
    const slice = data.slice(i - window + 1, i + 1);
    return slice.reduce((sum, val) => sum + val, 0) / window;
  });
}

export function computeOBV(points: OHLCVPoint[]): number[] {
  const obv: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    const prev = obv[i - 1];
    const close = points[i].close;
    const prevClose = points[i - 1].close;
    const vol = points[i].volume;
    if (close > prevClose) obv.push(prev + vol);
    else if (close < prevClose) obv.push(prev - vol);
    else obv.push(prev);
  }
  return obv;
}

export function computeMFI(points: OHLCVPoint[], period = MFI_PERIOD): number[] {
  const typicalPrices = points.map(p => (p.high + p.low + p.close) / 3);
  const rawMoneyFlows = typicalPrices.map((tp, i) => tp * points[i].volume);

  return points.map((_, i) => {
    if (i < period) return NaN;
    let posFlow = 0;
    let negFlow = 0;
    for (let j = i - period + 1; j <= i; j++) {
      if (typicalPrices[j] > typicalPrices[j - 1]) {
        posFlow += rawMoneyFlows[j];
      } else {
        negFlow += rawMoneyFlows[j];
      }
    }
    if (negFlow === 0) return 100;
    return 100 - 100 / (1 + posFlow / negFlow);
  });
}

function obvSignal(points: OHLCVPoint[]): Recommendation {
  const obv = computeOBV(points);
  const sma = computeSMA(obv, OBV_SMA_PERIOD);
  const last = obv.length - 1;
  if (isNaN(sma[last])) return 'HOLD';
  if (obv[last] > sma[last]) return 'BUY';
  if (obv[last] < sma[last]) return 'SELL';
  return 'HOLD';
}

function mfiSignal(points: OHLCVPoint[]): Recommendation {
  const mfi = computeMFI(points);
  const last = mfi[mfi.length - 1];
  if (isNaN(last)) return 'HOLD';
  if (last < 20) return 'BUY';
  if (last > 80) return 'SELL';
  return 'HOLD';
}

function momentumVolumeSignal(points: OHLCVPoint[]): Recommendation {
  if (points.length < VOL_MA_WINDOW + 1) return 'HOLD';
  const last = points.length - 1;
  const current = points[last];
  const prev = points[last - 1];
  const recentVols = points.slice(last - VOL_MA_WINDOW, last).map(p => p.volume);
  const avgVol = recentVols.reduce((sum, v) => sum + v, 0) / VOL_MA_WINDOW;
  const priceChangePct = (current.close - prev.close) / prev.close;
  const isVolumeSpike = current.volume > avgVol * VOL_SPIKE_FACTOR;
  if (priceChangePct > PRICE_SPIKE_PCT && isVolumeSpike) return 'BUY';
  if (priceChangePct < -PRICE_SPIKE_PCT && isVolumeSpike) return 'SELL';
  return 'HOLD';
}

export function getRecommendation(points: OHLCVPoint[]): Recommendation {
  if (points.length < OBV_SMA_PERIOD + 1) return 'HOLD';
  const signals = [obvSignal(points), mfiSignal(points), momentumVolumeSignal(points)];
  const buys = signals.filter(s => s === 'BUY').length;
  const sells = signals.filter(s => s === 'SELL').length;
  if (buys >= 2) return 'BUY';
  if (sells >= 2) return 'SELL';
  return 'HOLD';
}
