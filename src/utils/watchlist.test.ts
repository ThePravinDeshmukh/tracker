import { mergeWatchlist, isUserAddedSymbol, baseAssetOf, filterByDeltaAvailability, sortWatchlistSymbols } from './watchlist';

describe('mergeWatchlist', () => {
  it('returns default symbols when the user has added nothing', () => {
    expect(mergeWatchlist(['BTCUSDT', 'ETHUSDT'], [])).toEqual(['BTCUSDT', 'ETHUSDT']);
  });

  it('appends user-added symbols that are not already in the defaults', () => {
    expect(mergeWatchlist(['BTCUSDT', 'ETHUSDT'], ['PEPEUSDT'])).toEqual([
      'BTCUSDT', 'ETHUSDT', 'PEPEUSDT',
    ]);
  });

  it('does not duplicate a user-added symbol that is already a default', () => {
    expect(mergeWatchlist(['BTCUSDT', 'ETHUSDT'], ['ETHUSDT'])).toEqual([
      'BTCUSDT', 'ETHUSDT',
    ]);
  });

  it('keeps defaults first, followed by user additions in the order they were added', () => {
    expect(mergeWatchlist(['BTCUSDT'], ['PEPEUSDT', 'WIFUSDT'])).toEqual([
      'BTCUSDT', 'PEPEUSDT', 'WIFUSDT',
    ]);
  });

  it('handles an empty default list', () => {
    expect(mergeWatchlist([], ['PEPEUSDT'])).toEqual(['PEPEUSDT']);
  });
});

describe('isUserAddedSymbol', () => {
  it('returns true when the symbol is in the user-added list', () => {
    expect(isUserAddedSymbol('PEPEUSDT', ['PEPEUSDT'])).toBe(true);
  });

  it('returns false when the symbol is not in the user-added list', () => {
    expect(isUserAddedSymbol('BTCUSDT', ['PEPEUSDT'])).toBe(false);
  });
});

describe('baseAssetOf', () => {
  it('strips the USDT suffix', () => {
    expect(baseAssetOf('BTCUSDT')).toBe('BTC');
  });

  it('leaves a symbol without a USDT suffix unchanged', () => {
    expect(baseAssetOf('BTC')).toBe('BTC');
  });
});

describe('filterByDeltaAvailability', () => {
  it('returns symbols unchanged while the Delta asset list is unknown', () => {
    expect(filterByDeltaAvailability(['BTCUSDT', 'PEPEUSDT'], null)).toEqual([
      'BTCUSDT', 'PEPEUSDT',
    ]);
  });

  it('keeps only symbols whose base asset trades on Delta Exchange India', () => {
    expect(filterByDeltaAvailability(['BTCUSDT', 'PEPEUSDT', 'ETHUSDT'], ['BTC', 'ETH'])).toEqual([
      'BTCUSDT', 'ETHUSDT',
    ]);
  });

  it('returns an empty array when nothing matches', () => {
    expect(filterByDeltaAvailability(['PEPEUSDT'], ['BTC', 'ETH'])).toEqual([]);
  });
});

describe('sortWatchlistSymbols', () => {
  const symbols = ['ETHUSDT', 'BTCUSDT', 'SOLUSDT'];
  const marketData = {
    prices:    { BTCUSDT: 60000, ETHUSDT: 3000, SOLUSDT: 150 },
    change24h: { BTCUSDT: 1, ETHUSDT: -2, SOLUSDT: 5 },
    volumes:   { BTCUSDT: 500, ETHUSDT: 900 },
  };

  it('sorts by volume descending, treating missing volume as zero', () => {
    expect(sortWatchlistSymbols(symbols, 'volume', marketData)).toEqual(['ETHUSDT', 'BTCUSDT', 'SOLUSDT']);
  });

  it('sorts by price descending', () => {
    expect(sortWatchlistSymbols(symbols, 'price', marketData)).toEqual(['BTCUSDT', 'ETHUSDT', 'SOLUSDT']);
  });

  it('sorts by 24h change descending', () => {
    expect(sortWatchlistSymbols(symbols, 'change', marketData)).toEqual(['SOLUSDT', 'BTCUSDT', 'ETHUSDT']);
  });

  it('sorts by name alphabetically', () => {
    expect(sortWatchlistSymbols(symbols, 'name', marketData)).toEqual(['BTCUSDT', 'ETHUSDT', 'SOLUSDT']);
  });

  it('does not mutate the input array', () => {
    const input = [...symbols];
    sortWatchlistSymbols(input, 'name', marketData);
    expect(input).toEqual(symbols);
  });
});
