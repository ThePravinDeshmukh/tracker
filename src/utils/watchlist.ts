// Combines the default top-volume coins with coins the user explicitly added,
// keeping defaults first and appending only the user's coins that aren't already defaults.
export function mergeWatchlist(defaultSymbols: string[], userAddedSymbols: string[]): string[] {
  const extraSymbols = userAddedSymbols.filter(symbol => !defaultSymbols.includes(symbol));
  return [...defaultSymbols, ...extraSymbols];
}

export function isUserAddedSymbol(symbol: string, userAddedSymbols: string[]): boolean {
  return userAddedSymbols.includes(symbol);
}
