import { candleColorOptions, CANDLE_UP_COLOR, CANDLE_DOWN_COLOR } from './candleStyle';

describe('candleColorOptions', () => {
  it('paints bodies, borders and wicks with the up/down palette when shown', () => {
    expect(candleColorOptions('shown')).toEqual({
      upColor: CANDLE_UP_COLOR,
      downColor: CANDLE_DOWN_COLOR,
      borderUpColor: CANDLE_UP_COLOR,
      borderDownColor: CANDLE_DOWN_COLOR,
      wickUpColor: CANDLE_UP_COLOR,
      wickDownColor: CANDLE_DOWN_COLOR,
    });
  });

  it('paints every candle part transparent when hidden', () => {
    const hidden = candleColorOptions('hidden');
    expect(Object.values(hidden).every(color => color === 'rgba(0,0,0,0)')).toBe(true);
  });

  it('covers the same option keys in both states so toggling never leaves a stale color', () => {
    expect(Object.keys(candleColorOptions('hidden')).sort()).toEqual(
      Object.keys(candleColorOptions('shown')).sort()
    );
  });
});
