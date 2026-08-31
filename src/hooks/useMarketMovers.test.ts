import { deriveMarketMovers } from './useMarketMovers';

describe('deriveMarketMovers', () => {
  const tickers = [
    { symbol: 'BTCUSDT', lastPrice: '60000', priceChangePercent: '2.5', quoteVolume: '500000000' },
    { symbol: 'ETHUSDT', lastPrice: '3000', priceChangePercent: '-4.1', quoteVolume: '900000000' },
    { symbol: 'SOLUSDT', lastPrice: '150', priceChangePercent: '8.2', quoteVolume: '100000000' },
    { symbol: 'PEPEUSDT', lastPrice: '0.00001', priceChangePercent: '-12.3', quoteVolume: '50000000' },
    { symbol: 'BTCBUSD', lastPrice: '60000', priceChangePercent: '2.5', quoteVolume: '999999999' },
  ];

  it('excludes non-USDT pairs from every list', () => {
    const { topByVolume, topGainers, topLosers } = deriveMarketMovers(tickers);
    for (const mover of [...topByVolume, ...topGainers, ...topLosers]) {
      expect(mover.symbol.endsWith('USDT')).toBe(true);
    }
  });

  it('ranks topByVolume by quote volume descending', () => {
    const { topByVolume } = deriveMarketMovers(tickers);
    expect(topByVolume.map(m => m.symbol)).toEqual(['ETHUSDT', 'BTCUSDT', 'SOLUSDT', 'PEPEUSDT']);
  });

  it('ranks topGainers by price change percent descending', () => {
    const { topGainers } = deriveMarketMovers(tickers);
    expect(topGainers.map(m => m.symbol)).toEqual(['SOLUSDT', 'BTCUSDT', 'ETHUSDT', 'PEPEUSDT']);
  });

  it('ranks topLosers by price change percent ascending', () => {
    const { topLosers } = deriveMarketMovers(tickers);
    expect(topLosers.map(m => m.symbol)).toEqual(['PEPEUSDT', 'ETHUSDT', 'BTCUSDT', 'SOLUSDT']);
  });

  it('parses numeric fields from strings', () => {
    const { topGainers } = deriveMarketMovers(tickers);
    const sol = topGainers.find(m => m.symbol === 'SOLUSDT')!;
    expect(sol.price).toBe(150);
    expect(sol.priceChangePct).toBe(8.2);
    expect(sol.quoteVolume).toBe(100000000);
  });

  it('caps topByVolume at 20 and gainers/losers at 10', () => {
    const manyTickers = Array.from({ length: 30 }, (_, i) => ({
      symbol: `COIN${i}USDT`,
      lastPrice: '1',
      priceChangePercent: `${i}`,
      quoteVolume: `${i}`,
    }));
    const { topByVolume, topGainers, topLosers } = deriveMarketMovers(manyTickers);
    expect(topByVolume.length).toBe(20);
    expect(topGainers.length).toBe(10);
    expect(topLosers.length).toBe(10);
  });
});
