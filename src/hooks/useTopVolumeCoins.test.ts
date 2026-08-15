import { selectTopVolumeSymbols } from './useTopVolumeCoins';

describe('selectTopVolumeSymbols', () => {
  it('sorts USDT pairs by quote volume descending and takes the top N', () => {
    const tickers = [
      { symbol: 'BTCUSDT', quoteVolume: '500000000' },
      { symbol: 'ETHUSDT', quoteVolume: '900000000' },
      { symbol: 'SOLUSDT', quoteVolume: '100000000' },
    ];
    expect(selectTopVolumeSymbols(tickers, 2)).toEqual(['ETHUSDT', 'BTCUSDT']);
  });

  it('excludes non-USDT pairs', () => {
    const tickers = [
      { symbol: 'BTCUSDT', quoteVolume: '500000000' },
      { symbol: 'BTCBUSD', quoteVolume: '900000000' },
    ];
    expect(selectTopVolumeSymbols(tickers, 5)).toEqual(['BTCUSDT']);
  });

  it('returns fewer than count when not enough pairs exist', () => {
    const tickers = [{ symbol: 'BTCUSDT', quoteVolume: '500000000' }];
    expect(selectTopVolumeSymbols(tickers, 10)).toEqual(['BTCUSDT']);
  });
});
