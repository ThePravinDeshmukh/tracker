import { useState, useEffect, useMemo } from 'react';
import { PriceMap, VolumeMap } from '../types';
import { useAvailablePairs } from './useAvailablePairs';

// Fallback set used before dynamic pair data has loaded
const FALLBACK_FUTURES_ONLY = new Set<string>(['DUSK', 'HANA']);

const SPOT_WS_URL = 'wss://stream.binance.com:9443/stream';
const FUTURES_WS_URL = 'wss://fstream.binance.com/stream';
const SPOT_REST_URL = 'https://api.binance.com/api/v3/ticker/price';
const FUTURES_REST_URL = 'https://fapi.binance.com/fapi/v1/ticker/price';

function toUsdtPair(symbol: string): string {
  return `${symbol.toUpperCase()}USDT`;
}

function buildStreamUrl(baseWsUrl: string, pairs: string[]): string {
  const streams = pairs.map(p => `${p.toLowerCase()}@ticker`).join('/');
  return `${baseWsUrl}?streams=${streams}`;
}

interface UseCryptoPricesResult {
  prices: PriceMap;
  prevPrices: PriceMap;
  volumes: VolumeMap;
}

type OnTick = (symbol: string, price: number, volume: number) => void;

function openTickerStream(
  url: string,
  onTick: OnTick,
  onError: () => void
): WebSocket {
  const ws = new WebSocket(url);
  ws.onmessage = (event: MessageEvent) => {
    try {
      const { data } = JSON.parse(event.data as string);
      if (!data?.s || !data?.c) return;
      const symbol = (data.s as string).replace(/USDT$/, '');
      const price = parseFloat(data.c as string);
      const volume = parseFloat(data.q as string); // 24h quote asset volume in USDT
      onTick(symbol, price, volume);
    } catch {}
  };
  ws.onerror = onError;
  return ws;
}

async function fetchPricesFallback(
  symbols: string[],
  baseUrl: string,
  setPrices: React.Dispatch<React.SetStateAction<PriceMap>>
): Promise<void> {
  try {
    const results = await Promise.all(
      symbols.map(async symbol => {
        const res = await fetch(`${baseUrl}?symbol=${toUsdtPair(symbol)}`);
        const data = await res.json() as { price: string };
        return { symbol, price: parseFloat(data.price) };
      })
    );
    const priceMap: PriceMap = {};
    results.forEach(r => { priceMap[r.symbol] = r.price; });
    setPrices(prev => ({ ...prev, ...priceMap }));
  } catch {}
}

export function useCryptoPrices(symbols: string[]): UseCryptoPricesResult {
  const [prices, setPrices] = useState<PriceMap>({});
  const [prevPrices, setPrevPrices] = useState<PriceMap>({});
  const [volumes, setVolumes] = useState<VolumeMap>({});
  const { spotSymbols: availableSpot, futuresSymbols: availableFutures } = useAvailablePairs();

  // Determine which portfolio symbols are futures-only.
  // Before dynamic data arrives, fall back to a small hardcoded set.
  const futuresOnlySet = useMemo(() => {
    if (availableSpot.length === 0 && availableFutures.length === 0) {
      return FALLBACK_FUTURES_ONLY;
    }
    const spotSet = new Set(availableSpot);
    return new Set(availableFutures.filter(s => !spotSet.has(s)));
  }, [availableSpot, availableFutures]);

  const futuresKey = useMemo(
    () => Array.from(futuresOnlySet).sort().join(','),
    [futuresOnlySet]
  );

  const applyTick = (symbol: string, price: number, volume: number): void => {
    setPrices(prev => {
      setPrevPrices(pp => ({ ...pp, [symbol]: prev[symbol] }));
      return { ...prev, [symbol]: price };
    });
    if (!isNaN(volume)) setVolumes(prev => ({ ...prev, [symbol]: volume }));
  };

  useEffect(() => {
    if (!symbols || symbols.length === 0) return;

    const upper = symbols.map(s => s.toUpperCase());
    const spotSymbols = upper.filter(s => !futuresOnlySet.has(s));
    const futuresSymbols = upper.filter(s => futuresOnlySet.has(s));

    const connections: WebSocket[] = [];

    if (spotSymbols.length > 0) {
      const spotPairs = spotSymbols.map(toUsdtPair);
      const ws = openTickerStream(
        buildStreamUrl(SPOT_WS_URL, spotPairs),
        applyTick,
        () => fetchPricesFallback(spotSymbols, SPOT_REST_URL, setPrices)
      );
      connections.push(ws);
    }

    if (futuresSymbols.length > 0) {
      const futuresPairs = futuresSymbols.map(toUsdtPair);
      const ws = openTickerStream(
        buildStreamUrl(FUTURES_WS_URL, futuresPairs),
        applyTick,
        () => fetchPricesFallback(futuresSymbols, FUTURES_REST_URL, setPrices)
      );
      connections.push(ws);
    }

    return () => connections.forEach(ws => ws.close());
  }, [symbols.join(','), futuresKey]); // eslint-disable-line

  return { prices, prevPrices, volumes };
}

export function getCoinIcon(symbol: string): string {
  const map: Record<string, string> = {
    BTC: '₿', ETH: 'Ξ', SOL: '◎', BNB: 'B', XRP: 'X', ADA: '₳',
    AVAX: 'A', DOT: '●', MATIC: 'M', LINK: '⬡', LTC: 'Ł', UNI: 'U',
    ATOM: '⚛', DOGE: 'Ð', SUI: 'S', APT: 'A', OP: 'O', ARB: 'Ā',
    NEAR: 'N', ICP: 'I', SHIB: 'S', TRX: 'T', TON: '💎', HBAR: 'H',
    VET: 'V', ALGO: 'A', AAVE: 'A', FIL: 'F', THETA: 'Θ', XLM: '*',
    EOS: 'E', MKR: 'M', GRT: 'G', PEPE: '🐸', JUP: 'J', SEI: 'S',
    TIA: 'T', WIF: '🐕', FET: 'F', RENDER: 'R', DUSK: 'D', HANA: 'H',
  };
  return map[symbol] ?? symbol[0];
}

const KNOWN_COIN_COLORS: Record<string, string> = {
  BTC: '#f7931a', ETH: '#627eea', SOL: '#9945ff', BNB: '#f3ba2f',
  XRP: '#346aa9', ADA: '#0033ad', AVAX: '#e84142', DOT: '#e6007a',
  MATIC: '#8247e5', LINK: '#375bd2', LTC: '#bfbbbb', UNI: '#ff007a',
  ATOM: '#2e3148', DOGE: '#c2a633', SUI: '#6fbcf0', APT: '#00c2cb',
  OP: '#ff0420', ARB: '#28a0f0', NEAR: '#00c08b', ICP: '#3b00b9',
  SHIB: '#ffa409', TRX: '#ef0027', TON: '#0098ea', HBAR: '#00b0af',
  VET: '#15bdff', ALGO: '#00b4d8', AAVE: '#b6509e', FIL: '#0090ff',
  THETA: '#2ab8e6', XLM: '#7d00ff', EOS: '#443f54', MKR: '#1aab9b',
  GRT: '#6f4cff', PEPE: '#479a47', JUP: '#c7b369', SEI: '#9b1f1f',
  TIA: '#7b2d8b', WIF: '#c4a35a', FET: '#1a1a2e', RENDER: '#ff5733',
  DUSK: '#372d5e', HANA: '#ff6b9d',
};

function generateCoinColor(symbol: string): string {
  let hash = 0;
  for (const ch of symbol) {
    hash = (hash * 31 + ch.charCodeAt(0)) & 0xffffff;
  }
  const hue = hash % 360;
  return `hsl(${hue}, 65%, 55%)`;
}

export function getCoinColor(symbol: string): string {
  return KNOWN_COIN_COLORS[symbol] ?? generateCoinColor(symbol);
}

// Keep COIN_COLORS export for any direct usages not yet migrated
export const COIN_COLORS: Record<string, string> = KNOWN_COIN_COLORS;
