import { useState, useEffect } from 'react';

const DELTA_INDIA_PRODUCTS_URL = 'https://api.india.delta.exchange/v2/products?states=live';
const REFRESH_INTERVAL_MS = 30 * 60_000;

interface DeltaProduct {
  underlying_asset?: { symbol?: string };
}

interface DeltaProductsResponse {
  result?: DeltaProduct[];
}

export function extractUnderlyingAssets(products: DeltaProduct[]): string[] {
  const assetSymbols = products
    .map(product => product.underlying_asset?.symbol)
    .filter((symbol): symbol is string => Boolean(symbol));
  return Array.from(new Set(assetSymbols));
}

async function fetchDeltaTradableAssets(): Promise<string[]> {
  const res = await fetch(DELTA_INDIA_PRODUCTS_URL);
  if (!res.ok) throw new Error(`Failed to fetch Delta Exchange India products: ${res.status}`);
  const data = await res.json() as DeltaProductsResponse;
  return extractUnderlyingAssets(data.result ?? []);
}

export interface UseDeltaExchangeAssetsResult {
  // null while the product list hasn't loaded yet (or failed to load) — callers should
  // treat null as "unknown" and skip filtering rather than hiding everything.
  deltaTradableAssets: string[] | null;
  loading: boolean;
}

export function useDeltaExchangeAssets(): UseDeltaExchangeAssetsResult {
  const [deltaTradableAssets, setDeltaTradableAssets] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    function load(): void {
      fetchDeltaTradableAssets()
        .then(assets => { if (!cancelled) setDeltaTradableAssets(assets); })
        .catch(() => {})
        .finally(() => { if (!cancelled) setLoading(false); });
    }

    load();
    const intervalId = setInterval(load, REFRESH_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(intervalId); };
  }, []);

  return { deltaTradableAssets, loading };
}
