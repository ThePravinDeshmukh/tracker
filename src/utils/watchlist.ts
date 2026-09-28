import { PriceMap, WatchlistSortKey } from '../types';

// Combines the default top-volume coins with coins the user explicitly added,
// keeping defaults first and appending only the user's coins that aren't already defaults.
export function mergeWatchlist(defaultSymbols: string[], userAddedSymbols: string[]): string[] {
  const extraSymbols = userAddedSymbols.filter(symbol => !defaultSymbols.includes(symbol));
  return [...defaultSymbols, ...extraSymbols];
}

export function isUserAddedSymbol(symbol: string, userAddedSymbols: string[]): boolean {
  return userAddedSymbols.includes(symbol);
}

export function baseAssetOf(symbol: string): string {
  return symbol.replace(/USDT$/, '');
}

// deltaTradableAssets is null while the Delta Exchange India product list hasn't loaded yet
// (or failed to load) — symbols pass through unfiltered in that case rather than being hidden.
export function filterByDeltaAvailability(symbols: string[], deltaTradableAssets: string[] | null): string[] {
  if (deltaTradableAssets === null) return symbols;
  const allowed = new Set(deltaTradableAssets);
  return symbols.filter(symbol => allowed.has(baseAssetOf(symbol)));
}

export interface WatchlistMarketData {
  prices: PriceMap;
  change24h: PriceMap;
  volumes: PriceMap;
}

// Numeric sorts are descending; a symbol whose data has not streamed in yet counts as zero.
export function sortWatchlistSymbols(symbols: string[], sortBy: WatchlistSortKey, marketData: WatchlistMarketData): string[] {
  const { prices, change24h, volumes } = marketData;
  return [...symbols].sort((a, b) => {
    if (sortBy === 'volume') return (volumes[b] ?? 0) - (volumes[a] ?? 0);
    if (sortBy === 'price')  return (prices[b] ?? 0) - (prices[a] ?? 0);
    if (sortBy === 'change') return (change24h[b] ?? 0) - (change24h[a] ?? 0);
    return a.localeCompare(b);
  });
}
