export const MOMENTUM_WINDOW_HOURS = 4;
export const MOMENTUM_SURGE_THRESHOLD = 2; // "doubled" vs. the day's average pace
const HOURS_PER_DAY = 24;

// hourlyVolumes: quote-asset volume per hour, ordered oldest -> newest.
// Returns null when there isn't enough history (new listing) or the coin has no volume.
export function computeVolumeSurgeRatio(hourlyVolumes: number[]): number | null {
  if (hourlyVolumes.length < HOURS_PER_DAY) return null;

  const total24h = hourlyVolumes.reduce((sum, volume) => sum + volume, 0);
  if (total24h <= 0) return null;

  const trailingWindow = hourlyVolumes.slice(-MOMENTUM_WINDOW_HOURS);
  const trailingSum = trailingWindow.reduce((sum, volume) => sum + volume, 0);
  const expectedShare = total24h * (MOMENTUM_WINDOW_HOURS / HOURS_PER_DAY);

  return trailingSum / expectedShare;
}

export function isVolumeSurging(ratio: number | null): ratio is number {
  return ratio !== null && ratio >= MOMENTUM_SURGE_THRESHOLD;
}
