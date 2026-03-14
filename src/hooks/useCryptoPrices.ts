import { useState, useEffect } from 'react';
import { PriceMap } from '../types';

// Spot market coins (stream.binance.com)
const SPOT_COIN_IDS: Record<string, string> = {
  BTC: 'BTCUSDT',
  ETH: 'ETHUSDT',
  SOL: 'SOLUSDT',
  BNB: 'BNBUSDT',
  XRP: 'XRPUSDT',
  ADA: 'ADAUSDT',
  AVAX: 'AVAXUSDT',
  DOT: 'DOTUSDT',
  MATIC: 'MATICUSDT',
  LINK: 'LINKUSDT',
  LTC: 'LTCUSDT',
  UNI: 'UNIUSDT',
  ATOM: 'ATOMUSDT',
  DOGE: 'DOGEUSDT',
  SUI: 'SUIUSDT',
  APT: 'APTUSDT',
  OP: 'OPUSDT',
  ARB: 'ARBUSDT',
  NEAR: 'NEARUSDT',
  ICP: 'ICPUSDT',
  SHIB: 'SHIBUSDT',
  TRX: 'TRXUSDT',
  TON: 'TONUSDT',
  HBAR: 'HBARUSDT',
  VET: 'VETUSDT',
  ALGO: 'ALGOUSDT',
  AAVE: 'AAVEUSDT',
  FIL: 'FILUSDT',
  THETA: 'THETAUSDT',
  XLM: 'XLMUSDT',
  EOS: 'EOSUSDT',
  MKR: 'MKRUSDT',
  GRT: 'GRTUSDT',
  PEPE: 'PEPEUSDT',
  JUP: 'JUPUSDT',
  SEI: 'SEIUSDT',
  TIA: 'TIAUSDT',
  WIF: 'WIFUSDT',
  FET: 'FETUSDT',
  RENDER: 'RENDERUSDT',
};

// Futures-only coins (fstream.binance.com) — not listed on Binance spot
const FUTURES_COIN_IDS: Record<string, string> = {
  DUSK: 'DUSKUSDT',
  HANA: 'HANAUSDT',
};

const ALL_COIN_IDS: Record<string, string> = { ...SPOT_COIN_IDS, ...FUTURES_COIN_IDS };

interface UseCryptoPricesResult {
  prices: PriceMap;
  prevPrices: PriceMap;
}

function openStream(
  url: string,
  coinIds: Record<string, string>,
  onPrice: (symbol: string, price: number) => void,
  onError: () => void
): WebSocket {
  const ws = new WebSocket(url);

  ws.onmessage = (event: MessageEvent) => {
    try {
      const { data } = JSON.parse(event.data as string);
      if (!data) return;
      const symbol = Object.keys(coinIds).find(k => coinIds[k] === data.s);
      if (symbol) onPrice(symbol, parseFloat(data.c));
    } catch (e) {}
  };

  ws.onerror = onError;
  return ws;
}

export function useCryptoPrices(symbols: string[]): UseCryptoPricesResult {
  const [prices, setPrices] = useState<PriceMap>({});
  const [prevPrices, setPrevPrices] = useState<PriceMap>({});

  const applyPrice = (symbol: string, price: number): void => {
    setPrices(prev => {
      setPrevPrices(pp => ({ ...pp, [symbol]: prev[symbol] }));
      return { ...prev, [symbol]: price };
    });
  };

  useEffect(() => {
    if (!symbols || symbols.length === 0) return;

    const upper = symbols.map(s => s.toUpperCase());
    const spotSymbols = upper.filter(s => SPOT_COIN_IDS[s]);
    const futuresSymbols = upper.filter(s => FUTURES_COIN_IDS[s]);

    const connections: WebSocket[] = [];

    if (spotSymbols.length > 0) {
      const streams = spotSymbols.map(s => `${SPOT_COIN_IDS[s].toLowerCase()}@ticker`).join('/');
      const ws = openStream(
        `wss://stream.binance.com:9443/stream?streams=${streams}`,
        SPOT_COIN_IDS,
        applyPrice,
        () => fetchFallback(spotSymbols, SPOT_COIN_IDS, 'https://api.binance.com/api/v3/ticker/price', setPrices)
      );
      connections.push(ws);
    }

    if (futuresSymbols.length > 0) {
      const streams = futuresSymbols.map(s => `${FUTURES_COIN_IDS[s].toLowerCase()}@ticker`).join('/');
      const ws = openStream(
        `wss://fstream.binance.com/stream?streams=${streams}`,
        FUTURES_COIN_IDS,
        applyPrice,
        () => fetchFallback(futuresSymbols, FUTURES_COIN_IDS, 'https://fapi.binance.com/fapi/v1/ticker/price', setPrices)
      );
      connections.push(ws);
    }

    return () => connections.forEach(ws => ws.close());
  }, [symbols.join(',')]);

  return { prices, prevPrices };
}

async function fetchFallback(
  symbols: string[],
  coinIds: Record<string, string>,
  baseUrl: string,
  setPrices: React.Dispatch<React.SetStateAction<PriceMap>>
): Promise<void> {
  try {
    const results = await Promise.all(
      symbols.map(async s => {
        const res = await fetch(`${baseUrl}?symbol=${coinIds[s]}`);
        const data = await res.json() as { price: string };
        return { symbol: s, price: parseFloat(data.price) };
      })
    );
    const priceMap: PriceMap = {};
    results.forEach(r => { priceMap[r.symbol] = r.price; });
    setPrices(prev => ({ ...prev, ...priceMap }));
  } catch (e) {}
}

export const SUPPORTED_COINS: string[] = Object.keys(ALL_COIN_IDS);

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

export const COIN_COLORS: Record<string, string> = {
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
