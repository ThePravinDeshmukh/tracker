import {
  checkPriceMomentum,
  checkVolumeSpike,
  pruneOldPriceHistory,
  PRICE_WINDOW_MS,
  MAX_PRICE_HISTORY_MS,
} from './watcherSignals';

const NOW = 1_000_000_000_000; // fixed reference timestamp

describe('checkPriceMomentum', () => {
  it('returns false when history is empty', () => {
    expect(checkPriceMomentum([], NOW).met).toBe(false);
  });

  it('returns false when history is shorter than 5 minutes', () => {
    const history = [
      { price: 100, timestamp: NOW - 4 * 60 * 1000 },
      { price: 103, timestamp: NOW },
    ];
    expect(checkPriceMomentum(history, NOW).met).toBe(false);
  });

  it('returns true when price is up >= 2% over 5 minutes', () => {
    const history = [
      { price: 100, timestamp: NOW - 6 * 60 * 1000 },
      { price: 100, timestamp: NOW - 5 * 60 * 1000 },
      { price: 103, timestamp: NOW },
    ];
    const result = checkPriceMomentum(history, NOW);
    expect(result.met).toBe(true);
    expect(result.changePct).toBeCloseTo(3, 1);
  });

  it('returns false when price is up < 2% over 5 minutes', () => {
    const history = [
      { price: 100, timestamp: NOW - 6 * 60 * 1000 },
      { price: 100, timestamp: NOW - 5 * 60 * 1000 },
      { price: 101, timestamp: NOW },
    ];
    expect(checkPriceMomentum(history, NOW).met).toBe(false);
  });

  it('returns false when price is flat', () => {
    const history = [
      { price: 100, timestamp: NOW - 6 * 60 * 1000 },
      { price: 100, timestamp: NOW - 5 * 60 * 1000 },
      { price: 100, timestamp: NOW },
    ];
    expect(checkPriceMomentum(history, NOW).met).toBe(false);
  });
});

describe('checkVolumeSpike', () => {
  it('returns false when fewer than 3 readings', () => {
    expect(checkVolumeSpike([100, 200]).met).toBe(false);
  });

  it('returns true when current volume is >= 1.5x average of previous', () => {
    // previous avg = (100 + 100 + 100) / 3 = 100; current = 160 → ratio = 1.6
    const result = checkVolumeSpike([100, 100, 100, 160]);
    expect(result.met).toBe(true);
    expect(result.ratio).toBeCloseTo(1.6, 1);
  });

  it('returns false when current volume is below 1.5x average', () => {
    // previous avg = 100; current = 140 → ratio = 1.4
    expect(checkVolumeSpike([100, 100, 100, 140]).met).toBe(false);
  });

  it('returns false when average is zero', () => {
    expect(checkVolumeSpike([0, 0, 0, 200]).met).toBe(false);
  });
});

describe('pruneOldPriceHistory', () => {
  it('removes points older than 10 minutes', () => {
    const history = [
      { price: 100, timestamp: NOW - MAX_PRICE_HISTORY_MS - 1 },
      { price: 101, timestamp: NOW - MAX_PRICE_HISTORY_MS + 1 },
      { price: 102, timestamp: NOW },
    ];
    const pruned = pruneOldPriceHistory(history, NOW);
    expect(pruned).toHaveLength(2);
    expect(pruned[0].price).toBe(101);
  });

  it('keeps all points within 10 minutes', () => {
    const history = [
      { price: 100, timestamp: NOW - 9 * 60 * 1000 },
      { price: 101, timestamp: NOW },
    ];
    expect(pruneOldPriceHistory(history, NOW)).toHaveLength(2);
  });
});
