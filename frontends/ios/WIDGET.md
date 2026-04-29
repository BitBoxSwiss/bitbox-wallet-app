# BitBoxApp iOS Widget

How the iOS widget knows which coins to show, where it gets prices, and how caching works.

---

## 0. Supported coins

The widget **only supports BTC, ETH, and LTC** (mainnet).

The main BitBoxApp also supports:

- Testnet coins (`tbtc`, `tltc`, `sepeth`)  the widget normalizes these to their mainnet equivalent (`btc`, `ltc`, `eth`) for price lookup.
- Individual ERC20 tokens (USDT, DAI, LINK, etc.) prices are **not** shown.

The separate testnet iOS build target does not include or sync widget data.

---

## 1. Where the coin list and currency come from

The main BitBoxApp and the widget are separate processes. They share data through an **App Group** (`group.swiss.bitbox.BitBoxApp`) - a small shared storage area both can read and write.

When the app launches (or enters foreground / background), `WidgetAppGroupSync` runs on a background task:

1. Reads `config.json` -> extracts the user's chosen fiat currency (e.g. `EUR`).
2. Reads `accounts.json` -> collects all active (non-inactive, non-hidden) coin codes.
3. Normalizes coin codes (`tbtc` -> `btc`, `sepeth` -> `eth`, `tltc` -> `ltc`).
4. Writes the currency and coin list to shared `UserDefaults`.
5. If anything changed, tells iOS to reload the widget timeline.

**Fallback:** If the user's currency isn't supported by the API (e.g. `BTC` or `sat`), it falls back to `USD`.

---

## 2. Which coin the widget displays

The widget shows **one coin at a time**. The user switches coins with left/right chevron buttons.

- The currently selected coin is tracked by `selectedCoinIndex` in shared `UserDefaults`.
- Tapping a chevron button increments or decrements this index.
- `selectedCoinCode()` reads the index, maps it to the coin list, and returns the code.
- If there are no active accounts, it defaults to BTC.

---

## 3. How prices are fetched

The widget calls the **Shift Crypto CoinGecko Mirror API**:

```
https://exchangerates.shiftcrypto.io/api/v3/coins/{geckoID}/market_chart/range
  ?vs_currency={currency}
  &from={1 day ago}
  &to={now}
```

Where `geckoID` maps `btc` -> `bitcoin`, `ltc` -> `litecoin`, `eth` -> `ethereum`.

This returns 1 day of price data points. The widget resamples those points to a fixed 10-minute cadence (145 points total, inclusive start/end). From that response:

- **Current price** = last data point.
- **24-hour change** = percentage difference between first and last data points.
- **Chart data** = all price points (used for the sparkline).

The request has a **10-second timeout**.

---

## 4. How caching works

Every successful API response is saved to `UserDefaults` as a `CachedPriceRecord` - a `PriceData` payload plus a timestamp.

**Cache key format:** `cachedPriceData_btc_USD` (one entry per coin+currency pair).

**Cache TTL:** 1 hour. After that, the cached entry is considered stale and ignored.

### Cache-first strategy

When the widget refreshes, it follows this order:

1. **Check cache** for the selected coin + currency.
2. **If exact match found** (same coin AND same currency, not expired):
   - Show the cached data immediately (no waiting). The next iOS-scheduled timeline reload will refresh it inline.
3. **If no match** (cache miss, wrong currency, or expired):
   - Fetch from the network (blocking - the widget waits for the response).
   - If the network fails, try the cache as a last resort (even a different currency).

Switching to a coin with a warm cache feels instant. The first switch to a coin whose cache is cold (or expired) performs one inline fetch before rendering.

### Fallback chain

If the network fetch fails:

1. Try cache for the exact coin + currency.
2. Try cache for the same coin + `USD` (fallback currency).
3. If nothing works, show "Unavailable".

---

## 5. Refresh schedule

- iOS calls the widget's timeline roughly **every 15 minutes**. This is not exact - iOS controls the actual timing based on widget budget, battery, and usage patterns.
- If a network fetch fails, the widget asks iOS to retry in **1 minute**.
- If the user changes their currency or accounts in the app, a refresh is triggered immediately.

---

## Summary diagram

```
BitBoxApp                          Widget Extension
─────────                          ────────────────
config.json ──┐
              ├── WidgetAppGroupSync ──▶ UserDefaults (App Group)
accounts.json ┘        │                     │
                       │                     ▼
                  (if changed)         WidgetTimelineProvider
                       │                     │
                       ▼               ┌─────┴─────┐
               reload timelines     cache hit?    cache miss?
                                       │              │
                                  show cached     fetch from API
                                                   + save to cache
                                       │              │
                                       ▼              ▼
                                   Widget UI      Widget UI
```
