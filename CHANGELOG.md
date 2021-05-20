# Changelog

## [Unreleased]
- Validate socks proxy url
- Remove the setting 'Separate accounts by address type (legacy behavior)'. BitBox02 accounts are now always unified.

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
