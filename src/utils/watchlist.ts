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
