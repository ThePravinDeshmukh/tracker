import { useState, useEffect } from 'react';
import { PriceMap, VolumeMap } from '../types';

const FUTURES_WS_URL = 'wss://fstream.binance.com/market/stream';
const FUTURES_TICKER24_URL = 'https://fapi.binance.com/fapi/v1/ticker/24hr';
const FUTURES_POLL_INTERVAL_MS = 30_000;

function buildStreamUrl(baseWsUrl: string, pairs: string[], streamType: string = 'ticker'): string {
  const streams = pairs.map(p => `${p.toLowerCase()}@${streamType}`).join('/');
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
      if (!data?.s) return;
      const symbol = data.s as string;
      if (data.e === 'aggTrade') {
        const price = parseFloat(data.p as string);
        if (isNaN(price)) return;
        onTick(symbol, price, NaN, NaN, NaN, NaN, NaN);
      } else {
        if (!data.c) return;
        onTick(
          symbol,
          parseFloat(data.c as string),
          parseFloat(data.q as string),
          parseFloat(data.P as string),
          parseFloat(data.h as string),
          parseFloat(data.l as string),
          parseInt(data.n as string, 10),
        );
      }
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
  pairs: string[],
  baseUrl: string,
  applyTick: OnTick,
): Promise<void> {
  try {
    await Promise.all(
      pairs.map(async pair => {
        const res = await fetch(`${baseUrl}?symbol=${pair}`);
        if (!res.ok) return;
        const data = await res.json() as Ticker24h;
        applyTick(
          pair,
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

    const pairs = symbols.map(s => s.toUpperCase());
    const wsRef: { current: WebSocket | null } = { current: null };
    const reconnectTimer: { current: ReturnType<typeof setTimeout> | null } = { current: null };
    let deliberatelyClosed = false;
    let lastWsTickAt = Date.now();

    function connect(): void {
      const url = buildStreamUrl(FUTURES_WS_URL, pairs, 'aggTrade');

      const tickWithTimestamp: OnTick = (symbol, price, volume, change24hPct, high, low, trades) => {
        lastWsTickAt = Date.now();
        applyTick(symbol, price, volume, change24hPct, high, low, trades);
      };

      const ws = openTickerStream(
        url,
        tickWithTimestamp,
        () => void fetchTicker24h(pairs, FUTURES_TICKER24_URL, applyTick),
        (_event: CloseEvent) => {
          wsRef.current = null;
          if (deliberatelyClosed) return;
          reconnectTimer.current = setTimeout(() => {
            reconnectTimer.current = null;
            if (!deliberatelyClosed) connect();
          }, 2000);
        }
      );
      wsRef.current = ws;
    }

    void fetchTicker24h(pairs, FUTURES_TICKER24_URL, applyTick);
    connect();

    const WS_STALE_MS = 60_000;
    const livenessId = setInterval(() => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      if (Date.now() - lastWsTickAt > WS_STALE_MS) ws.close();
    }, 15_000);

    function handleVisibilityChange(): void {
      if (document.visibilityState !== 'visible') return;
      lastWsTickAt = Date.now();
      void fetchTicker24h(pairs, FUTURES_TICKER24_URL, applyTick);

      const ws = wsRef.current;
      const isDead = ws === null || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING;
      if (!isDead) return;
      if (reconnectTimer.current !== null) {
        clearTimeout(reconnectTimer.current!);
        reconnectTimer.current = null;
      }
      connect();
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      deliberatelyClosed = true;
      clearInterval(livenessId);
      if (reconnectTimer.current !== null) { clearTimeout(reconnectTimer.current); reconnectTimer.current = null; }
      wsRef.current?.close(); wsRef.current = null;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [symbols.join(',')]); // eslint-disable-line

  useEffect(() => {
    const pairs = symbols.map(s => s.toUpperCase());
    if (pairs.length === 0) return;
    const id = setInterval(() => void fetchTicker24h(pairs, FUTURES_TICKER24_URL, applyTick), FUTURES_POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [symbols.join(',')]); // eslint-disable-line

  return { prices, prevPrices, volumes, change24h, high24h, low24h, trades24h, lastUpdatedAt };
}

export function getCoinIcon(symbol: string): string {
  const base = symbol.replace(/USDT$/, '');
  const map: Record<string, string> = {
    BTC: '₿', ETH: 'Ξ', SOL: '◎', BNB: 'B', XRP: 'X', ADA: '₳',
    AVAX: 'A', DOT: '●', MATIC: 'M', LINK: '⬡', LTC: 'Ł', UNI: 'U',
    ATOM: '⚛', DOGE: 'Ð', SUI: 'S', APT: 'A', OP: 'O', ARB: 'Ā',
    NEAR: 'N', ICP: 'I', SHIB: 'S', TRX: 'T', TON: '💎', HBAR: 'H',
    VET: 'V', ALGO: 'A', AAVE: 'A', FIL: 'F', THETA: 'Θ', XLM: '*',
    EOS: 'E', MKR: 'M', GRT: 'G', PEPE: '🐸', JUP: 'J', SEI: 'S',
    TIA: 'T', WIF: '🐕', FET: 'F', RENDER: 'R', DUSK: 'D', HANA: 'H',
  };
  return map[base] ?? base[0];
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
  const base = symbol.replace(/USDT$/, '');
  return KNOWN_COIN_COLORS[base] ?? generateCoinColor(base);
}

export const COIN_COLORS: Record<string, string> = KNOWN_COIN_COLORS;
