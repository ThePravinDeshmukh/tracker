import { isValidTimeframe } from './useChartTimeframe';

describe('isValidTimeframe', () => {
  it('accepts every supported candle interval', () => {
    ['1s', '1m', '5m', '15m', '30m', '1h', '4h', '1d'].forEach(interval => {
      expect(isValidTimeframe(interval)).toBe(true);
    });
  });

  it('rejects an unsupported interval string', () => {
    expect(isValidTimeframe('2h')).toBe(false);
  });

  it('rejects non-string values', () => {
    expect(isValidTimeframe(null)).toBe(false);
    expect(isValidTimeframe(undefined)).toBe(false);
    expect(isValidTimeframe(42)).toBe(false);
  });
});
