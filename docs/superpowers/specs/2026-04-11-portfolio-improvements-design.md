---
title: Portfolio Improvements — 5 Changes
date: 2026-04-11
status: approved
---

# Portfolio Improvements Design

## Overview

Five targeted changes to the crypto-tracker UI: remove unused signal/recommendation system, compact the summary cards, fix the default sort order, add delete confirmation, and introduce an "Add to Position" flow for averaging into existing holdings.

---

## 1. Remove Signal Logic

**What is removed:**
- `src/hooks/useRecommendations.ts` — deleted entirely
- `src/utils/indicators.ts` — deleted entirely
- `Recommendation`, `SignalDetail`, `RecommendationDetail` types from `src/types.ts`
- `useRecommendations` import + call in `App.tsx`
- `recommendation` prop from `HoldingRow` (Props interface, JSX, tooltip state, refs, effects, `handleBadgeClick`)
- "Signal" column header from the list header in `App.tsx`
- All signal/recommendation CSS classes from `App.css`

**Result:** HoldingRow has 7 columns (Asset, Avg Price, Live Price, Value, P&L, 24h Vol, actions) — no signal badge, no tooltip.

---

## 2. Compact Summary Cards

**What changes in `App.css`:**
- `.card` padding: `20px` → `12px 16px`
- `.card-label` font-size: `11px` → `10px`; margin-bottom: `8px` → `4px`
- `.card-value` font-size: `22px` → `16px`
- `.card-pct` font-size: `13px` → `11px`
- `.summary-grid` gap: `14px` → `10px`; margin-bottom: `32px` → `20px`

**Result:** Cards feel like a compact status bar rather than hero panels.

---

## 3. Default Sort by Name

**What changes in `App.tsx`:**
- `useState<SortKey>('value')` → `useState<SortKey>('name')`

---

## 4. Confirm Before Delete

**What changes in `HoldingRow.tsx`:**
- The ✕ delete button's `onClick` changes from `() => onDelete(symbol)` to:
  ```ts
  () => { if (window.confirm(`Remove ${symbol} from portfolio?`)) onDelete(symbol); }
  ```

---

## 5. Add to Position Flow

### New function: `addToHolding` in `usePortfolio.ts`

```ts
const addToHolding = (symbol: string, newPrice: number, newQty: number): void => {
  setHoldings(prev => prev.map(h => {
    if (h.symbol !== symbol) return h;
    const totalQty = h.qty + newQty;
    const newAvgPrice = (h.avgPrice * h.qty + newPrice * newQty) / totalQty;
    return { symbol, avgPrice: newAvgPrice, qty: totalQty };
  }));
};
```

Returns `{ holdings, addOrUpdateHolding, removeHolding, addToHolding }`.

### New component: `AddToPositionModal.tsx`

A focused modal that:
- Receives `holding: Holding` (current position) and `onConfirm: (newPrice: number, newQty: number) => void` and `onClose: () => void`
- Displays current avg price and qty as read-only context
- Has two inputs: "New Buy Price (USD)" and "Qty Bought"
- Shows a live preview: "New average: $X at Y units total" computed from the weighted average formula
- On submit, calls `onConfirm(newPrice, newQty)` then `onClose()`

### Changes in `HoldingRow.tsx`

- Add `onAddTo: (holding: Holding) => void` prop
- Add "+" icon button in `.row-actions` before the edit button: `<button className="btn-icon add" onClick={() => onAddTo(holding)} title="Add to position">＋</button>`

### Changes in `App.tsx`

- Import `AddToPositionModal` and `addToHolding` from the hook
- Add state: `const [addToTarget, setAddToTarget] = useState<Holding | null>(null)`
- Handler: `const handleAddTo = (holding: Holding) => setAddToTarget(holding)`
- Pass `onAddTo={handleAddTo}` to each `HoldingRow`
- Render `AddToPositionModal` when `addToTarget !== null`, wired to `addToHolding`

---

## Files Changed / Created

| File | Action |
|------|--------|
| `src/hooks/useRecommendations.ts` | Delete |
| `src/utils/indicators.ts` | Delete |
| `src/types.ts` | Remove signal types |
| `src/App.tsx` | Remove signal wiring; default sort; add addTo state/handlers |
| `src/App.css` | Compact card styles; remove signal CSS |
| `src/components/HoldingRow.tsx` | Remove signal column/tooltip; add delete confirm; add onAddTo button |
| `src/hooks/usePortfolio.ts` | Add `addToHolding` |
| `src/components/AddToPositionModal.tsx` | Create new |
