# Claude Code — Project Guide: crypto-tracker

## Project Overview

A real-time crypto portfolio tracker built with React. Prices stream via Binance WebSocket with a REST fallback. Portfolio state is persisted to `localStorage`.

**Stack:** React 18, TypeScript 4.9, react-scripts (CRA), Binance WebSocket API
**Dev server:** `npm start` → http://localhost:50001

---

## Project Structure

```
src/
  types.ts        # Shared interfaces: Holding, EnrichedHolding, PriceMap, SortKey
  hooks/          # Data fetching and state logic (no JSX) — .ts files
  components/     # UI building blocks (pure presentational where possible) — .tsx files
  App.tsx         # Root composition — wires hooks + components together
  App.css         # Global styles and component-scoped classes
  index.css       # CSS variables and resets
  react-app-env.d.ts  # CRA type reference
```

---

## TypeScript

- **All source files must be `.ts` or `.tsx`** — no `.js` files in `src/`.
- **No `any`.** If a type is unknown, use `unknown` and narrow it. Cast with `as` only at system boundaries (e.g., JSON from API, DOM queries).
- **Shared types live in `src/types.ts`.** Do not re-declare the same shape in multiple files.
- **Props interfaces are defined in the same file as the component** — no need to export them unless shared.
- **Prefer `interface` over `type` for object shapes**; use `type` for unions, aliases, and mapped types.
- `strict: true` is enabled — no implicit `any`, no unchecked null access.

---

## Coding Practices

### Clean Code

- **Names must communicate intent.** A reader should understand what a variable or function does without reading its implementation. Avoid abbreviations (`h`, `s`, `r`) in new code — prefer `holding`, `symbol`, `result`.
- **No magic numbers or strings.** Extract constants at the top of the file or into a dedicated `constants.js` module.
- **One level of abstraction per function.** A function that fetches data should not also format it for display. Keep layers separate.
- **Avoid boolean flags as function arguments.** `renderPrice(price, true)` is unreadable. Use named options or separate functions instead.
- **Delete dead code.** Do not comment out code — use git history to recover it if needed.

### Small, Reusable Functions

- Each function should do **one thing**. If you need "and" to describe it, split it.
- Keep functions short — aim for under 20 lines. If a function grows beyond that, look for a natural split.
- **Pure functions are preferred.** A function that takes inputs and returns a value (no side effects) is easier to test, reuse, and reason about.
- Place shared pure utilities in `src/utils/` (e.g., `formatters.js`, `math.js`). Do not duplicate formatting or calculation logic across files.

```js
// Good — small, pure, reusable
export function calcPnl(avgPrice, qty, livePrice) {
  const invested = avgPrice * qty;
  const current = livePrice * qty;
  return { invested, current, pnl: current - invested, pnlPct: ((current - invested) / invested) * 100 };
}

// Bad — mixed concerns
function renderRow(holding, price) {
  const pnl = (price - holding.avgPrice) * holding.qty; // calculation inside render
  return <div>{pnl > 0 ? '+' : ''}{pnl.toFixed(2)}</div>;
}
```

### Testable Code

- **Keep side effects at the edges.** Business logic (calculations, filtering, sorting) must live in pure functions or hooks, not inside JSX.
- **Hooks should be independently testable.** `useCryptoPrices` and `usePortfolio` should have no JSX dependencies — they can be tested with `renderHook`.
- **Never test implementation details.** Test what a function returns or what the user sees, not internal state.
- Calculation functions in `src/utils/` must have corresponding unit tests.
- When adding a new feature, write a test case that would catch a regression before writing the implementation.

### Modular Architecture

Split code by **responsibility**, not by file type:

```
src/
  hooks/
    useCryptoPrices.js   # WebSocket connection + price state
    usePortfolio.js      # CRUD + localStorage persistence
  components/
    HoldingRow.js        # Single row display
    AddEditModal.js      # Add/edit form with coin search
    SummaryCards.js      # Portfolio totals (extract from App.js when it grows)
  utils/
    formatters.js        # fmt(), formatPct(), formatSign()
    portfolio.js         # calcPnl(), enrichHolding(), sortHoldings()
  constants/
    coins.js             # COIN_IDS, SUPPORTED_COINS, COIN_COLORS, getCoinIcon
```

- `App.js` is an **orchestrator only** — it imports hooks and components, passes props, handles modal state. It must not contain business logic.
- If a component file exceeds ~150 lines, it is doing too much — split it.
- CSS classes stay co-located with the component that owns them (or in `App.css` for shared layout primitives).

---

## What to Avoid

- **God components** — do not add more logic to `App.js`. Extract instead.
- **Inline calculations inside JSX** — move them into `useMemo` or a utility function.
- **Duplicated formatting** — `fmt()` is the single source of truth for number display.
- **Hardcoded coin data scattered across files** — all coin metadata (IDs, colors, icons) lives in `src/hooks/useCryptoPrices.js` (or a future `src/constants/coins.js`).
- **Direct `localStorage` access outside `usePortfolio`** — all persistence goes through that hook.

---

## Naming Conventions

| Thing | Convention | Example |
|---|---|---|
| React components | PascalCase | `HoldingRow`, `AddEditModal` |
| Hooks | camelCase with `use` prefix | `useCryptoPrices` |
| Utility functions | camelCase, verb-noun | `calcPnl`, `formatPrice` |
| Constants | SCREAMING_SNAKE_CASE | `COIN_IDS`, `SUPPORTED_COINS` |
| CSS classes | kebab-case | `.holding-row`, `.coin-dropdown` |

---

## Adding a New Coin

1. Add to `COIN_IDS` in `src/hooks/useCryptoPrices.js` — key is the ticker, value is the Binance pair.
2. Add an entry in `getCoinIcon()` and `COIN_COLORS`.
3. Verify the pair exists on Binance before committing.
