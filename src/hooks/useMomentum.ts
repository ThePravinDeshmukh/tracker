import { useRef, useState, useCallback, useEffect } from 'react';
import { PriceMap, MomentumRow, StressEvent, CorrelationResult, Regime } from '../types';

// ── Constants (Market Pulse spec) ─────────────────────────────────────────────
const HISTORY_WINDOW_MS   = 60 * 60 * 1_000;  // keep 60 min of history
const RET_1M_WINDOW_MS    = 60 * 1_000;        // 1-min return lookback
const RET_5M_WINDOW_MS    = 5 * 60 * 1_000;    // 5-min return lookback
const VOL_WINDOW_MS       = 15 * 60 * 1_000;   // 15-min volatility window
const VOL_BUCKET_MS       = 60 * 1_000;        // 1-min buckets for vol computation
const REGIME_PERCENTILE   = 80;                // 80th-pct threshold
const REGIME_HISTORY_SIZE = 60;               // max vol15m readings per symbol
const STRESS_THRESHOLD    = 1.5;              // % — crypto-wide band
const STRESS_COOLDOWN_MS  = 60 * 1_000;       // 60 s per-symbol cooldown
const MAX_STRESS_EVENTS   = 20;
const CORR_LOOKBACK_HIGH  = 15 * 60 * 1_000;  // high_vol regime lookback
const CORR_LOOKBACK_NORM  = 60 * 60 * 1_000;  // normal regime lookback
const CORR_BUCKET_MS      = 60 * 1_000;        // 1-min price buckets for correlation

// ── Internal types ─────────────────────────────────────────────────────────────
interface PricePoint {
  time: number;
  price: number;
}

// ── Pure helpers ───────────────────────────────────────────────────────────────

/** Find the price point closest to `targetTime` within the history array. */
function findClosest(history: PricePoint[], targetTime: number): PricePoint | null {
  if (history.length === 0) return null;
  return history.reduce((best, point) =>
    Math.abs(point.time - targetTime) < Math.abs(best.time - targetTime) ? point : best
  );
}

/** Compute % return relative to reference point. Returns null if reference is missing. */
function computeReturn(history: PricePoint[], now: number, windowMs: number): number | null {
  if (history.length < 2) return null;
  const oldest = history[0];
  if (now - oldest.time < windowMs) return null; // not enough history yet
  const reference = findClosest(history, now - windowMs);
  if (!reference) return null;
  const current = history[history.length - 1].price;
  return ((current - reference.price) / reference.price) * 100;
}

/** Bucket a price history into 1-min bins, return last-price per bucket. */
function bucketByMinute(
  history: PricePoint[],
  startTime: number,
  endTime: number,
  bucketMs: number
): Map<number, number> {
  const buckets = new Map<number, number>();
  for (const point of history) {
    if (point.time < startTime || point.time > endTime) continue;
    const bucket = Math.floor(point.time / bucketMs) * bucketMs;
    buckets.set(bucket, point.price); // last price in bucket wins
  }
  return buckets;
}

/**
 * Compute 15-min volatility: std dev of 1-min log-returns over the window.
 * Returns null if fewer than 2 buckets are available.
 */
function computeVol15m(history: PricePoint[], now: number): number | null {
  const startTime = now - VOL_WINDOW_MS;
  const buckets = bucketByMinute(history, startTime, now, VOL_BUCKET_MS);
  const sortedKeys = Array.from(buckets.keys()).sort((a, b) => a - b);
  if (sortedKeys.length < 2) return null;

  const returns: number[] = [];
  for (let i = 1; i < sortedKeys.length; i++) {
    const prev = buckets.get(sortedKeys[i - 1])!;
    const curr = buckets.get(sortedKeys[i])!;
    if (prev > 0) returns.push(((curr - prev) / prev) * 100);
  }
  if (returns.length < 1) return null;

  const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length;
  return Math.sqrt(variance);
}

/**
 * Classify regime: high_vol if current vol15m exceeds the 80th percentile
 * of recent vol15m history; otherwise normal.
 */
function classifyRegime(vol15m: number | null, volHistory: number[]): Regime {
  if (vol15m === null || volHistory.length < 2) return 'loading';
  const sorted = [...volHistory].sort((a, b) => a - b);
  const idx = Math.floor((REGIME_PERCENTILE / 100) * sorted.length);
  const threshold = sorted[Math.min(idx, sorted.length - 1)];
  return vol15m >= threshold ? 'high_vol' : 'normal';
}

/** Pearson correlation between two equal-length arrays. */
function pearson(xs: number[], ys: number[]): number {
  if (xs.length !== ys.length || xs.length < 2) return 0;
  const n = xs.length;
  const meanX = xs.reduce((s, v) => s + v, 0) / n;
  const meanY = ys.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let denomX = 0;
  let denomY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }
  const denom = Math.sqrt(denomX * denomY);
  return denom === 0 ? 0 : num / denom;
}

// ── Hook ───────────────────────────────────────────────────────────────────────

interface UseMomentumResult {
  momentumRows: MomentumRow[];
  stressEvents: StressEvent[];
  computeCorrelations: (baseSymbol: string) => CorrelationResult[];
}

export function useMomentum(symbols: string[], prices: PriceMap): UseMomentumResult {
  // Rolling price history per symbol — stored in refs to avoid render thrashing
  const priceHistoryRef = useRef<Map<string, PricePoint[]>>(new Map());
  const vol15mHistoryRef = useRef<Map<string, number[]>>(new Map());
  const lastStressTimeRef = useRef<Map<string, number>>(new Map());
  // Track previous prices to detect changes
  const prevPricesRef = useRef<PriceMap>({});

  const [momentumRows, setMomentumRows] = useState<MomentumRow[]>([]);
  const [stressEvents, setStressEvents] = useState<StressEvent[]>([]);

  useEffect(() => {
    const now = Date.now();
    const priceHistory = priceHistoryRef.current;
    const vol15mHistory = vol15mHistoryRef.current;
    const lastStressTime = lastStressTimeRef.current;
    const prevPrices = prevPricesRef.current;

    let rowsChanged = false;
    const updatedRows: Map<string, MomentumRow> = new Map(
      momentumRows.map(r => [r.symbol, r])
    );
    const newStressEvents: StressEvent[] = [];

    for (const symbol of symbols) {
      const price = prices[symbol];
      if (price === undefined || isNaN(price)) continue;
      if (price === prevPrices[symbol]) continue; // no change, skip

      // 1. Append to rolling history and prune old points
      const history = priceHistory.get(symbol) ?? [];
      history.push({ time: now, price });
      const pruned = history.filter(p => now - p.time <= HISTORY_WINDOW_MS);
      priceHistory.set(symbol, pruned);

      // 2. Compute multi-timeframe returns
      const ret1m = computeReturn(pruned, now, RET_1M_WINDOW_MS);
      const ret5m = computeReturn(pruned, now, RET_5M_WINDOW_MS);

      // 3. Compute 15-min volatility
      const vol15m = computeVol15m(pruned, now);

      // 4. Update vol15m history and classify regime
      if (vol15m !== null) {
        const vh = vol15mHistory.get(symbol) ?? [];
        vh.push(vol15m);
        if (vh.length > REGIME_HISTORY_SIZE) vh.shift();
        vol15mHistory.set(symbol, vh);
      }
      const volHist = vol15mHistory.get(symbol) ?? [];
      const regime = classifyRegime(vol15m, volHist);

      // 5. Check for stress event
      if (ret1m !== null && Math.abs(ret1m) >= STRESS_THRESHOLD) {
        const lastTime = lastStressTime.get(symbol) ?? 0;
        if (now - lastTime >= STRESS_COOLDOWN_MS) {
          lastStressTime.set(symbol, now);
          newStressEvents.push({ symbol, price, ret1m, triggeredAt: now });
        }
      }

      updatedRows.set(symbol, { symbol, lastPrice: price, ret1m, ret5m, vol15m, regime });
      rowsChanged = true;
    }

    prevPricesRef.current = { ...prices };

    // Sort rows: |ret1m| desc, fallback to |ret5m|
    const sortedRows = Array.from(updatedRows.values()).sort((a, b) => {
      const absA = a.ret1m !== null ? Math.abs(a.ret1m) : (a.ret5m !== null ? Math.abs(a.ret5m) * 0.5 : -1);
      const absB = b.ret1m !== null ? Math.abs(b.ret1m) : (b.ret5m !== null ? Math.abs(b.ret5m) * 0.5 : -1);
      return absB - absA;
    });

    if (rowsChanged) {
      setMomentumRows(sortedRows);
    }

    if (newStressEvents.length > 0) {
      setStressEvents(prev => {
        const combined = [...newStressEvents, ...prev];
        return combined.slice(0, MAX_STRESS_EVENTS);
      });
    }
  }, [prices]); // prices is the only external input that drives history accumulation

  const computeCorrelations = useCallback((baseSymbol: string): CorrelationResult[] => {
    const priceHistory = priceHistoryRef.current;
    const baseHistory = priceHistory.get(baseSymbol);
    if (!baseHistory || baseHistory.length < 2) return [];

    // Determine lookback based on base symbol's regime
    const volHist = vol15mHistoryRef.current.get(baseSymbol) ?? [];
    const now = Date.now();
    const latestVol = computeVol15m(baseHistory, now);
    const regime = classifyRegime(latestVol, volHist);
    const lookbackMs = regime === 'high_vol' ? CORR_LOOKBACK_HIGH : CORR_LOOKBACK_NORM;
    const startTime = now - lookbackMs;

    const baseBuckets = bucketByMinute(baseHistory, startTime, now, CORR_BUCKET_MS);
    const baseTimes = Array.from(baseBuckets.keys()).sort((a, b) => a - b);
    if (baseTimes.length < 2) return [];

    const results: CorrelationResult[] = [];

    for (const symbol of Array.from(priceHistory.keys())) {
      if (symbol === baseSymbol) continue;
      const otherHistory = priceHistory.get(symbol);
      if (!otherHistory || otherHistory.length < 2) continue;

      const otherBuckets = bucketByMinute(otherHistory, startTime, now, CORR_BUCKET_MS);

      // Find time keys present in both
      const sharedTimes = baseTimes.filter(t => otherBuckets.has(t));
      if (sharedTimes.length < 3) continue;

      const baseValues = sharedTimes.map(t => baseBuckets.get(t)!);
      const otherValues = sharedTimes.map(t => otherBuckets.get(t)!);

      const correlation = pearson(baseValues, otherValues);
      results.push({ symbol, correlation });
    }

    return results.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
  }, []); // no deps — reads only refs

  return { momentumRows, stressEvents, computeCorrelations };
}
