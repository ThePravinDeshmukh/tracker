import { useState, useEffect, useMemo } from 'react';
import { PriceMap, VolumeMap } from '../types';
import { useAvailablePairs } from './useAvailablePairs';

const SPOT_WS_URL = 'wss://stream.binance.com:9443/stream';
const FUTURES_WS_URL = 'wss://fstream.binance.com/stream';
const SPOT_TICKER24_URL = 'https://api.binance.com/api/v3/ticker/24hr';
const FUTURES_TICKER24_URL = 'https://fapi.binance.com/fapi/v1/ticker/24hr';

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
  change24h: PriceMap;
  high24h: PriceMap;
  low24h: PriceMap;
  trades24h: Record<string, number>;
  lastUpdatedAt: number | null;
}

type OnTick = (
  symbol: string,
  price: number,
  volume: number,
  change24hPct: number,
  high: number,
  low: number,
  trades: number,
) => void;

function openTickerStream(
  url: string,
  onTick: OnTick,
  onError: () => void,
  onClose: (event: CloseEvent) => void
): WebSocket {
  const ws = new WebSocket(url);
  ws.onmessage = (event: MessageEvent) => {
    try {
      const { data } = JSON.parse(event.data as string);
      if (!data?.s || !data?.c) return;
      const symbol = (data.s as string).replace(/USDT$/, '');
      const price = parseFloat(data.c as string);
      const volume = parseFloat(data.q as string);
      const change24hPct = parseFloat(data.P as string);
      const high = parseFloat(data.h as string);
      const low = parseFloat(data.l as string);
      const trades = parseInt(data.n as string, 10);
      onTick(symbol, price, volume, change24hPct, high, low, trades);
    } catch {}
  };
  ws.onerror = onError;
  ws.onclose = onClose;
  return ws;
}

interface Ticker24h {
  lastPrice: string;
  quoteVolume: string;
  priceChangePercent: string;
  highPrice: string;
  lowPrice: string;
  count: number;
}

async function fetchTicker24h(
  symbols: string[],
  baseUrl: string,
  applyTick: OnTick,
): Promise<void> {
  try {
    await Promise.all(
      symbols.map(async symbol => {
        const res = await fetch(`${baseUrl}?symbol=${toUsdtPair(symbol)}`);
        if (!res.ok) return;
        const data = await res.json() as Ticker24h;
        applyTick(
          symbol,
          parseFloat(data.lastPrice),
          parseFloat(data.quoteVolume),
          parseFloat(data.priceChangePercent),
          parseFloat(data.highPrice),
          parseFloat(data.lowPrice),
          data.count ?? 0,
        );
      })
    );
  } catch {}
}

export function useCryptoPrices(symbols: string[]): UseCryptoPricesResult {
  const [prices, setPrices] = useState<PriceMap>({});
  const [prevPrices, setPrevPrices] = useState<PriceMap>({});
  const [volumes, setVolumes] = useState<VolumeMap>({});
  const [change24h, setChange24h] = useState<PriceMap>({});
  const [high24h, setHigh24h] = useState<PriceMap>({});
  const [low24h, setLow24h] = useState<PriceMap>({});
  const [trades24h, setTrades24h] = useState<Record<string, number>>({});
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const { spotSymbols: availableSpot, futuresSymbols: availableFutures } = useAvailablePairs(
    useMemo(() => symbols.map(s => s.toUpperCase()), [symbols.join(',')])  // eslint-disable-line
  );

  const futuresOnlySet = useMemo(() => new Set(availableFutures), [availableFutures]);

  const futuresKey = useMemo(
    () => availableFutures.slice().sort().join(','),
    [availableFutures]
  );

  const applyTick = (symbol: string, price: number, volume: number, change24hPct: number, high: number, low: number, trades: number): void => {
    setPrices(prev => {
      setPrevPrices(pp => ({ ...pp, [symbol]: prev[symbol] }));
      return { ...prev, [symbol]: price };
    });
    if (!isNaN(volume)) setVolumes(prev => ({ ...prev, [symbol]: volume }));
    if (!isNaN(change24hPct)) setChange24h(prev => ({ ...prev, [symbol]: change24hPct }));
    if (!isNaN(high)) setHigh24h(prev => ({ ...prev, [symbol]: high }));
    if (!isNaN(low)) setLow24h(prev => ({ ...prev, [symbol]: low }));
    if (!isNaN(trades) && trades > 0) setTrades24h(prev => ({ ...prev, [symbol]: trades }));
    setLastUpdatedAt(Date.now());
  };

  useEffect(() => {
    if (!symbols || symbols.length === 0) return;

    const upper = symbols.map(s => s.toUpperCase());
    const spotSymbols = upper.filter(s => !futuresOnlySet.has(s));
    const futuresSymbols = upper.filter(s => futuresOnlySet.has(s));
    const spotPairs = spotSymbols.map(toUsdtPair);
    const futuresPairs = futuresSymbols.map(toUsdtPair);

    // Mutable state scoped to this effect run — plain objects to avoid re-renders
    const wsRefs: [{ current: WebSocket | null }, { current: WebSocket | null }] = [
      { current: null }, { current: null },
    ];
    const reconnectTimers: [
      { current: ReturnType<typeof setTimeout> | null },
      { current: ReturnType<typeof setTimeout> | null }
    ] = [
      { current: null }, { current: null },
    ];
    let deliberatelyClosed = false;

    function connect(index: 0 | 1): void {
      const url = index === 0
        ? buildStreamUrl(SPOT_WS_URL, spotPairs)
        : buildStreamUrl(FUTURES_WS_URL, futuresPairs);
      const syms = index === 0 ? spotSymbols : futuresSymbols;
      const rest24 = index === 0 ? SPOT_TICKER24_URL : FUTURES_TICKER24_URL;

      const ws = openTickerStream(
        url,
        applyTick,
        () => void fetchTicker24h(syms, rest24, applyTick),
        (event: CloseEvent) => {
          wsRefs[index].current = null;
          if (deliberatelyClosed) return;
          reconnectTimers[index].current = setTimeout(() => {
            reconnectTimers[index].current = null;
            if (!deliberatelyClosed) connect(index);
          }, 2000);
        }
      );
      wsRefs[index].current = ws;
    }

    // Fetch prices immediately via REST so the UI is populated before the first WS tick
    if (spotSymbols.length > 0)    void fetchTicker24h(spotSymbols, SPOT_TICKER24_URL, applyTick);
    if (futuresSymbols.length > 0) void fetchTicker24h(futuresSymbols, FUTURES_TICKER24_URL, applyTick);

    if (spotSymbols.length > 0)    connect(0);
    if (futuresSymbols.length > 0) connect(1);

    function handleVisibilityChange(): void {
      if (document.visibilityState !== 'visible') return;

      // Serve fresh prices via REST immediately while new socket handshake completes
      if (spotSymbols.length > 0)
        void fetchTicker24h(spotSymbols, SPOT_TICKER24_URL, applyTick);
      if (futuresSymbols.length > 0)
        void fetchTicker24h(futuresSymbols, FUTURES_TICKER24_URL, applyTick);

      // Reconnect any dead sockets
      for (const index of [0, 1] as const) {
        const ws = wsRefs[index].current;
        const isDead = ws === null
          || ws.readyState === WebSocket.CLOSED
          || ws.readyState === WebSocket.CLOSING;
        if (!isDead) continue;

        // Cancel pending close-handler reconnect to prevent double-connection
        if (reconnectTimers[index].current !== null) {
          clearTimeout(reconnectTimers[index].current!);
          reconnectTimers[index].current = null;
        }

        const hasSymbols = index === 0 ? spotSymbols.length > 0 : futuresSymbols.length > 0;
        if (hasSymbols) connect(index);
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      deliberatelyClosed = true;
      for (const t of reconnectTimers) {
        if (t.current !== null) { clearTimeout(t.current); t.current = null; }
      }
      for (const ref of wsRefs) { ref.current?.close(); ref.current = null; }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [symbols.join(','), futuresKey]); // eslint-disable-line

  return { prices, prevPrices, volumes, change24h, high24h, low24h, trades24h, lastUpdatedAt };
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
