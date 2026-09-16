import { useState, useEffect } from 'react';
import { CandleInterval, CANDLE_INTERVALS } from '../types';

const STORAGE_KEY = 'crypto_chart_timeframe_v1';
const DEFAULT_TIMEFRAME: CandleInterval = '1h';

export function isValidTimeframe(value: unknown): value is CandleInterval {
  return typeof value === 'string' && (CANDLE_INTERVALS as readonly string[]).includes(value);
}

function loadTimeframe(): CandleInterval {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return isValidTimeframe(saved) ? saved : DEFAULT_TIMEFRAME;
  } catch {
    return DEFAULT_TIMEFRAME;
  }
}

interface UseChartTimeframeResult {
  timeframe: CandleInterval;
  setTimeframe: (interval: CandleInterval) => void;
}

export function useChartTimeframe(): UseChartTimeframeResult {
  const [timeframe, setTimeframe] = useState<CandleInterval>(loadTimeframe);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, timeframe);
  }, [timeframe]);

  return { timeframe, setTimeframe };
}
