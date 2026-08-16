import { mergeWatchlist, isUserAddedSymbol, baseAssetOf, filterByDeltaAvailability } from './watchlist';

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
