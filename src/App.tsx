import React, { useState, useMemo, useEffect } from 'react';
import './App.css';
import { usePortfolio } from './hooks/usePortfolio';
import { useWatchlist } from './hooks/useWatchlist';
import { useCryptoPrices } from './hooks/useCryptoPrices';
import HoldingRow from './components/HoldingRow';
import AddEditModal from './components/AddEditModal';
import WatchlistPanel from './components/WatchlistPanel';
import TradeHistoryPanel from './components/TradeHistoryPanel';
import { Holding, EnrichedHolding, SortKey, TradeType } from './types';
import LiveCandlestickChart from './components/LiveCandlestickChart';
import CloseTradeModal from './components/CloseTradeModal';
import AddToPositionModal from './components/AddToPositionModal';
import { useMomentum } from './hooks/useMomentum';
import MarketPulseSidebar from './components/MarketPulseSidebar';
import PriceFocusView from './components/PriceFocusView';
import { useNetworkLog } from './hooks/useNetworkLog';
import NetworkConsolePanel from './components/NetworkConsolePanel';
import { useTradeHistory } from './hooks/useTradeHistory';
type ActiveTab = 'holdings' | 'watchlist' | 'history';


function fmtTitlePrice(price: number): string {
  if (price >= 100) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 1) return price.toFixed(4);
  return price.toFixed(6);
}

function fmt(n: number | undefined, decimals = 2): string {
  if (n === undefined || isNaN(n)) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function enrichHolding(holding: Holding, livePrice: number | undefined): EnrichedHolding {
  const isShort = holding.type === 'short';
  const invested = holding.avgPrice * holding.qty;
  const currentValue = livePrice != null ? livePrice * holding.qty : null;
  // Short P&L is inverted: profit when price falls below entry
  const pnl = currentValue !== null
    ? (isShort ? invested - currentValue : currentValue - invested)
    : null;
  const pnlPct = pnl !== null && invested > 0 ? (pnl / invested) * 100 : null;
  return { ...holding, livePrice, invested, currentValue, pnl, pnlPct };
}

function sortHoldings(holdings: EnrichedHolding[], sortBy: SortKey): EnrichedHolding[] {
  return [...holdings].sort((a, b) => {
    if (sortBy === 'value') return (b.currentValue ?? 0) - (a.currentValue ?? 0);
    if (sortBy === 'pnl') return (b.pnl ?? 0) - (a.pnl ?? 0);
    if (sortBy === 'pnlpct') return (b.pnlPct ?? 0) - (a.pnlPct ?? 0);
    return a.symbol.localeCompare(b.symbol);
  });
}

export default function App() {
  const { holdings, addOrUpdateHolding, addToHolding, removeHolding } = usePortfolio();
  const { watchlist, addToWatchlist, removeFromWatchlist } = useWatchlist();
  const { trades, addTrade, clearHistory } = useTradeHistory();

  const [activeTab, setActiveTab] = useState<ActiveTab>(() => holdings.length === 0 ? 'watchlist' : 'holdings');
  const [showModal, setShowModal] = useState(false);
  const [modalTradeType, setModalTradeType] = useState<TradeType>('long');
  const [editTarget, setEditTarget] = useState<Holding | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>('name');
  const [chartSymbol, setChartSymbol] = useState<string | null>(null);
  const [closeTradeTarget, setCloseTradeTarget] = useState<Holding | null>(null);
  const [addToTarget, setAddToTarget] = useState<Holding | null>(null);
  const [pulseOpen, setPulseOpen] = useState(false);
  const [focusSymbol, setFocusSymbol] = useState<string | null>(null);

  const allSymbols = useMemo(
    () => Array.from(new Set([...holdings.map(h => h.symbol), ...watchlist])),
    [holdings, watchlist]
  );

  const { prices, prevPrices, volumes, change24h, high24h, low24h, trades24h } = useCryptoPrices(allSymbols);
  const { momentumRows, stressEvents } = useMomentum(allSymbols, prices, volumes);
  const { entries: netEntries, clearEntries } = useNetworkLog();

  const enriched = useMemo(
    () => holdings.map(h => enrichHolding(h, prices[h.symbol])),
    [holdings, prices]
  );

  const sorted = useMemo(() => sortHoldings(enriched, sortBy), [enriched, sortBy]);

  const totals = useMemo(() => {
    const totalInvested = enriched.reduce((s, h) => s + h.invested, 0);
    const totalPnl = enriched.reduce((s, h) => s + (h.pnl ?? 0), 0);
    const totalPct = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;
    return { totalPnl, totalPct };
  }, [enriched]);

  const chartLivePrice = chartSymbol ? prices[chartSymbol] : undefined;
  useEffect(() => {
    if (!chartSymbol) {
      document.title = 'Crypto Tracker';
      return () => { document.title = 'Crypto Tracker'; };
    }
    const base = chartSymbol.replace(/USDT$/, '');
    document.title = chartLivePrice !== undefined
      ? `${base} $${fmtTitlePrice(chartLivePrice)} | Crypto Tracker`
      : `${base} | Crypto Tracker`;
    return () => { document.title = 'Crypto Tracker'; };
  }, [chartSymbol, chartLivePrice]);

  const handleOpenBuy = (): void => { setModalTradeType('long'); setEditTarget(null); setShowModal(true); };
  const handleOpenShort = (): void => { setModalTradeType('short'); setEditTarget(null); setShowModal(true); };
  const handleEdit = (holding: Holding): void => { setEditTarget(holding); setShowModal(true); };
  const handleClose = (): void => { setShowModal(false); setEditTarget(null); };
  const handleViewChart = (symbol: string): void => setChartSymbol(symbol);
  const handleCloseChart = (): void => setChartSymbol(null);
  const handleOpenCloseTrade = (holding: Holding): void => setCloseTradeTarget(holding);
  const handleCloseTradeModal = (): void => setCloseTradeTarget(null);

  const handleConfirmCloseTrade = (symbol: string, closePrice: number): void => {
    const h = closeTradeTarget!;
    const isShort = h.type === 'short';
    const invested = h.avgPrice * h.qty;
    const closeValue = closePrice * h.qty;
    const pnl = isShort ? invested - closeValue : closeValue - invested;
    const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;
    addTrade({ symbol, side: h.type ?? 'long', qty: h.qty, entryPrice: h.avgPrice, closePrice, pnl, pnlPct, closedAt: Date.now() });
    removeHolding(symbol);
    setCloseTradeTarget(null);
  };

  const handleAddTo = (holding: Holding): void => setAddToTarget(holding);
  const handleCloseAddTo = (): void => setAddToTarget(null);

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-icon">◈</span>
            <span>Portfolio</span>
          </div>
          <div className="header-right">
            <div className="live-badge">
              <span className="pulse-dot" />
              LIVE
            </div>
          </div>
        </div>
      </header>

      <main className="main">
        {/* Summary Cards */}
        <div className="summary-grid">
          <div className={`card highlight pnl-card ${totals.totalPnl >= 0 ? 'pos' : 'neg'}`}>
            <span className="card-label">Total P&L</span>
            <span className="card-value mono">
              {totals.totalPnl >= 0 ? '+' : ''}${fmt(Math.abs(totals.totalPnl))}
              <span className="card-pct"> ({totals.totalPct >= 0 ? '+' : ''}{fmt(totals.totalPct)}%)</span>
            </span>
          </div>
        </div>

        {/* Holdings + Watchlist Panel */}
        <div className="table-section">
          {/* Holdings tab */}
          {activeTab === 'holdings' && (
            holdings.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">◈</div>
                <p>No holdings yet</p>
                <p className="empty-sub">Add your first crypto to start tracking</p>
                <div className="empty-actions">
                  <button className="btn long-btn" onClick={handleOpenBuy}>↑ Long</button>
                  <button className="btn short-btn" onClick={handleOpenShort}>↓ Short</button>
                </div>
              </div>
            ) : (
              <div className="holdings-list">
                <div className="holdings-toolbar">
                  <select
                    className="sort-select"
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value as SortKey)}
                  >
                    <option value="value">Sort: Value</option>
                    <option value="pnl">Sort: P&L $</option>
                    <option value="pnlpct">Sort: P&L %</option>
                    <option value="name">Sort: Name</option>
                  </select>
                  <div className="toolbar-actions">
                    <button className="btn short-btn" onClick={handleOpenShort}>↓ Short</button>
                    <button className="btn long-btn" onClick={handleOpenBuy}>↑ Long</button>
                  </div>
                </div>
                {sorted.map(h => (
                  <HoldingRow
                    key={h.symbol}
                    holding={h}
                    livePrice={h.livePrice}
                    prevPrice={prevPrices[h.symbol]}
                    onEdit={handleEdit}
                    onDelete={removeHolding}
                    onViewChart={handleViewChart}
                    onCloseTrade={handleOpenCloseTrade}
                    onAddTo={handleAddTo}
                    onFocusPrice={setFocusSymbol}
                  />
                ))}
              </div>
            )
          )}

          {/* Watchlist tab */}
          {activeTab === 'watchlist' && (
            <WatchlistPanel
              watchlist={watchlist}
              prices={prices}
              prevPrices={prevPrices}
              change24h={change24h}
              volumes={volumes}
              high24h={high24h}
              low24h={low24h}
              trades24h={trades24h}
              momentumRows={momentumRows}
              onAdd={addToWatchlist}
              onRemove={removeFromWatchlist}
              onViewChart={handleViewChart}
            />
          )}

          {/* History tab */}
          {activeTab === 'history' && (
            <TradeHistoryPanel trades={trades} onClear={clearHistory} />
          )}

        </div>
      </main>

      {/* Market Pulse Toggle */}
      {!pulseOpen && (
        <button className="watcher-toggle" onClick={() => setPulseOpen(true)}>
          PULSE
          {stressEvents.length > 0 && (
            <span className="watcher-toggle-badge">{stressEvents.length}</span>
          )}
        </button>
      )}

      {/* Market Pulse Sidebar */}
      <MarketPulseSidebar
        isOpen={pulseOpen}
        onClose={() => setPulseOpen(false)}
        stressEvents={stressEvents}
      />

      {showModal && (
        <AddEditModal
          existing={editTarget}
          tradeType={modalTradeType}
          prices={prices}
          onSave={(symbol, avgPrice, qty, stopLoss, type) => addOrUpdateHolding(symbol, avgPrice, qty, stopLoss, type)}
          onClose={handleClose}
        />
      )}

      {closeTradeTarget && (
        <CloseTradeModal
          holding={closeTradeTarget}
          livePrice={prices[closeTradeTarget.symbol]}
          onConfirm={handleConfirmCloseTrade}
          onClose={handleCloseTradeModal}
        />
      )}

      {addToTarget && (
        <AddToPositionModal
          holding={addToTarget}
          onConfirm={(newPrice, newQty) => addToHolding(addToTarget.symbol, newPrice, newQty)}
          onClose={handleCloseAddTo}
        />
      )}

      {chartSymbol && (
        <LiveCandlestickChart
          symbol={chartSymbol}
          avgPrice={holdings.find(h => h.symbol === chartSymbol)?.avgPrice}
          stopLoss={holdings.find(h => h.symbol === chartSymbol)?.stopLoss}
          livePrice={prices[chartSymbol]}
          onClose={handleCloseChart}
        />
      )}

      <nav className="bottom-nav">
        <button
          className={`bottom-nav-btn${activeTab === 'holdings' ? ' active' : ''}`}
          onClick={() => setActiveTab('holdings')}
        >
          My Holdings
          {holdings.length > 0 && <span className="tab-count">{holdings.length}</span>}
        </button>
        <button
          className={`bottom-nav-btn${activeTab === 'watchlist' ? ' active' : ''}`}
          onClick={() => setActiveTab('watchlist')}
        >
          Watchlist
          {watchlist.length > 0 && <span className="tab-count">{watchlist.length}</span>}
        </button>
        <button
          className={`bottom-nav-btn${activeTab === 'history' ? ' active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          History
          {trades.length > 0 && <span className="tab-count">{trades.length}</span>}
        </button>
      </nav>

      {!focusSymbol && (
        <NetworkConsolePanel entries={netEntries} onClear={clearEntries} />
      )}

      {focusSymbol && (
        <PriceFocusView
          symbol={focusSymbol}
          livePrice={prices[focusSymbol]}
          onClose={() => setFocusSymbol(null)}
        />
      )}
    </div>
  );
}
