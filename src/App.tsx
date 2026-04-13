import React, { useState, useMemo } from 'react';
import './App.css';
import { usePortfolio } from './hooks/usePortfolio';
import { useCryptoPrices } from './hooks/useCryptoPrices';
import HoldingRow from './components/HoldingRow';
import AddEditModal from './components/AddEditModal';
import { Holding, EnrichedHolding, SortKey } from './types';
import InstallPrompt from './components/InstallPrompt';
import AssetChart from './components/AssetChart';
import CloseTradeModal from './components/CloseTradeModal';
import AddToPositionModal from './components/AddToPositionModal';
import { useMomentum } from './hooks/useMomentum';
import MarketPulseSidebar from './components/MarketPulseSidebar';

function fmt(n: number | undefined, decimals = 2): string {
  if (n === undefined || isNaN(n)) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function enrichHolding(holding: Holding, livePrice: number | undefined): EnrichedHolding {
  const invested = holding.avgPrice * holding.qty;
  const currentValue = livePrice != null ? livePrice * holding.qty : null;
  const pnl = currentValue !== null ? currentValue - invested : null;
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
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Holding | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>('name');
  const [chartSymbol, setChartSymbol] = useState<string | null>(null);
  const [closeTradeTarget, setCloseTradeTarget] = useState<Holding | null>(null);
  const [addToTarget, setAddToTarget] = useState<Holding | null>(null);
  const [pulseOpen, setPulseOpen] = useState(false);

  const symbols = useMemo(() => holdings.map(h => h.symbol), [holdings]);
  const { prices, prevPrices, volumes } = useCryptoPrices(symbols);
  const { momentumRows, stressEvents, computeCorrelations } = useMomentum(symbols, prices);

  const enriched = useMemo(
    () => holdings.map(h => enrichHolding(h, prices[h.symbol])),
    [holdings, prices]
  );

  const sorted = useMemo(() => sortHoldings(enriched, sortBy), [enriched, sortBy]);

  const totals = useMemo(() => {
    const totalInvested = enriched.reduce((s, h) => s + h.invested, 0);
    const totalValue = enriched.reduce((s, h) => s + (h.currentValue ?? 0), 0);
    const totalPnl = enriched.reduce((s, h) => s + (h.pnl ?? 0), 0);
    const totalPct = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;
    return { totalInvested, totalValue, totalPnl, totalPct };
  }, [enriched]);

  const handleEdit = (holding: Holding): void => {
    setEditTarget(holding);
    setShowModal(true);
  };

  const handleClose = (): void => {
    setShowModal(false);
    setEditTarget(null);
  };

  const handleViewChart = (symbol: string): void => setChartSymbol(symbol);
  const handleCloseChart = (): void => setChartSymbol(null);
  const handleOpenCloseTrade = (holding: Holding): void => setCloseTradeTarget(holding);
  const handleCloseTradeModal = (): void => setCloseTradeTarget(null);
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
          <div className="live-badge">
            <span className="pulse-dot" />
            LIVE
          </div>
        </div>
      </header>

      <main className="main">
        {/* Summary Cards */}
        <div className="summary-grid">
          <div className="card">
            <div className="card-label">Total Invested</div>
            <div className="card-value mono">${fmt(totals.totalInvested)}</div>
          </div>
          <div className="card">
            <div className="card-label">Current Value</div>
            <div className="card-value mono">${fmt(totals.totalValue)}</div>
          </div>
          <div className={`card highlight ${totals.totalPnl >= 0 ? 'pos' : 'neg'}`}>
            <div className="card-label">Total P&L</div>
            <div className="card-value mono">
              {totals.totalPnl >= 0 ? '+' : ''}${fmt(Math.abs(totals.totalPnl))}
              <span className="card-pct"> ({totals.totalPct >= 0 ? '+' : ''}{fmt(totals.totalPct)}%)</span>
            </div>
          </div>
          <div className="card">
            <div className="card-label">Holdings</div>
            <div className="card-value mono">{holdings.length}</div>
          </div>
        </div>

        {/* Holdings Table */}
        <div className="table-section">
          <div className="table-header">
            <h2>My Holdings</h2>
            <div className="table-controls">
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
              <button className="btn primary" onClick={() => setShowModal(true)}>
                + Add Coin
              </button>
            </div>
          </div>

          {holdings.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">◈</div>
              <p>No holdings yet</p>
              <p className="empty-sub">Add your first crypto to start tracking</p>
              <button className="btn primary" onClick={() => setShowModal(true)}>Add Coin</button>
            </div>
          ) : (
            <div className="holdings-list">
              <div className="list-header">
                <span>Asset</span>
                <span>Avg Price</span>
                <span>Live Price</span>
                <span>Value</span>
                <span>P&amp;L</span>
                <span></span>
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
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <InstallPrompt />

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
        rows={momentumRows}
        stressEvents={stressEvents}
        computeCorrelations={computeCorrelations}
        symbols={symbols}
      />

      {showModal && (
        <AddEditModal
          existing={editTarget}
          onSave={addOrUpdateHolding}
          onClose={handleClose}
        />
      )}

      {closeTradeTarget && (
        <CloseTradeModal
          holding={closeTradeTarget}
          livePrice={prices[closeTradeTarget.symbol]}
          onConfirm={removeHolding}
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
        <AssetChart
          symbol={chartSymbol}
          avgPrice={holdings.find(h => h.symbol === chartSymbol)?.avgPrice ?? 0}
          livePrice={prices[chartSymbol]}
          liveVolume={volumes[chartSymbol]}
          onClose={handleCloseChart}
        />
      )}
    </div>
  );
}
