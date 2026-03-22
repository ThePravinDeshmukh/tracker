import { Recommendation, SignalDetail, RecommendationDetail } from '../types';

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

function obvSignal(points: OHLCVPoint[]): SignalDetail {
  const obv = computeOBV(points);
  const sma = computeSMA(obv, OBV_SMA_PERIOD);
  const last = obv.length - 1;
  if (isNaN(sma[last])) {
    return { indicator: 'OBV', signal: 'HOLD', reason: 'Insufficient data for SMA calculation' };
  }
  if (obv[last] > sma[last]) {
    return { indicator: 'OBV', signal: 'BUY', reason: `OBV above its ${OBV_SMA_PERIOD}-period SMA — volume accumulation (buying pressure)` };
  }
  if (obv[last] < sma[last]) {
    return { indicator: 'OBV', signal: 'SELL', reason: `OBV below its ${OBV_SMA_PERIOD}-period SMA — volume distribution (selling pressure)` };
  }
  return { indicator: 'OBV', signal: 'HOLD', reason: `OBV at its ${OBV_SMA_PERIOD}-period SMA — neutral volume flow` };
}

function mfiSignal(points: OHLCVPoint[]): SignalDetail {
  const mfi = computeMFI(points);
  const last = mfi[mfi.length - 1];
  if (isNaN(last)) {
    return { indicator: 'MFI', signal: 'HOLD', reason: 'Insufficient data for MFI calculation' };
  }
  const mfiVal = Math.round(last);
  if (last < 20) {
    return { indicator: 'MFI', signal: 'BUY', reason: `MFI = ${mfiVal} — oversold (< 20), buying pressure likely building` };
  }
  if (last > 80) {
    return { indicator: 'MFI', signal: 'SELL', reason: `MFI = ${mfiVal} — overbought (> 80), selling pressure elevated` };
  }
  return { indicator: 'MFI', signal: 'HOLD', reason: `MFI = ${mfiVal} — neutral range (20–80), no extreme pressure` };
}

function momentumVolumeSignal(points: OHLCVPoint[]): SignalDetail {
  if (points.length < VOL_MA_WINDOW + 1) {
    return { indicator: 'Momentum', signal: 'HOLD', reason: 'Insufficient candle data' };
  }
  const last = points.length - 1;
  const current = points[last];
  const prev = points[last - 1];
  const recentVols = points.slice(last - VOL_MA_WINDOW, last).map(p => p.volume);
  const avgVol = recentVols.reduce((sum, v) => sum + v, 0) / VOL_MA_WINDOW;
  const priceChangePct = (current.close - prev.close) / prev.close;
  const volMultiplier = current.volume / avgVol;
  const isVolumeSpike = current.volume > avgVol * VOL_SPIKE_FACTOR;
  const pctStr = `${priceChangePct >= 0 ? '+' : ''}${(priceChangePct * 100).toFixed(2)}%`;
  const volStr = `${volMultiplier.toFixed(1)}×`;

  if (priceChangePct > PRICE_SPIKE_PCT && isVolumeSpike) {
    return { indicator: 'Momentum', signal: 'BUY', reason: `Price ${pctStr} on ${volStr} avg volume — bullish spike confirmed` };
  }
  if (priceChangePct < -PRICE_SPIKE_PCT && isVolumeSpike) {
    return { indicator: 'Momentum', signal: 'SELL', reason: `Price ${pctStr} on ${volStr} avg volume — bearish spike confirmed` };
  }
  if (isVolumeSpike) {
    return { indicator: 'Momentum', signal: 'HOLD', reason: `Volume spike (${volStr} avg) but price ${pctStr} — inconclusive` };
  }
  return { indicator: 'Momentum', signal: 'HOLD', reason: `Price ${pctStr}, volume ${volStr} avg — no spike detected` };
}

export function getRecommendation(points: OHLCVPoint[]): RecommendationDetail {
  if (points.length < OBV_SMA_PERIOD + 1) {
    const noData: SignalDetail = { indicator: '', signal: 'HOLD', reason: 'Insufficient candle data' };
    return {
      signal: 'HOLD',
      details: [
        { ...noData, indicator: 'OBV' },
        { ...noData, indicator: 'MFI' },
        { ...noData, indicator: 'Momentum' },
      ],
    };
  }
  const details = [obvSignal(points), mfiSignal(points), momentumVolumeSignal(points)];
  const buys = details.filter(s => s.signal === 'BUY').length;
  const sells = details.filter(s => s.signal === 'SELL').length;
  let signal: Recommendation;
  if (buys >= 2) signal = 'BUY';
  else if (sells >= 2) signal = 'SELL';
  else signal = 'HOLD';
  return { signal, details };
}
