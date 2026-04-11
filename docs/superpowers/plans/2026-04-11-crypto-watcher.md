# Crypto Watcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a collapsible right-side watcher panel that scans a configurable watchlist for coins with rising price (+2% in 5min) AND volume spike (1.5× average), showing current/past signals and a toast notification.

**Architecture:** A new `useWatcher` hook owns all state — watchlist persistence, WebSocket connections (same Binance pattern as `useCryptoPrices`), rolling price/volume history, and signal state transitions. `WatcherSidebar` and `WatcherToast` are pure UI components wired into `App.tsx`. Pure signal detection utilities live in `src/utils/watcherSignals.ts` for testability.

**Tech Stack:** React 18, TypeScript 4.9, Binance WebSocket API, localStorage, CSS transitions

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/types.ts` | Add `WatcherSignal`, `WatchedCoin` interfaces |
| Create | `src/utils/watcherSignals.ts` | Pure signal detection functions |
| Create | `src/utils/watcherSignals.test.ts` | Unit tests for signal detection |
| Create | `src/hooks/useWatcher.ts` | Watchlist state, WebSocket, signal transitions, toast queue |
| Create | `src/components/WatcherToast.tsx` | 4-second auto-dismiss toast |
| Create | `src/components/WatcherSidebar.tsx` | Collapsible sidebar (3 panels) |
| Modify | `src/App.tsx` | Add `useWatcher`, toggle button with badge, render sidebar+toast |
| Modify | `src/App.css` | Sidebar, toggle button, badge, toast, signal card styles |

---

## Task 1: Add Types

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Add `WatcherSignal` and `WatchedCoin` to `src/types.ts`**

Append to the end of the existing file:

```typescript
export interface WatcherSignal {
  symbol: string;
  price: number;
  priceChangePct: number;  // e.g. 2.4 means +2.4%
  volumeRatio: number;     // e.g. 1.8 means 1.8× rolling average
  enteredAt: number;       // unix ms — when coin entered current signals
  exitedAt?: number;       // unix ms — set when coin moves to past signals
}

export interface WatchedCoin {
  symbol: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types.ts
git commit -m "feat: add WatcherSignal and WatchedCoin types"
```

---

## Task 2: Signal Detection Utilities + Tests

**Files:**
- Create: `src/utils/watcherSignals.ts`
- Create: `src/utils/watcherSignals.test.ts`

- [ ] **Step 1: Create `src/utils/watcherSignals.ts`**

```typescript
export interface PricePoint {
  price: number;
  timestamp: number; // unix ms
}

export const PRICE_WINDOW_MS = 5 * 60 * 1000;      // 5 minutes
export const MAX_PRICE_HISTORY_MS = 10 * 60 * 1000; // 10 minutes
export const MAX_VOLUME_READINGS = 10;
export const MIN_PRICE_CHANGE_PCT = 2.0;
export const VOLUME_SPIKE_RATIO = 1.5;
export const MIN_VOLUME_READINGS = 3;

/**
 * Returns true when price has risen >= 2% compared to the price from ~5 minutes ago.
 * Returns false if there is less than 5 minutes of history.
 */
export function checkPriceMomentum(
  history: PricePoint[],
  now: number
): { met: boolean; changePct: number } {
  if (history.length < 2) return { met: false, changePct: 0 };
  const oldest = history[0];
  if (now - oldest.timestamp < PRICE_WINDOW_MS) return { met: false, changePct: 0 };

  const targetTime = now - PRICE_WINDOW_MS;
  const reference = history.reduce((best, point) =>
    Math.abs(point.timestamp - targetTime) < Math.abs(best.timestamp - targetTime) ? point : best
  );

  const current = history[history.length - 1].price;
  const changePct = ((current - reference.price) / reference.price) * 100;
  return { met: changePct >= MIN_PRICE_CHANGE_PCT, changePct };
}

/**
 * Returns true when the last volume reading is >= 1.5x the average of the previous readings.
 * history[history.length - 1] is the current reading.
 * Returns false if fewer than MIN_VOLUME_READINGS entries exist.
 */
export function checkVolumeSpike(
  history: number[]
): { met: boolean; ratio: number } {
  if (history.length < MIN_VOLUME_READINGS) return { met: false, ratio: 0 };
  const previous = history.slice(0, -1);
  const avg = previous.reduce((sum, v) => sum + v, 0) / previous.length;
  if (avg === 0) return { met: false, ratio: 0 };
  const current = history[history.length - 1];
  const ratio = current / avg;
  return { met: ratio >= VOLUME_SPIKE_RATIO, ratio };
}

/** Removes price points older than MAX_PRICE_HISTORY_MS. */
export function pruneOldPriceHistory(history: PricePoint[], now: number): PricePoint[] {
  const cutoff = now - MAX_PRICE_HISTORY_MS;
  return history.filter(p => p.timestamp >= cutoff);
}
```

- [ ] **Step 2: Write failing tests in `src/utils/watcherSignals.test.ts`**

```typescript
import {
  checkPriceMomentum,
  checkVolumeSpike,
  pruneOldPriceHistory,
  PRICE_WINDOW_MS,
  MAX_PRICE_HISTORY_MS,
} from './watcherSignals';

const NOW = 1_000_000_000_000; // fixed reference timestamp

describe('checkPriceMomentum', () => {
  it('returns false when history is empty', () => {
    expect(checkPriceMomentum([], NOW).met).toBe(false);
  });

  it('returns false when history is shorter than 5 minutes', () => {
    const history = [
      { price: 100, timestamp: NOW - 4 * 60 * 1000 },
      { price: 103, timestamp: NOW },
    ];
    expect(checkPriceMomentum(history, NOW).met).toBe(false);
  });

  it('returns true when price is up >= 2% over 5 minutes', () => {
    const history = [
      { price: 100, timestamp: NOW - 6 * 60 * 1000 },
      { price: 100, timestamp: NOW - 5 * 60 * 1000 },
      { price: 103, timestamp: NOW },
    ];
    const result = checkPriceMomentum(history, NOW);
    expect(result.met).toBe(true);
    expect(result.changePct).toBeCloseTo(3, 1);
  });

  it('returns false when price is up < 2% over 5 minutes', () => {
    const history = [
      { price: 100, timestamp: NOW - 6 * 60 * 1000 },
      { price: 100, timestamp: NOW - 5 * 60 * 1000 },
      { price: 101, timestamp: NOW },
    ];
    expect(checkPriceMomentum(history, NOW).met).toBe(false);
  });

  it('returns false when price is flat', () => {
    const history = [
      { price: 100, timestamp: NOW - 6 * 60 * 1000 },
      { price: 100, timestamp: NOW - 5 * 60 * 1000 },
      { price: 100, timestamp: NOW },
    ];
    expect(checkPriceMomentum(history, NOW).met).toBe(false);
  });
});

describe('checkVolumeSpike', () => {
  it('returns false when fewer than 3 readings', () => {
    expect(checkVolumeSpike([100, 200]).met).toBe(false);
  });

  it('returns true when current volume is >= 1.5x average of previous', () => {
    // previous avg = (100 + 100 + 100) / 3 = 100; current = 160 → ratio = 1.6
    const result = checkVolumeSpike([100, 100, 100, 160]);
    expect(result.met).toBe(true);
    expect(result.ratio).toBeCloseTo(1.6, 1);
  });

  it('returns false when current volume is below 1.5x average', () => {
    // previous avg = 100; current = 140 → ratio = 1.4
    expect(checkVolumeSpike([100, 100, 100, 140]).met).toBe(false);
  });

  it('returns false when average is zero', () => {
    expect(checkVolumeSpike([0, 0, 0, 200]).met).toBe(false);
  });
});

describe('pruneOldPriceHistory', () => {
  it('removes points older than 10 minutes', () => {
    const history = [
      { price: 100, timestamp: NOW - MAX_PRICE_HISTORY_MS - 1 },
      { price: 101, timestamp: NOW - MAX_PRICE_HISTORY_MS + 1 },
      { price: 102, timestamp: NOW },
    ];
    const pruned = pruneOldPriceHistory(history, NOW);
    expect(pruned).toHaveLength(2);
    expect(pruned[0].price).toBe(101);
  });

  it('keeps all points within 10 minutes', () => {
    const history = [
      { price: 100, timestamp: NOW - 9 * 60 * 1000 },
      { price: 101, timestamp: NOW },
    ];
    expect(pruneOldPriceHistory(history, NOW)).toHaveLength(2);
  });
});
```

- [ ] **Step 3: Run tests to confirm they fail (file doesn't exist yet — this step verifies the test runner works)**

```bash
cd d:/Code/Git/crypto-tracker && npx react-scripts test --watchAll=false --testPathPattern=watcherSignals 2>&1 | tail -20
```

Expected: Tests pass (the implementation was written before the tests in this case — verify all pass green).

- [ ] **Step 4: Commit**

```bash
git add src/utils/watcherSignals.ts src/utils/watcherSignals.test.ts
git commit -m "feat: add signal detection utilities with tests"
```

---

## Task 3: `useWatcher` Hook

**Files:**
- Create: `src/hooks/useWatcher.ts`

- [ ] **Step 1: Create `src/hooks/useWatcher.ts`**

```typescript
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { WatcherSignal } from '../types';
import { useAvailablePairs } from './useAvailablePairs';
import {
  PricePoint,
  checkPriceMomentum,
  checkVolumeSpike,
  pruneOldPriceHistory,
  MAX_VOLUME_READINGS,
} from '../utils/watcherSignals';

const STORAGE_KEY = 'watcher-watchlist';
const MAX_WATCHLIST = 20;
const MAX_PAST_SIGNALS = 20;
const SPOT_WS_URL = 'wss://stream.binance.com:9443/stream';
const FUTURES_WS_URL = 'wss://fstream.binance.com/stream';
const FALLBACK_FUTURES_ONLY = new Set<string>(['DUSK', 'HANA']);

function toUsdtPair(symbol: string): string {
  return `${symbol.toUpperCase()}USDT`;
}

function buildStreamUrl(baseWsUrl: string, pairs: string[]): string {
  const streams = pairs.map(p => `${p.toLowerCase()}@ticker`).join('/');
  return `${baseWsUrl}?streams=${streams}`;
}

export interface UseWatcherResult {
  watchlist: string[];
  currentSignals: WatcherSignal[];
  pastSignals: WatcherSignal[];
  prices: Record<string, number>;
  activeToast: WatcherSignal | null;
  addToWatchlist: (symbol: string) => void;
  removeFromWatchlist: (symbol: string) => void;
  dismissToast: () => void;
}

export function useWatcher(): UseWatcherResult {
  const [watchlist, setWatchlist] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? (JSON.parse(saved) as string[]) : [];
    } catch {
      return [];
    }
  });

  const [prices, setPrices] = useState<Record<string, number>>({});
  const [currentSignals, setCurrentSignals] = useState<WatcherSignal[]>([]);
  const [pastSignals, setPastSignals] = useState<WatcherSignal[]>([]);
  const [toastQueue, setToastQueue] = useState<WatcherSignal[]>([]);
  const [activeToast, setActiveToast] = useState<WatcherSignal | null>(null);

  // Refs hold mutable history without triggering re-renders on every tick
  const priceHistoryRef = useRef<Record<string, PricePoint[]>>({});
  const volumeHistoryRef = useRef<Record<string, number[]>>({});
  const currentSignalsRef = useRef<WatcherSignal[]>([]);

  const { spotSymbols: availableSpot, futuresSymbols: availableFutures } = useAvailablePairs();

  const futuresOnlySet = useMemo(() => {
    if (availableSpot.length === 0 && availableFutures.length === 0) return FALLBACK_FUTURES_ONLY;
    const spotSet = new Set(availableSpot);
    return new Set(availableFutures.filter(s => !spotSet.has(s)));
  }, [availableSpot, availableFutures]);

  // Persist watchlist
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(watchlist));
  }, [watchlist]);

  // Advance toast queue when activeToast is dismissed
  useEffect(() => {
    if (activeToast !== null) return;
    if (toastQueue.length === 0) return;
    setToastQueue(queue => {
      const [next, ...rest] = queue;
      setActiveToast(next);
      return rest;
    });
  }, [activeToast, toastQueue.length]);

  const processTick = useCallback((symbol: string, price: number, volume: number) => {
    const now = Date.now();

    // Update price history
    const rawHistory = priceHistoryRef.current[symbol] ?? [];
    priceHistoryRef.current[symbol] = pruneOldPriceHistory(
      [...rawHistory, { price, timestamp: now }],
      now
    );

    // Update volume history
    if (!isNaN(volume) && volume > 0) {
      const volHistory = volumeHistoryRef.current[symbol] ?? [];
      volumeHistoryRef.current[symbol] = [...volHistory, volume].slice(-MAX_VOLUME_READINGS);
    }

    setPrices(prev => ({ ...prev, [symbol]: price }));

    const priceResult = checkPriceMomentum(priceHistoryRef.current[symbol], now);
    const volumeResult = checkVolumeSpike(volumeHistoryRef.current[symbol] ?? []);
    const conditionMet = priceResult.met && volumeResult.met;
    const wasSignaling = currentSignalsRef.current.some(s => s.symbol === symbol);

    if (conditionMet && !wasSignaling) {
      const newSignal: WatcherSignal = {
        symbol,
        price,
        priceChangePct: priceResult.changePct,
        volumeRatio: volumeResult.ratio,
        enteredAt: now,
      };
      const updated = [...currentSignalsRef.current, newSignal];
      currentSignalsRef.current = updated;
      setCurrentSignals(updated);
      setToastQueue(q => [...q, newSignal]);
    } else if (conditionMet && wasSignaling) {
      // Keep stats live while signal is active
      const updated = currentSignalsRef.current.map(s =>
        s.symbol === symbol
          ? { ...s, price, priceChangePct: priceResult.changePct, volumeRatio: volumeResult.ratio }
          : s
      );
      currentSignalsRef.current = updated;
      setCurrentSignals(updated);
    } else if (!conditionMet && wasSignaling) {
      const exiting = currentSignalsRef.current.find(s => s.symbol === symbol);
      if (exiting) {
        const exited: WatcherSignal = { ...exiting, exitedAt: now };
        const updatedCurrent = currentSignalsRef.current.filter(s => s.symbol !== symbol);
        currentSignalsRef.current = updatedCurrent;
        setCurrentSignals(updatedCurrent);
        setPastSignals(prev => [exited, ...prev].slice(0, MAX_PAST_SIGNALS));
      }
    }
  }, []);

  // WebSocket connections — reconnect when watchlist or futures routing changes
  const futuresKey = useMemo(
    () => Array.from(futuresOnlySet).sort().join(','),
    [futuresOnlySet]
  );

  useEffect(() => {
    if (watchlist.length === 0) return;

    const upper = watchlist.map(s => s.toUpperCase());
    const spotSymbols = upper.filter(s => !futuresOnlySet.has(s));
    const futuresSymbols = upper.filter(s => futuresOnlySet.has(s));
    const connections: WebSocket[] = [];

    const openStream = (baseUrl: string, symbols: string[]): WebSocket => {
      const ws = new WebSocket(buildStreamUrl(baseUrl, symbols.map(toUsdtPair)));
      ws.onmessage = (event: MessageEvent) => {
        try {
          const { data } = JSON.parse(event.data as string);
          if (!data?.s || !data?.c) return;
          const symbol = (data.s as string).replace(/USDT$/, '');
          processTick(symbol, parseFloat(data.c as string), parseFloat(data.q as string));
        } catch {}
      };
      return ws;
    };

    if (spotSymbols.length > 0) connections.push(openStream(SPOT_WS_URL, spotSymbols));
    if (futuresSymbols.length > 0) connections.push(openStream(FUTURES_WS_URL, futuresSymbols));

    return () => connections.forEach(ws => ws.close());
  }, [watchlist.join(','), futuresKey, processTick]); // eslint-disable-line

  const addToWatchlist = useCallback((symbol: string) => {
    setWatchlist(prev => {
      if (prev.includes(symbol) || prev.length >= MAX_WATCHLIST) return prev;
      return [...prev, symbol];
    });
  }, []);

  const removeFromWatchlist = useCallback((symbol: string) => {
    setWatchlist(prev => prev.filter(s => s !== symbol));
    // Clear state for removed coin
    const updated = currentSignalsRef.current.filter(s => s.symbol !== symbol);
    currentSignalsRef.current = updated;
    setCurrentSignals(updated);
    delete priceHistoryRef.current[symbol];
    delete volumeHistoryRef.current[symbol];
  }, []);

  const dismissToast = useCallback(() => {
    setActiveToast(null);
  }, []);

  return {
    watchlist,
    currentSignals,
    pastSignals,
    prices,
    activeToast,
    addToWatchlist,
    removeFromWatchlist,
    dismissToast,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useWatcher.ts
git commit -m "feat: add useWatcher hook with signal detection and WebSocket streaming"
```

---

## Task 4: `WatcherToast` Component

**Files:**
- Create: `src/components/WatcherToast.tsx`
- Modify: `src/App.css` (add toast styles)

- [ ] **Step 1: Create `src/components/WatcherToast.tsx`**

```typescript
import React, { useEffect } from 'react';
import { WatcherSignal } from '../types';

const TOAST_DURATION_MS = 4000;

interface Props {
  signal: WatcherSignal | null;
  onDismiss: () => void;
}

function fmtPrice(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function WatcherToast({ signal, onDismiss }: Props) {
  useEffect(() => {
    if (!signal) return;
    const timer = setTimeout(onDismiss, TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [signal, onDismiss]);

  if (!signal) return null;

  return (
    <div className="watcher-toast fade-in">
      <div className="watcher-toast-row">
        <span className="watcher-toast-symbol">{signal.symbol}</span>
        <span className="watcher-toast-tag">Buy Signal</span>
        <button className="btn-icon" onClick={onDismiss}>✕</button>
      </div>
      <div className="watcher-toast-price mono">${fmtPrice(signal.price)}</div>
      <div className="watcher-toast-stats">
        <span className="watcher-toast-stat pos">+{signal.priceChangePct.toFixed(1)}% 5min</span>
        <span className="watcher-toast-stat muted">{signal.volumeRatio.toFixed(1)}× vol</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add toast styles to `src/App.css`** (append to end of file)

```css
/* ── Watcher Toast ── */
.watcher-toast {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 400;
  background: var(--surface);
  border: 1px solid var(--border);
  border-left: 3px solid var(--green);
  border-radius: 10px;
  padding: 14px 16px;
  min-width: 220px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
}
.watcher-toast-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.watcher-toast-symbol {
  font-family: var(--mono);
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
  flex: 1;
}
.watcher-toast-tag {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--green);
  background: rgba(52, 212, 138, 0.12);
  padding: 2px 7px;
  border-radius: 4px;
}
.watcher-toast-price {
  font-size: 16px;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 6px;
}
.watcher-toast-stats {
  display: flex;
  gap: 12px;
  font-size: 12px;
  font-family: var(--mono);
}
.watcher-toast-stat.pos { color: var(--green); }
.watcher-toast-stat.muted { color: var(--muted); }
```

- [ ] **Step 3: Commit**

```bash
git add src/components/WatcherToast.tsx src/App.css
git commit -m "feat: add WatcherToast component with auto-dismiss"
```

---

## Task 5: `WatcherSidebar` Component

**Files:**
- Create: `src/components/WatcherSidebar.tsx`
- Modify: `src/App.css` (add sidebar styles)

- [ ] **Step 1: Create `src/components/WatcherSidebar.tsx`**

```typescript
import React, { useState, useRef, useEffect } from 'react';
import { WatcherSignal } from '../types';
import { useAvailablePairs } from '../hooks/useAvailablePairs';

const MAX_WATCHLIST = 20;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  watchlist: string[];
  currentSignals: WatcherSignal[];
  pastSignals: WatcherSignal[];
  prices: Record<string, number>;
  onAdd: (symbol: string) => void;
  onRemove: (symbol: string) => void;
}

function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}min ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

function fmtPrice(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function WatcherSidebar({
  isOpen,
  onClose,
  watchlist,
  currentSignals,
  pastSignals,
  prices,
  onAdd,
  onRemove,
}: Props) {
  const [coinSearch, setCoinSearch] = useState('');
  const [showAddInput, setShowAddInput] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const { allSymbols } = useAvailablePairs();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close add input when sidebar closes
  useEffect(() => {
    if (!isOpen) {
      setShowAddInput(false);
      setCoinSearch('');
    }
  }, [isOpen]);

  const filteredCoins = allSymbols
    .filter(c => !watchlist.includes(c))
    .filter(c => c.toLowerCase().includes(coinSearch.toLowerCase()))
    .slice(0, 30);

  const handleSelect = (symbol: string): void => {
    onAdd(symbol);
    setCoinSearch('');
    setShowAddInput(false);
    setShowDropdown(false);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setCoinSearch(e.target.value.toUpperCase());
    setShowDropdown(true);
  };

  return (
    <>
      {isOpen && <div className="watcher-overlay" onClick={onClose} />}
      <div className={`watcher-sidebar${isOpen ? ' open' : ''}`}>
        {/* Header */}
        <div className="watcher-header">
          <span className="watcher-title">Watcher</span>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        <div className="watcher-body">
          {/* Current Signals */}
          <div className="watcher-section">
            <div className="watcher-section-label">
              {currentSignals.length > 0 && <span className="pulse-dot" />}
              Current Signals ({currentSignals.length})
            </div>
            {currentSignals.length === 0 ? (
              <div className="watcher-empty">No active signals</div>
            ) : (
              currentSignals.map(signal => (
                <div key={signal.symbol} className="watcher-signal-card current">
                  <div className="watcher-signal-top">
                    <span className="watcher-signal-sym">{signal.symbol}</span>
                    <span className="watcher-signal-price mono">${fmtPrice(signal.price)}</span>
                  </div>
                  <div className="watcher-signal-meta">
                    <span className="pos">+{signal.priceChangePct.toFixed(1)}% 5min</span>
                    <span className="muted-text">{signal.volumeRatio.toFixed(1)}× vol</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Past Signals */}
          <div className="watcher-section">
            <div className="watcher-section-label">Past Signals</div>
            {pastSignals.length === 0 ? (
              <div className="watcher-empty">None yet</div>
            ) : (
              pastSignals.map((signal, index) => (
                <div key={`${signal.symbol}-${signal.exitedAt ?? index}`} className="watcher-signal-card past">
                  <div className="watcher-signal-top">
                    <span className="watcher-signal-sym">{signal.symbol}</span>
                    <span className="watcher-signal-price mono">${fmtPrice(signal.price)}</span>
                  </div>
                  <div className="watcher-signal-meta">
                    <span className="muted-text">
                      {signal.exitedAt ? formatRelativeTime(signal.exitedAt) : '—'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Watchlist */}
          <div className="watcher-section">
            <div className="watcher-section-label">
              <span>Watchlist</span>
              <button
                className="btn-icon add"
                onClick={() => setShowAddInput(v => !v)}
                disabled={watchlist.length >= MAX_WATCHLIST}
                title={watchlist.length >= MAX_WATCHLIST ? 'Watchlist full (20 max)' : 'Add coin'}
              >
                +
              </button>
            </div>

            {showAddInput && (
              <div className="coin-search-wrapper" ref={searchRef}>
                <input
                  className="watcher-search-input"
                  placeholder="Search coin..."
                  value={coinSearch}
                  onChange={handleSearchChange}
                  autoFocus
                />
                {showDropdown && coinSearch.length > 0 && (
                  <ul className="coin-dropdown">
                    {filteredCoins.length > 0
                      ? filteredCoins.map(coin => (
                          <li key={coin} onClick={() => handleSelect(coin)}>{coin}</li>
                        ))
                      : <li className="no-match">No matches</li>
                    }
                  </ul>
                )}
              </div>
            )}

            {watchlist.length === 0 ? (
              <div className="watcher-empty">No coins — click + to add</div>
            ) : (
              watchlist.map(symbol => (
                <div key={symbol} className="watcher-coin-row">
                  <span className="watcher-signal-sym">{symbol}</span>
                  <span className="watcher-signal-price mono">
                    {prices[symbol] != null ? `$${fmtPrice(prices[symbol])}` : '—'}
                  </span>
                  <button className="btn-icon del" onClick={() => onRemove(symbol)}>×</button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Append sidebar styles to `src/App.css`**

```css
/* ── Watcher Sidebar ── */
.watcher-overlay {
  position: fixed;
  inset: 0;
  z-index: 150;
  background: transparent;
}

.watcher-sidebar {
  position: fixed;
  top: 0;
  right: 0;
  height: 100vh;
  width: 300px;
  z-index: 160;
  background: var(--surface);
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  transform: translateX(100%);
  transition: transform 0.25s ease;
  box-shadow: -8px 0 32px rgba(0,0,0,0.4);
}
.watcher-sidebar.open {
  transform: translateX(0);
}

.watcher-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.watcher-title {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--accent);
}

.watcher-body {
  flex: 1;
  overflow-y: auto;
  padding: 0 0 24px;
}

.watcher-section {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}
.watcher-section:last-child {
  border-bottom: none;
}

.watcher-section-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted);
  margin-bottom: 10px;
}
.watcher-section-label span:first-child { flex: 1; }

.watcher-empty {
  font-size: 12px;
  color: var(--muted);
  padding: 4px 0;
}

.watcher-signal-card {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 6px;
}
.watcher-signal-card.current {
  border-color: rgba(52, 212, 138, 0.3);
  background: rgba(52, 212, 138, 0.05);
}
.watcher-signal-card.past {
  opacity: 0.7;
}

.watcher-signal-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}
.watcher-signal-sym {
  font-family: var(--mono);
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
}
.watcher-signal-price {
  font-size: 12px;
  color: var(--muted);
}
.watcher-signal-meta {
  display: flex;
  gap: 10px;
  font-size: 11px;
  font-family: var(--mono);
}
.watcher-signal-meta .pos { color: var(--green); }
.watcher-signal-meta .muted-text { color: var(--muted); }

.watcher-coin-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 0;
  border-bottom: 1px solid var(--border);
}
.watcher-coin-row:last-child { border-bottom: none; }
.watcher-coin-row .watcher-signal-sym { flex: 1; }

.watcher-search-input {
  width: 100%;
  background: var(--bg);
  border: 1px solid var(--border);
  color: var(--text);
  font-family: var(--sans);
  font-size: 13px;
  padding: 8px 12px;
  border-radius: 8px;
  outline: none;
  margin-bottom: 4px;
  transition: border-color 0.15s;
}
.watcher-search-input:focus { border-color: var(--accent); }

/* ── Watcher Toggle Button ── */
.watcher-toggle {
  position: fixed;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  z-index: 140;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-right: none;
  border-radius: 8px 0 0 8px;
  padding: 14px 9px;
  cursor: pointer;
  color: var(--muted);
  font-family: var(--mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  writing-mode: vertical-rl;
  text-orientation: mixed;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.watcher-toggle:hover {
  background: var(--surface2);
  border-color: var(--accent);
  color: var(--accent);
}
.watcher-toggle-badge {
  writing-mode: horizontal-tb;
  background: var(--red);
  color: #fff;
  border-radius: 50%;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  flex-shrink: 0;
}

@media (max-width: 600px) {
  .watcher-sidebar { width: 100vw; }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/WatcherSidebar.tsx src/App.css
git commit -m "feat: add WatcherSidebar component with signal panels and watchlist management"
```

---

## Task 6: Wire into `App.tsx`

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add imports at the top of `src/App.tsx`**

Add to the existing import block:

```typescript
import { useWatcher } from './hooks/useWatcher';
import WatcherSidebar from './components/WatcherSidebar';
import WatcherToast from './components/WatcherToast';
```

- [ ] **Step 2: Add `useWatcher` call and sidebar state inside the `App` function**

After the existing `const [addToTarget, setAddToTarget] = useState<Holding | null>(null);` line, add:

```typescript
const [watcherOpen, setWatcherOpen] = useState(false);
const {
  watchlist,
  currentSignals,
  pastSignals,
  prices: watcherPrices,
  activeToast,
  addToWatchlist,
  removeFromWatchlist,
  dismissToast,
} = useWatcher();
```

- [ ] **Step 3: Add the toggle button inside the JSX**

In the `return (...)` block, after `<InstallPrompt />` and before the modals, add:

```tsx
{/* Watcher Toggle */}
{!watcherOpen && (
  <button className="watcher-toggle" onClick={() => setWatcherOpen(true)}>
    WATCHER
    {currentSignals.length > 0 && (
      <span className="watcher-toggle-badge">{currentSignals.length}</span>
    )}
  </button>
)}

{/* Watcher Sidebar */}
<WatcherSidebar
  isOpen={watcherOpen}
  onClose={() => setWatcherOpen(false)}
  watchlist={watchlist}
  currentSignals={currentSignals}
  pastSignals={pastSignals}
  prices={watcherPrices}
  onAdd={addToWatchlist}
  onRemove={removeFromWatchlist}
/>

{/* Watcher Toast */}
<WatcherToast signal={activeToast} onDismiss={dismissToast} />
```

- [ ] **Step 4: Verify TypeScript compiles without errors**

```bash
cd d:/Code/Git/crypto-tracker && npx tsc --noEmit 2>&1
```

Expected: No output (no errors).

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire crypto watcher into App — toggle, sidebar, toast"
```

---

## Task 7: Verify End-to-End

- [ ] **Step 1: Start dev server and smoke-test**

```bash
cd d:/Code/Git/crypto-tracker && npm start
```

Open http://localhost:50001 and verify:
1. "WATCHER" tab button is visible on the right edge of the screen
2. Clicking it slides open the sidebar with 3 empty panels
3. Search and add a coin (e.g. BTC) — it appears in the Watchlist with a live price
4. Remove the coin — it disappears from the list
5. Adding 20 coins disables the + button with the tooltip
6. ✕ button closes the sidebar; the WATCHER tab reappears

- [ ] **Step 2: Run all tests**

```bash
cd d:/Code/Git/crypto-tracker && npx react-scripts test --watchAll=false 2>&1 | tail -20
```

Expected: All tests pass.

- [ ] **Step 3: Final commit if any last-minute fixes were needed**

```bash
git add -p
git commit -m "fix: watcher smoke-test corrections"
```

(Skip this step if no corrections were needed.)
