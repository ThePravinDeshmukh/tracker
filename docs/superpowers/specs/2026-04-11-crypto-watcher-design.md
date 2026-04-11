# Crypto Watcher — Design Spec

**Date:** 2026-04-11
**Status:** Approved

---

## Overview

A collapsible sidebar panel on the home page that scans a user-configured watchlist for buy opportunities in real time. A signal fires when a coin's price is rising AND its volume is spiking simultaneously. Signals are tracked as live state — coins are either currently worth buying or were previously worth buying.

---

## Architecture

### New Files

```
src/
  hooks/
    useWatcher.ts          # watchlist state, WebSocket, signal detection
  components/
    WatcherSidebar.tsx     # collapsible sidebar UI
    WatcherToast.tsx       # brief toast popup for new signals
  types.ts                 # add WatchedCoin, WatcherSignal interfaces
  App.tsx                  # add toggle button + badge, render sidebar + toast
  App.css                  # sidebar, badge, toast styles
```

### Responsibility Split

- `useWatcher` — owns all data: persists watchlist to localStorage, opens its own Binance WebSocket for watcher symbols (same pattern as `useCryptoPrices`), maintains rolling price history and volume history per coin, computes signal state on every tick.
- `WatcherSidebar` — pure UI: receives signal lists and watchlist from `useWatcher`, renders the three panels.
- `WatcherToast` — renders a brief notification when a new coin enters current signals.
- `App.tsx` — orchestrator only: calls `useWatcher`, manages sidebar open/closed state, passes props down.

---

## New Types

```ts
// types.ts additions

interface WatcherSignal {
  symbol: string;
  price: number;
  priceChangePct: number;   // e.g. 2.4 means +2.4%
  volumeRatio: number;      // e.g. 1.8 means 1.8× rolling average
  enteredAt: number;        // unix ms — when coin entered current signals
  exitedAt?: number;        // unix ms — set when coin moves to past signals
}

interface WatchedCoin {
  symbol: string;
}
```

---

## Signal Detection Logic

Both conditions must be simultaneously true for a coin to appear in Current Signals.

### Condition 1 — Price Momentum

- `useWatcher` stores a rolling buffer of price ticks with timestamps for each watched coin (up to 10 minutes of history).
- Condition is met when: `(currentPrice - price5MinutesAgo) / price5MinutesAgo >= 0.02` (≥ +2% in 5 minutes).
- If fewer than 5 minutes of data exist for a coin, the condition is not evaluated.

### Condition 2 — Volume Spike

- `useWatcher` stores the last 10 volume readings per coin (24h quote asset volume from Binance ticker).
- Rolling average = mean of those 10 readings.
- Condition is met when: `currentVolume >= rollingAverage * 1.5` (≥ 1.5× average).
- If fewer than 3 readings exist for a coin, the condition is not evaluated.

### Signal State Transitions

- **Enter Current Signals:** both conditions become true in the same tick.
- **Exit Current Signals → Past Signals:** either condition drops below its threshold. `exitedAt` is set to the current timestamp.
- Past Signals are kept in memory only — they do not persist across page refresh.
- Maximum 20 past signal entries retained (oldest dropped when exceeded).

---

## Sidebar UI

A fixed-width panel (300px) anchored to the right edge of the screen. Slides in/out with a CSS transition.

### Toggle Button

- Fixed to the right edge, always visible regardless of scroll position.
- Label: "Watcher".
- When sidebar is closed and there are current signals: shows a red badge with the signal count.

### Sidebar Panels (top to bottom)

**1. Current Signals**
- Header: "Current Signals (N)" with a red dot indicator.
- Each entry shows: coin symbol, live price, price change %, volume ratio.
- Empty state: "No active signals" in muted text.

**2. Past Signals**
- Header: "Past Signals".
- Each entry shows: coin symbol, the price recorded at the moment it exited current signals, and relative time since it exited (e.g. "4 min ago").
- Empty state: "None yet" in muted text.

**3. Watchlist**
- Header: "Watchlist" with an "+ Add" button.
- Each coin shows: symbol, live price, and a remove (×) button.
- Add flow: clicking "+ Add" reveals a search input with a coin dropdown (same supported coin list as `AddEditModal`). Selecting a coin adds it immediately.
- Max 20 coins. If at limit, "+ Add" is disabled with a tooltip "Watchlist full (20 max)".

---

## Toast Notification

- Appears bottom-right when a new coin enters Current Signals.
- Content: coin symbol, price, "+X.X% in 5min", "X.Xx vol".
- Auto-dismisses after 4 seconds.
- At most one toast visible at a time — if a second signal fires while a toast is showing, it queues and shows after the current one dismisses.

---

## Persistence

- Watchlist symbols persisted to `localStorage` under key `watcher-watchlist`.
- Signal lists (current and past) are in-memory only — reset on page refresh.

---

## Constraints

- Max 20 coins in the watchlist.
- `useWatcher` opens its own WebSocket connection(s) separate from `useCryptoPrices`, following the same spot/futures routing logic. It calls `useAvailablePairs` internally to determine which symbols route to spot vs futures streams.
- No new dependencies — uses existing Binance WebSocket infrastructure patterns.
- Sidebar width: 300px on desktop. On mobile (viewport < 600px), sidebar takes full width.
