import React, { useState, useEffect, useRef } from 'react';
import { useAvailablePairs } from '../hooks/useAvailablePairs';
import { Holding, TradeType, PriceMap } from '../types';

const SPOT_PRICE_URL = 'https://api.binance.com/api/v3/ticker/price';
const FUTURES_PRICE_URL = 'https://fapi.binance.com/fapi/v1/ticker/price';

async function fetchLivePrice(symbol: string, isSpot: boolean): Promise<number> {
  const pair = `${symbol.toUpperCase()}USDT`;
  const url = isSpot ? SPOT_PRICE_URL : FUTURES_PRICE_URL;
  const res = await fetch(`${url}?symbol=${pair}`);
  if (!res.ok) throw new Error(`Price not found for ${symbol}`);
  const data = await res.json() as { price: string };
  return parseFloat(data.price);
}

interface Props {
  existing: Holding | null;
  tradeType?: TradeType;
  prices: PriceMap;
  onSave: (symbol: string, avgPrice: string, qty: string, stopLoss: string, type: TradeType) => void;
  onClose: () => void;
}

export default function AddEditModal({ existing, tradeType = 'long', prices, onSave, onClose }: Props) {
  const [symbol, setSymbol] = useState(existing?.symbol ?? '');
  const [coinSearch, setCoinSearch] = useState(existing?.symbol ?? '');
  const [showDropdown, setShowDropdown] = useState(false);
  const [avgPrice, setAvgPrice] = useState(existing?.avgPrice ? String(existing.avgPrice) : '');
  const [qty, setQty] = useState(existing?.qty ? String(existing.qty) : '');
  const [stopLoss, setStopLoss] = useState(existing?.stopLoss ? String(existing.stopLoss) : '');
  const [error, setError] = useState('');
  const [fetchingPrice, setFetchingPrice] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const effectiveType: TradeType = existing?.type ?? tradeType;
  const isShort = effectiveType === 'short';

  const { allSymbols, spotSymbols, loading: loadingCoins } = useAvailablePairs();
  const spotSymbolSet = React.useMemo(() => new Set(spotSymbols), [spotSymbols]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredCoins = allSymbols.filter(c =>
    c.toLowerCase().includes(coinSearch.toLowerCase())
  );

  const handleCoinSelect = (coin: string): void => {
    setSymbol(coin);
    setCoinSearch(coin);
    setShowDropdown(false);
    setError('');
    if (prices[coin] != null) {
      setAvgPrice(String(prices[coin]));
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const val = e.target.value.toUpperCase();
    setCoinSearch(val);
    setSymbol('');
    setShowDropdown(true);
    setError('');
    if (allSymbols.includes(val)) {
      setSymbol(val);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    if (!symbol) return setError('Select a coin from the list');
    if (!avgPrice || parseFloat(avgPrice) <= 0) return setError(`Enter a valid ${isShort ? 'entry' : 'avg'} price`);
    if (!qty || parseFloat(qty) <= 0) return setError('Enter a valid quantity');
    onSave(symbol, avgPrice, qty, stopLoss, effectiveType);
    onClose();
  };

  const modalTitle = existing
    ? (isShort ? 'Edit Short Position' : 'Edit Holding')
    : (isShort ? 'Open Short Position' : 'Add Holding');

  const priceLabel = isShort ? 'Entry Price (USD)' : 'Avg Buy Price (USD)';
  const qtyLabel = isShort ? 'Quantity to Short' : 'Total Quantity';
  const slLabel = isShort ? 'Stop Loss — above entry (USD)' : 'Stop Loss (USD)';
  const submitLabel = existing ? 'Update' : (isShort ? 'Open Short' : 'Add to Portfolio');

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal fade-in">
        <div className="modal-header">
          <h2>
            {isShort && <span className="short-badge modal-badge">SHORT</span>}
            {modalTitle}
          </h2>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        {isShort && !existing && (
          <div className="short-info-banner">
            Profit when price falls below your entry. Loss is unlimited if price rises.
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Coin</label>
            {existing ? (
              <input type="text" value={symbol} disabled />
            ) : (
              <div className="coin-search-wrapper" ref={wrapperRef}>
                <input
                  type="text"
                  placeholder="Search coin… (e.g. BTC, ETH)"
                  value={coinSearch}
                  onChange={handleSearchChange}
                  onFocus={() => setShowDropdown(true)}
                  autoComplete="off"
                  autoFocus
                />
                {showDropdown && loadingCoins && (
                  <ul className="coin-dropdown">
                    <li className="no-match">Loading coins…</li>
                  </ul>
                )}
                {showDropdown && !loadingCoins && filteredCoins.length > 0 && (
                  <ul className="coin-dropdown">
                    {filteredCoins.map(c => (
                      <li
                        key={c}
                        className={c === symbol ? 'selected' : ''}
                        onMouseDown={() => handleCoinSelect(c)}
                      >
                        {c}
                      </li>
                    ))}
                  </ul>
                )}
                {showDropdown && !loadingCoins && coinSearch.length > 0 && filteredCoins.length === 0 && (
                  <ul className="coin-dropdown">
                    <li className="no-match">No coins found</li>
                  </ul>
                )}
              </div>
            )}
          </div>

          <div className="field">
            <label>{priceLabel}</label>
            <div className="price-input-row">
              <input
                type="number"
                step="any"
                min="0"
                placeholder="e.g. 42000"
                value={avgPrice}
                onChange={e => { setAvgPrice(e.target.value); setError(''); }}
                autoFocus={!!existing}
              />
              <button
                type="button"
                className="btn-use-market"
                title="Fetch latest market price"
                disabled={!symbol || fetchingPrice}
                onClick={async () => {
                  setFetchingPrice(true);
                  try {
                    const price = await fetchLivePrice(symbol, spotSymbolSet.has(symbol));
                    setAvgPrice(String(price));
                    setError('');
                  } catch {
                    setError(`Could not fetch price for ${symbol}`);
                  } finally {
                    setFetchingPrice(false);
                  }
                }}
              >
                {fetchingPrice ? '…' : 'Live'}
              </button>
            </div>
          </div>

          <div className="field">
            <label>{qtyLabel}</label>
            <input
              type="number"
              step="any"
              min="0"
              placeholder="e.g. 0.5"
              value={qty}
              onChange={e => { setQty(e.target.value); setError(''); }}
            />
          </div>

          <div className="field">
            <label>{slLabel} <span className="optional">optional</span></label>
            <input
              type="number"
              step="any"
              min="0"
              placeholder={isShort ? 'e.g. 46000 (above entry)' : 'e.g. 38000'}
              value={stopLoss}
              onChange={e => setStopLoss(e.target.value)}
            />
          </div>

          {error && <div className="error">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className={`btn ${isShort ? 'short-confirm' : 'primary'}`}>
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
