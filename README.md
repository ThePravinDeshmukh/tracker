# 🪙 Crypto Portfolio Tracker

A lightweight React app for tracking your crypto portfolio with live prices from Binance WebSocket.

## Features
- ✅ Live prices via Binance WebSocket (updates every second)
- ✅ Add / edit / remove holdings
- ✅ Track avg buy price & quantity
- ✅ Live P&L (profit/loss) in $ and %
- ✅ Total portfolio summary
- ✅ Flash animation when prices change
- ✅ Sort by value, P&L, or name
- ✅ Data persists in localStorage
- ✅ 20 supported coins

## Supported Coins
BTC, ETH, SOL, BNB, XRP, ADA, AVAX, DOT, MATIC, LINK, LTC, UNI, ATOM, DOGE, SUI, APT, OP, ARB, NEAR, ICP

## Setup

```bash
npm install
npm start
```

The app opens at http://localhost:3000

## How It Works
- Prices stream via Binance WebSocket (`wss://stream.binance.com`)
- Requires internet connection for live prices
- All portfolio data is saved locally in your browser (localStorage)
- No API key needed — uses public Binance endpoints
