import { extractUnderlyingAssets } from './useDeltaExchangeAssets';

describe('extractUnderlyingAssets', () => {
  it('extracts the underlying asset symbol from each product', () => {
    const products = [
      { underlying_asset: { symbol: 'BTC' } },
      { underlying_asset: { symbol: 'ETH' } },
    ];
    expect(extractUnderlyingAssets(products)).toEqual(['BTC', 'ETH']);
  });

  it('dedupes assets that appear across multiple products (e.g. futures + options)', () => {
    const products = [
      { underlying_asset: { symbol: 'BTC' } },
      { underlying_asset: { symbol: 'BTC' } },
      { underlying_asset: { symbol: 'ETH' } },
    ];
    expect(extractUnderlyingAssets(products)).toEqual(['BTC', 'ETH']);
  });

  it('skips products with a missing underlying asset', () => {
    const products = [
      { underlying_asset: { symbol: 'BTC' } },
      {},
      { underlying_asset: {} },
    ];
    expect(extractUnderlyingAssets(products)).toEqual(['BTC']);
  });
});
