import { mergeWatchlist, isUserAddedSymbol } from './watchlist';

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
