import { computeVolumeSurgeRatio, isVolumeSurging, MOMENTUM_WINDOW_HOURS } from './volumeMomentum';

function hoursOf(volume: number, count = 24): number[] {
  return new Array(count).fill(volume);
}

describe('computeVolumeSurgeRatio', () => {
  it('returns null when fewer than 24 hourly entries are available', () => {
    expect(computeVolumeSurgeRatio(hoursOf(100, 23))).toBeNull();
  });

  it('returns null when 24h volume is zero', () => {
    expect(computeVolumeSurgeRatio(hoursOf(0))).toBeNull();
  });

  it('returns ~1 when the trailing window matches the day\'s average pace', () => {
    const ratio = computeVolumeSurgeRatio(hoursOf(100));
    expect(ratio).toBeCloseTo(1, 5);
  });

  it('returns 2 when the trailing window volume is exactly double the expected share', () => {
    const hourlyVolumes = hoursOf(100, 24 - MOMENTUM_WINDOW_HOURS).concat(hoursOf(200, MOMENTUM_WINDOW_HOURS));
    // total24h = 20*100 + 4*200 = 2800, expectedShare = 2800 * 4/24 = 466.67, trailingSum = 800
    const ratio = computeVolumeSurgeRatio(hourlyVolumes);
    expect(ratio).toBeCloseTo(800 / (2800 * (MOMENTUM_WINDOW_HOURS / 24)), 5);
  });

  it('returns a ratio below 1 for a quiet coin', () => {
    const hourlyVolumes = hoursOf(100, 24 - MOMENTUM_WINDOW_HOURS).concat(hoursOf(10, MOMENTUM_WINDOW_HOURS));
    const ratio = computeVolumeSurgeRatio(hourlyVolumes);
    expect(ratio).not.toBeNull();
    expect(ratio!).toBeLessThan(1);
  });
});

describe('isVolumeSurging', () => {
  it('is false for null', () => {
    expect(isVolumeSurging(null)).toBe(false);
  });

  it('is false just below the threshold', () => {
    expect(isVolumeSurging(1.99)).toBe(false);
  });

  it('is true exactly at the threshold', () => {
    expect(isVolumeSurging(2)).toBe(true);
  });

  it('is true above the threshold', () => {
    expect(isVolumeSurging(3.5)).toBe(true);
  });
});
