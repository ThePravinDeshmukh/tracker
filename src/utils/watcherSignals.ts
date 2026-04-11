export interface PricePoint {
  price: number;
  timestamp: number; // unix ms
}

export const PRICE_WINDOW_MS = 5 * 60 * 1000;      // 5 minutes
export const MAX_PRICE_HISTORY_MS = 10 * 60 * 1000; // 10 minutes
export const MAX_VOLUME_READINGS = 10;
export const MIN_PRICE_CHANGE_PCT = 2.0;
export const VOLUME_SPIKE_RATIO = 1.5;
export const MIN_VOLUME_READINGS = 3;

/**
 * Returns true when price has risen >= 2% compared to the price from ~5 minutes ago.
 * Returns false if there is less than 5 minutes of history.
 */
export function checkPriceMomentum(
  history: PricePoint[],
  now: number
): { met: boolean; changePct: number } {
  if (history.length < 2) return { met: false, changePct: 0 };
  const oldest = history[0];
  if (now - oldest.timestamp < PRICE_WINDOW_MS) return { met: false, changePct: 0 };

  const targetTime = now - PRICE_WINDOW_MS;
  const reference = history.reduce((best, point) =>
    Math.abs(point.timestamp - targetTime) < Math.abs(best.timestamp - targetTime) ? point : best
  );

  const current = history[history.length - 1].price;
  const changePct = ((current - reference.price) / reference.price) * 100;
  return { met: changePct >= MIN_PRICE_CHANGE_PCT, changePct };
}

/**
 * Returns true when the last volume reading is >= 1.5x the average of the previous readings.
 * history[history.length - 1] is the current reading.
 * Returns false if fewer than MIN_VOLUME_READINGS entries exist.
 */
export function checkVolumeSpike(
  history: number[]
): { met: boolean; ratio: number } {
  if (history.length < MIN_VOLUME_READINGS) return { met: false, ratio: 0 };
  const previous = history.slice(0, -1);
  const avg = previous.reduce((sum, v) => sum + v, 0) / previous.length;
  if (avg === 0) return { met: false, ratio: 0 };
  const current = history[history.length - 1];
  const ratio = current / avg;
  return { met: ratio >= VOLUME_SPIKE_RATIO, ratio };
}

/** Removes price points older than MAX_PRICE_HISTORY_MS. */
export function pruneOldPriceHistory(history: PricePoint[], now: number): PricePoint[] {
  const cutoff = now - MAX_PRICE_HISTORY_MS;
  return history.filter(p => p.timestamp >= cutoff);
}
