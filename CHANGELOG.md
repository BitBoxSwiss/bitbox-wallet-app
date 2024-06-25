# Changelog

## Unreleased

## 4.43.0
- Bundle BitBox02 firmware version v9.19.0
- New feature in advanced settings: Export logs
- Add specific titles to guides replacing the generic "Guide" previously used on all pages
- Android: enable transactions export feature
- Format amounts using localized decimal and group separator
- Support pasting different localized number formats, i.e. dot and comma separated amounts
- Add DMG installer for macOS
- Use mempool.space as preferred fee estimation source for BTC
- Add Satoshi as an option in active currencies
- Show address re-use warning and group UTXOs with the same address together in coin control.
- Fix encoding of transaction notes on Windows
- Add red dot in sidebar and on device settings tab to indicate that there is a firmware upgrade

## 4.42.1
- BitBox02: fix missing button to re-install firmware, fixing interrupted installs ("invalid firmware").
- Fix Wallet Connect issue where account unspecified by the connecting dapp caused a UI crash
- Fix Wallet Connect issue with required/optionalNamespace and handling all possible namespace definitions
- Fix BitBoxApp crash on GrapheneOS and other phones without Google Play Services when scanning QR codes.

## 4.42.0
- Preselect backup when there's only one backup available
- Bundle BitBox02 firmware version v9.18.0 and intermediate version v9.17.1
- Add support for BIP-85 derived child keys
- Show QR scanner video in fullscreen on mobile for onchain transactions
- Android: fix file upload forms in MoonPay
- Replace the existing BIP69 lexicographical sorting of tx inputs/outputs with a randomized sorting approach
- Android: fix app crash after close and re-open
- Fix a bug that caused the exchange selection page to go blank if no region was selected

## 4.41.0
- New feature: insure your bitcoins through Bitsurance
- Bundle BitBox02 firmware version v9.16.0
- Fix build on M-processor Apple machines
- Add support for Ethereum EIP-1559 transactions: https://eips.ethereum.org/EIPS/eip-1559
- Replace deprecated Ethgasstation with Etherscan for fee estimation (including base + priority fee for EIP-1559)
- Fixed a bug where the portfolio chart could show wrong values in an Ethereum account containing failed transactions

## 4.40.0
- Add support for watch-only - see your accounts and portfolio without connecting your BitBox02
- Android: new setting to enable screen lock authentication when accessing the app
- Drop support for SAI token
- Ability to connect Ethereum (mainnet) wallets to dapps using WalletConnect
- Log JavaScript console messages in the app log.txt
- Add amounts hiding feature to enhance privacy when using the app in public

## 4.39.0
- Bundle BitBox02 firmware version v9.15.0
- Display the wallet root fingerprint in the account info and device settings

## 4.38.0
- Bundle BitBox02 firmware version v9.14.1
- Automatically discover used Bitcoin and Litecoin accounts
- Improve sats amount readability adding thousands separator
- Revamp settings page for improved UX and aesthetics
- Update minimum supported Ubuntu version to 20.04+
- Add support for Czech Crown (CZK) and add Czech translation
- Add support for Zloty (PLN)
- Add advanced setup with skip microSD card or 12-word seed options
- Hide 0 amount ERC20 transactions to partially mitigate Address Poisoning Attack
- Changed Litecoin block explorer to Blockchair
- Show notes in coin control

## 4.37.1
- Fix BitBoxApp crash when processing BTC/LTC transactions containing too large witness items

## 4.37.0
- Bundle BitBox02 firmware version v9.14.0
- Enable auto HiDPI scaling to correctly manage scale factor on high density screens
- Bitcoin: enable setting a custom fee if the fee rate estimations are unavailable
- Add dark mode: app will default to the mode set by the system preferences but can be overwritten in the settings

## 4.36.1
- Fix USB communication issue on Windows

## 4.36.0
- Re-style header for a better space utilisation
- Re-style sidebar navigation on mobile (portrait) to be full-screen for better space utilisation and a more modern look
- Automatically recover from a corrupt headers database (caused e.g. by the computer shutting down during a database write)
- Integration of Pocket Bitcoin, making it easy to buy Bitcoin within the app. You can share a single address or an xpub.
- Re-style account selector to show the account's balance and its coin logo
- Show a 'Receive' (crypto) button beside the 'Buy' button for an empty wallet
- Create a new screen for selecting an account to receive crypto

## 4.35.1
- Fix issue where the app sometimes shows a blank screen after unlock

## 4.35.0
- Bundle BitBox02 firmware version v9.13.1
- Add Arabic translation
- Render number of blocks scanned and percentage progress using fixed-width digits for a more stable UI
- Transaction details: show fiat value at time of transaction
- Android: more modern look by changing the status bar color to white while the app is running
- Android: fix time shown on BitBox02 when restoring a backup (it was shown in UTC instead of local time)
- Fix update balance after transaction sent
- Fix utxos update after new transaction is sent
- Add attestation check to the device settings
- Fix insufficient gas funds error message on erc20 transactions
- Display trailing zeroes for BTC/LTC amount formatting
- Fix broken links on Android 11+
- Add 'sat' unit for Bitcoin accounts, available in Settings view
- Add version number and available updates check in settings
- Add translation feedback link in the guide
- Fix a UI bug when checking a backup where the confirmation dialog is sometimes empty
- Ethereum: remove Ropsten/Rinkeby testnet networks, which have been shut down
- Re-style portfolio chart on mobile (Android) for better usability and a more modern look

## 4.34.0
- Bundle BitBox02 firmware version v9.12.0
- The Windows installer now asks the user to close a running instance of the BitBoxApp instead of forcefully stopping it
- Ethereum: reduce Etherscan polling interval from one minute to five minutes

## 4.33.0
- Bundle BitBox02 firmware version v9.11.0
- Improve visual loading of the portfolio view

## 4.32.1
- Fix Moonpay not loading on Android

## 4.32.0 [2022-03-16]
- Bundle BitBox02 firmware version v9.10.0
- Add support for BIP-86 taproot receive addresses
- Show coin subtotals in 'My portfolio'
- Add QR-code scanner to Ethereum
- Transaction details: make transaction ID copyable without opening the block explorer
- Improve account loading speed when there are many transactions in the account
- Desktop: add a configuration option using the environment variable `BITBOXAPP_RENDER` to enable
  users to turn off forced software rendering. Use `BITBOXAPP_RENDER=auto` to use Qt's default
  rendering backend.

## 4.31.1 [2022-02-07]
- Bundle BitBox02 Multi firmware version v9.9.1
- Add a file picker dialog to choose where to export a CSV to
- Fix display of server name and checking the server connection in 'Connect your own full node'
- Add support for Swedish krona (SEK)

## 4.31.0 [tagged 2022-01-13, released 2022-01-18]
- Bundle BitBox02 firmware version v9.9.0
- Support sending to Bitcoin taproot addresses
- Fix opening 'transactions export' CSV file
- Add Dutch translation
- Add support for Norwegian krone (NOK)
- Migrated the frontend from preact to React

## 4.30.0 [released 2021-11-17]
- Add Buy CTA on empty Account overview and summary views
- Fix an Android app crash when opening the app after first rejecting the USB permissions
- Change label to show 'Fee rate' or 'Gas price' for custom fees
- Change label 'Send all' label to 'Send selected coins' if there is a coin selection
- Improve information about using the passphrase feature
- Temporary disable Chromium sandbox on linux due to #1447

## 4.29.1 [tagged 2021-09-07, released 2021-09-08]
- Verify the EIP-55 checksum in mixed-case Ethereum recipient addresses
- Disable GPU acceleration introduced in v4.29.0 due to rendering artefacts on Windows
- Changed default currency to USD
- Support copying address from transaction details

## 4.29.0 [released 2021-08-03]
- Add support for the Address Ownership Proof Protocol (AOPP), i.e.: handle 'aopp:?...' URIs. See https://aopp.group/.
- Add fee options for Ethereum based on priority, and the ability to set a custom gas price
- Add a guide entry: How to import my transactions into CoinTracking?
- Updated to Qt 5.15 from Qt 5.12 for Linux, macOS and Windows
- Revamped account-info view to show account keypath, scriptType etc.
- Allow disabling accounts in 'Manage accounts'.
- Prevent screen from turning off while the app is in foreground on Android
- Allow entering the BitBox02 startup settings in 'Manage device' to toggle showing the firmware hash at any time
- More user-friendly messages for first BitBox02 firmware install
- Use hardware accelerated rendering in Qt if available

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
