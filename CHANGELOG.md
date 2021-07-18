# Changelog

## [Unreleased]
- Add a guide entry: How to import my transactions into CoinTracking?
- Updated to Qt 5.15 from Qt 5.12 for Linux, macOS and Windows
- Revamped account-info view to show account keypath, scriptType etc.
- Allow disabling accounts in 'Manage accounts'.
- Prevent screen from turning off while the app is in foreground on Android

## 4.28.2 [released 2021-06-03]
- Fix a conversion rates updater bug

## 4.28.1 [released 2021-05-28]
- Restore lost transaction notes when ugprading to v4.28.0.
- Improve error message when EtherScan responds with a rate limit error.

## 4.28.0 [released 2021-05-27]
- Bundle BitBox02 v9.6.0 firmware
- New feature: add additional accounts
- Remove the setting 'Separate accounts by address type (legacy behavior)'. BitBox02 accounts are now always unified.
- Validate socks proxy url
- Display the BitBox02 secure chip version (from v9.6.0)

## 4.27.0 [released 2021-03-17]
- Buy ERC20 tokens using Moonpay
- Remove CryptoCompare; use Coingecko for latest conversion rates. Fixes rate limiting issues, especially for VPN/Tor users.
- Bundle BitBox02 v9.5.0 firmware
- Run BitBoxApp installer as admin by default on Windows
- Close a running BitBoxApp instance on Windows when installing an update to ensure success
- Show blockchain connection errors in detail
- Connect default BTC/LTC full nodes on port 443 to work around firewalls blocking the 5XXXX ports
- Remove confusing disabled copy button in the receive screen

## 4.26.0 [released 2021-02-25]
- Activate antiklepto for Ethereum and ERC20 transactions
- Show nonce in Ethereum transaction details
- Fix QR-code scanning on Linux
- Remove BitBox02 random number button
- Allow camera access in iframe for Moonpay
- Bring back BitBox02 wallet create/restore success screen
