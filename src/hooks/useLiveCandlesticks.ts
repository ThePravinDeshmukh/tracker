import { useState, useEffect, useRef } from 'react';
import { CandlePoint, CandleInterval } from '../types';

const FUTURES_WS_BASE = 'wss://fstream.binance.com/ws';
const FUTURES_KLINE_URL = 'https://fapi.binance.com/fapi/v1/klines';

const KLINE_LIMITS: Record<CandleInterval, number> = {
  '1s': 0,
  '1m': 200,
  '5m': 200,
  '15m': 150,
  '30m': 100,
  '1h': 100,
  '4h': 100,
  '1d': 100,
};

const MAX_1S_CANDLES = 300;

// k[0]=openTime, k[1]=open, k[2]=high, k[3]=low, k[4]=close, k[7]=quoteVol
type RawKline = [number, string, string, string, string, string, number, string, ...unknown[]];

interface UseLiveCandlesticksResult {
  initialCandles: CandlePoint[];
  candleUpdate: CandlePoint | null;
  loading: boolean;
  error: string | null;
}

function parseKlines(raw: RawKline[]): CandlePoint[] {
  return raw.map(k => ({
    time: Math.floor(k[0] / 1000),
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[7]),
  }));
}

export function useLiveCandlesticks(
  symbol: string | null,
  interval: CandleInterval,
): UseLiveCandlesticksResult {
  const [initialCandles, setInitialCandles] = useState<CandlePoint[]>([]);
  const [candleUpdate, setCandleUpdate] = useState<CandlePoint | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // For 1s candles: keep accumulating candles in a ref to avoid stale closures
  const oneSecCandlesRef = useRef<CandlePoint[]>([]);

  useEffect(() => {
    if (!symbol) return;

    const pair = symbol.toUpperCase();
    setLoading(true);
    setError(null);
    setInitialCandles([]);
    setCandleUpdate(null);
    oneSecCandlesRef.current = [];

    let wsRef: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let deliberatelyClosed = false;

    function connectKlineStream(): void {
      const url = `${FUTURES_WS_BASE}/${pair.toLowerCase()}@kline_${interval}`;
      const ws = new WebSocket(url);

      ws.onmessage = (event: MessageEvent) => {
        try {
          const msg = JSON.parse(event.data as string) as {
            k: {
              t: number; o: string; h: string; l: string; c: string; q: string; x: boolean;
            };
          };
          const k = msg.k;
          const candle: CandlePoint = {
            time: Math.floor(k.t / 1000),
            open: parseFloat(k.o),
            high: parseFloat(k.h),
            low: parseFloat(k.l),
            close: parseFloat(k.c),
            volume: parseFloat(k.q),
          };
          setCandleUpdate(candle);
        } catch {}
      };

      ws.onerror = () => {};
      ws.onclose = () => {
        wsRef = null;
        if (deliberatelyClosed) return;
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          if (!deliberatelyClosed) connectKlineStream();
        }, 2000);
      };

      wsRef = ws;
    }

    function connectAggTradeStream(): void {
      const url = `${FUTURES_WS_BASE}/${pair.toLowerCase()}@aggTrade`;
      const ws = new WebSocket(url);

      ws.onmessage = (event: MessageEvent) => {
        try {
          const msg = JSON.parse(event.data as string) as {
            p: string; q: string; T: number;
          };
          const price = parseFloat(msg.p);
          const quoteVol = parseFloat(msg.q) * price;
          const candleTime = Math.floor(msg.T / 1000);

          const candles = oneSecCandlesRef.current;
          const last = candles[candles.length - 1];

          let updated: CandlePoint;
          if (last && last.time === candleTime) {
            updated = {
              time: candleTime,
              open: last.open,
              high: Math.max(last.high, price),
              low: Math.min(last.low, price),
              close: price,
              volume: last.volume + quoteVol,
            };
            oneSecCandlesRef.current = [...candles.slice(0, -1), updated];
          } else {
            updated = { time: candleTime, open: price, high: price, low: price, close: price, volume: quoteVol };
            const trimmed = candles.length >= MAX_1S_CANDLES ? candles.slice(1) : candles;
            oneSecCandlesRef.current = [...trimmed, updated];
          }

          setCandleUpdate({ ...updated });
        } catch {}
      };

      ws.onerror = () => {};
      ws.onclose = () => {
        wsRef = null;
        if (deliberatelyClosed) return;
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          if (!deliberatelyClosed) connectAggTradeStream();
        }, 2000);
      };

      wsRef = ws;
    }

    if (interval === '1s') {
      setLoading(false);
      connectAggTradeStream();
    } else {
      const limit = KLINE_LIMITS[interval];
      const url = `${FUTURES_KLINE_URL}?symbol=${pair}&interval=${interval}&limit=${limit}`;
      let cancelled = false;

      fetch(url)
        .then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json() as Promise<RawKline[]>;
        })
        .then(raw => {
          if (cancelled) return;
          setInitialCandles(parseKlines(raw));
          setLoading(false);
          connectKlineStream();
        })
        .catch(err => {
          if (cancelled) return;
          setError((err as Error).message ?? 'Failed to load history');
          setLoading(false);
        });

      return () => {
        cancelled = true;
        deliberatelyClosed = true;
        if (reconnectTimer !== null) { clearTimeout(reconnectTimer); }
        wsRef?.close();
      };
    }

    return () => {
      deliberatelyClosed = true;
      if (reconnectTimer !== null) { clearTimeout(reconnectTimer); }
      wsRef?.close();
    };
  }, [symbol, interval]); // eslint-disable-line

  return { initialCandles, candleUpdate, loading, error };
}
