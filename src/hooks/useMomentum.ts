import { useRef, useState, useEffect } from 'react';
import { PriceMap, VolumeMap, MomentumRow, StressEvent, Regime } from '../types';

// ── Constants (Market Pulse spec) ─────────────────────────────────────────────
const HISTORY_WINDOW_MS   = 60 * 60 * 1_000;  // keep 60 min of history
const RET_1M_WINDOW_MS    = 60 * 1_000;        // 1-min return lookback
const RET_5M_WINDOW_MS    = 5 * 60 * 1_000;    // 5-min return lookback
const RET_1H_WINDOW_MS    = 60 * 60 * 1_000;   // 1-hour return lookback
const VOL_WINDOW_MS       = 15 * 60 * 1_000;   // 15-min volatility window
const VOL_BUCKET_MS       = 60 * 1_000;        // 1-min buckets for vol computation
const REGIME_PERCENTILE   = 80;                // 80th-pct threshold
const REGIME_HISTORY_SIZE = 60;               // max vol15m readings per symbol
const STRESS_THRESHOLD    = 1.5;              // % — crypto-wide band
const STRESS_COOLDOWN_MS  = 60 * 1_000;       // 60 s per-symbol cooldown
const MAX_STRESS_EVENTS   = 20;

// ── Internal types ─────────────────────────────────────────────────────────────
interface PricePoint {
  time: number;
  price: number;
}

interface VolumePoint {
  time: number;
  volume: number;
}

// ── Pure helpers ───────────────────────────────────────────────────────────────

/**
 * Find the price point closest to `targetTime`.
 * History is always sorted ascending by time (append-only), so binary search is O(log n).
 */
function findClosest(history: PricePoint[], targetTime: number): PricePoint | null {
  if (history.length === 0) return null;
  let lo = 0;
  let hi = history.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (history[mid].time < targetTime) lo = mid + 1;
    else hi = mid;
  }
  if (lo === 0) return history[0];
  const before = history[lo - 1];
  const after = history[lo];
  return Math.abs(after.time - targetTime) < Math.abs(before.time - targetTime) ? after : before;
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
 * Compute USDT volume added within windowMs by diffing the rolling 24h volume snapshots.
 * Clamps to 0 to handle rare cases where old trades roll off the 24h window.
 */
function computeVolAdded(history: VolumePoint[], now: number, windowMs: number): number | null {
  if (history.length < 2) return null;
  const oldest = history[0];
  if (now - oldest.time < windowMs) return null;
  const reference = (() => {
    const target = now - windowMs;
    let lo = 0;
    let hi = history.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (history[mid].time < target) lo = mid + 1;
      else hi = mid;
    }
    if (lo === 0) return history[0];
    const before = history[lo - 1];
    const after = history[lo];
    return Math.abs(after.time - target) < Math.abs(before.time - target) ? after : before;
  })();
  const current = history[history.length - 1].volume;
  return Math.max(0, current - reference.volume);
}

/**
 * Classify regime: high_vol if current vol15m exceeds the 80th percentile
 * of recent vol15m history; otherwise normal.
 * Expects volHistory to already be sorted ascending (maintained on insert).
 */
function classifyRegime(vol15m: number | null, volHistory: number[]): Regime {
  if (vol15m === null || volHistory.length < 2) return 'loading';
  const idx = Math.floor((REGIME_PERCENTILE / 100) * volHistory.length);
  const threshold = volHistory[Math.min(idx, volHistory.length - 1)];
  return vol15m >= threshold ? 'high_vol' : 'normal';
}

// ── Hook ───────────────────────────────────────────────────────────────────────

interface UseMomentumResult {
  momentumRows: MomentumRow[];
  stressEvents: StressEvent[];
}

export function useMomentum(symbols: string[], prices: PriceMap, volumes: VolumeMap): UseMomentumResult {
  // Rolling price history per symbol — stored in refs to avoid render thrashing
  const priceHistoryRef = useRef<Map<string, PricePoint[]>>(new Map());
  const volumeHistoryRef = useRef<Map<string, VolumePoint[]>>(new Map());
  const vol15mHistoryRef = useRef<Map<string, number[]>>(new Map());
  const lastStressTimeRef = useRef<Map<string, number>>(new Map());
  // Track previous prices to detect changes
  const prevPricesRef = useRef<PriceMap>({});
  // Keep volumes accessible inside the prices effect without adding to its dependency array
  const volumesRef = useRef<VolumeMap>(volumes);
  // Throttle the computation pass to at most 1Hz — WebSocket ticks can arrive
  // several times per second but momentum metrics don't need sub-second resolution.
  const lastRunRef = useRef<number>(0);

  const [momentumRows, setMomentumRows] = useState<MomentumRow[]>([]);
  const [stressEvents, setStressEvents] = useState<StressEvent[]>([]);

  // Keep volumesRef current on every render without triggering the price effect
  useEffect(() => { volumesRef.current = volumes; }, [volumes]);

  useEffect(() => {
    const now = Date.now();
    if (now - lastRunRef.current < 1_000) return;
    lastRunRef.current = now;
    const priceHistory = priceHistoryRef.current;
    const volumeHistory = volumeHistoryRef.current;
    const vol15mHistory = vol15mHistoryRef.current;
    const lastStressTime = lastStressTimeRef.current;
    const prevPrices = prevPricesRef.current;
    const currentVolumes = volumesRef.current;

    let rowsChanged = false;
    const updatedRows: Map<string, MomentumRow> = new Map(
      momentumRows.map(r => [r.symbol, r])
    );
    const newStressEvents: StressEvent[] = [];

    for (const symbol of symbols) {
      const price = prices[symbol];
      if (price === undefined || isNaN(price)) continue;
      if (price === prevPrices[symbol]) continue; // no change, skip

      // 1. Append to rolling price history and prune expired points from the front.
      const history = priceHistory.get(symbol) ?? [];
      history.push({ time: now, price });
      while (history.length > 1 && now - history[0].time > HISTORY_WINDOW_MS) {
        history.shift();
      }
      priceHistory.set(symbol, history);

      // 1b. Append to rolling volume history (same window)
      const vol = currentVolumes[symbol];
      if (vol !== undefined && !isNaN(vol)) {
        const volHist = volumeHistory.get(symbol) ?? [];
        volHist.push({ time: now, volume: vol });
        while (volHist.length > 1 && now - volHist[0].time > HISTORY_WINDOW_MS) {
          volHist.shift();
        }
        volumeHistory.set(symbol, volHist);
      }

      // 2. Compute multi-timeframe returns
      const ret1m = computeReturn(history, now, RET_1M_WINDOW_MS);
      const ret5m = computeReturn(history, now, RET_5M_WINDOW_MS);
      const ret1h = computeReturn(history, now, RET_1H_WINDOW_MS);

      // 3. Compute 15-min volatility
      const vol15m = computeVol15m(history, now);

      // 4. Update vol15m history (kept sorted ascending via insertion) and classify regime.
      //    Maintaining sorted order here means classifyRegime never needs to sort.
      if (vol15m !== null) {
        const vh = vol15mHistory.get(symbol) ?? [];
        const insertIdx = vh.findIndex(v => v >= vol15m);
        if (insertIdx === -1) vh.push(vol15m);
        else vh.splice(insertIdx, 0, vol15m);
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

      const symVolHist = volumeHistory.get(symbol) ?? [];
      const volAdded1m = computeVolAdded(symVolHist, now, RET_1M_WINDOW_MS);
      const volAdded5m = computeVolAdded(symVolHist, now, RET_5M_WINDOW_MS);
      const volAdded1h = computeVolAdded(symVolHist, now, RET_1H_WINDOW_MS);

      updatedRows.set(symbol, { symbol, lastPrice: price, ret1m, ret5m, ret1h, vol15m, regime, volAdded1m, volAdded5m, volAdded1h });
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

  return { momentumRows, stressEvents };
}
