// SPDX-License-Identifier: Apache-2.0

package backend

import (
	"encoding/hex"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"runtime"
	"slices"
	"strings"
	"sync/atomic"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	accountsTypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/types"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/arguments"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/banners"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/addresses"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/blockchain"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/electrum"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/types"
	coinpkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/etherscan"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/ltc"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/config"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/devices/bitbox"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/devices/bitbox02"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/devices/bluetooth"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/devices/device"
	deviceevent "github.com/BitBoxSwiss/bitbox-wallet-app/backend/devices/device/event"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/devices/usb"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/keystore"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/keystore/software"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/rates"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/versioninfo"
	utilConfig "github.com/BitBoxSwiss/bitbox-wallet-app/util/config"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/locker"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/logging"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/observable"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/observable/action"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/socksproxy"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/ethereum/go-ethereum/params"
	"github.com/sirupsen/logrus"
	"golang.org/x/time/rate"
)

func init() {
	electrum.SetClientSoftwareVersion(versioninfo.Version)
}

// fixedURLWhitelist is always allowed by SystemOpen, in addition to some
// adhoc URLs. See SystemOpen for details.
var fixedURLWhitelist = []string{
	// Shift Crypto owned domains.
	"https://bitbox.swiss/",
	"https://shop.bitbox.swiss/",
	"https://shiftcrypto.support/",
	"https://support.bitbox.swiss",
	// Exchange rates.
	"https://www.coingecko.com/",
	// Block explorers.
	"https://mempool.space/tx/",
	"https://mempool.space/testnet/tx/",
	"https://sochain.com/tx/LTCTEST/",
	"https://blockchair.com/litecoin/transaction/",
	"https://etherscan.io/tx/",
	"https://sepolia.etherscan.io/tx/",
	// Moonpay onramp
	"https://www.moonpay.com/",
	"https://support.moonpay.com/",
	"https://support.moonpay.io/",
	"https://help.moonpay.io/",
	"https://help.moonpay.com/",
	// PocketBitcoin
	"https://pocketbitcoin.com/",
	// BTCDirect
	"https://btcdirect.eu/",
	"https://start.btcdirect.eu/",
	// Bitrefill
	"https://www.bitrefill.com/",
	"https://embed.bitrefill.com/",
	"https://help.bitrefill.com/",
	// Bitsurance
	"https://www.bitsurance.eu/",
	"https://get.bitsurance.eu/",
	"https://bitsurance.ihr-versicherungsschutz.de/",
	"https://bitsurance.eu/support",
	"https://support.bitsurance.eu",
	// Documentation and other articles.
	"https://bitcoincore.org/en/2016/01/26/segwit-benefits/",
	"https://en.bitcoin.it/wiki/Bech32_adoption",
	"https://github.com/bitcoin/bips/",
	// iOS app settings
	"app-settings:",
	// Others
	"https://cointracking.info/import/bitbox/",
}

// event are events emitted by the backend.
type event string

const (
	// eventNewTxs is emitted when the user should be notified of new transactions.
	eventNewTxs event = "new-txs"
)

type deviceEvent struct {
	DeviceID string `json:"deviceID"`
	Type     string `json:"type"`
	Data     string `json:"data"`
	// TODO: rename Data to Event, Meta to Data.
	Meta interface{} `json:"meta"`
}

type authEventType string

// AuthResultType represents the possible results of the authentication flow.
type AuthResultType string

const (
	// authRequired is fired when we need the user to authenticate.
	authRequired authEventType = "auth-required"
	// authForced is fired when we need the user to authenticate even if
	// the authentication flag is not set in the settings. This allows to check
	// that the user is able to authenticate before enabling the screen lock.
	authForced authEventType = "auth-forced"
	// authResult is fired when the authentication flow produced a result.
	authResult authEventType = "auth-result"

	// AuthResultOk means that the authentication succeeded.
	AuthResultOk AuthResultType = "authres-ok"
	// AuthResultErr means that there is an authentication error.
	// E.g. on Android when a biometric is valid, but not recognized.
	AuthResultErr AuthResultType = "authres-err"
	// AuthResultCancel means that the authentication has been aborted
	// by the user.
	AuthResultCancel AuthResultType = "authres-cancel"
	// AuthResultMissing means that there is no authentication method configured
	// on the device.
	AuthResultMissing AuthResultType = "authres-missing"
)

type authEventObject struct {
	Typ    authEventType   `json:"typ"`
	Result *AuthResultType `json:"result,omitempty"`
}

// Environment represents functionality where the implementation depends on the environment the app
// runs in, e.g. Qt5/Mobile/webdev.
type Environment interface {
	// NotifyUser notifies the user, via desktop notifcation, mobile notification area, ...
	NotifyUser(string)
	// DeviceInfos returns a list of available recognized devices (BitBox01, BitBox02, ...).
	DeviceInfos() []usb.DeviceInfo
	// SystemOpen opens a web url in the default browser, or a file url in the default application.
	SystemOpen(string) error
	// UsingMobileData returns true if the user is connected to the internet over a mobile data
	// connection, which might be subject to data limits. Returns false if we are on WiFi/LAN.
	// Special case: if there is no internet connection at all, this should also return false. This
	// function can be extended to return an enum if we ever want to deal with lost internet
	// connections at this level (currently handled at the account-level (see `Offline()` in the
	// `Account` interface).
	UsingMobileData() bool
	// NativeLocale reports user preferred UI language from the top native app
	// layer like Android. The returned value can be any BCP 47 tag.
	// It is always validated by the backend and it's ok for the native implementation
	// to return empty string or unsupported value, in which case the app will use
	// English by default.
	NativeLocale() string
	// Invoke a file picker dialog for the user to select a destination to store a file.
	// `suggestedFilename` is the proposed/default destination.
	// The function should return the empty string if the user aborted the process.
	GetSaveFilename(suggestedFilename string) string
	// SetDarkTheme allows to handle theme setting change at environment level. Can be used e.g. to
	// update status bar color on Mobile.
	SetDarkTheme(bool)
	// DetectDarkTheme returns true if the dark theme is enabled at OS level.
	DetectDarkTheme() bool
	// Auth requests the native environment to trigger authentication.
	Auth()
	// OnAuthSettingChanged is called when the authentication (screen lock) setting is changed.
	// This is also called when the app launches with the current setting.
	OnAuthSettingChanged(enabled bool)
	// BluetoothConnect tries to connect to the peripheral by the given identifier.
	// Use `backend.bluetooth.State()` to track failure.
	BluetoothConnect(identifier string)
}

// Backend ties everything together and is the main starting point to use the BitBox wallet library.
type Backend struct {
	observable.Implementation

	arguments   *arguments.Arguments
	environment Environment

	config *config.Config

	events chan interface{}

	notifier *Notifier

	devices map[string]device.Interface

	usbManager *usb.Manager
	bluetooth  *bluetooth.Bluetooth

	accountsAndKeystoreLock locker.Locker
	accounts                AccountsList
	// keystore is nil if no keystore is connected.
	keystore keystore.Keystore

	connectKeystore connectKeystore

	aopp AOPP

	// makeBtcAccount creates a BTC account. In production this is `btc.NewAccount`, but can be
	// overridden in unit tests for mocking.
	makeBtcAccount func(*accounts.AccountConfig, *btc.Coin, *types.GapLimits, func(coinpkg.Code, blockchain.ScriptHashHex) (*addresses.AccountAddress, error), *logrus.Entry) accounts.Interface
	// makeEthAccount creates an ETH account. In production this is `eth.NewAccount`, but can be
	// overridden in unit tests for mocking.
	makeEthAccount func(*accounts.AccountConfig, *eth.Coin, *http.Client, *logrus.Entry) accounts.Interface

	onAccountInit   func(accounts.Interface)
	onAccountUninit func(accounts.Interface)
	onDeviceInit    func(device.Interface)
	onDeviceUninit  func(string)

	coins     map[coinpkg.Code]coinpkg.Coin
	coinsLock locker.Locker

	log *logrus.Entry

	socksProxy socksproxy.SocksProxy
	// can be a regular or, if Tor is enabled in the config, a SOCKS5 proxy client.
	httpClient           *http.Client
	etherScanRateLimiter *rate.Limiter
	ratesUpdater         *rates.RateUpdater
	banners              *banners.Banners

	// For unit tests, called when `backend.checkAccountUsed()` is called.
	tstCheckAccountUsed func(accounts.Interface) bool
	// For unit tests, called when `backend.maybeAddHiddenUnusedAccounts()` has run.
	tstMaybeAddHiddenUnusedAccounts func()

	// testing tells us whether the app is in testing mode
	testing bool

	// isOnline indicates whether the backend is online, i.e. able to connect to the internet.
	isOnline atomic.Bool

	// ethupdater takes care of updating ETH accounts.
	ethupdater *eth.Updater
}

// NewBackend creates a new backend with the given arguments.
func NewBackend(arguments *arguments.Arguments, environment Environment) (*Backend, error) {
	log := logging.Get().WithGroup("backend")
	backendConfig, err := config.NewConfig(arguments.AppConfigFilename(), arguments.AccountsConfigFilename())
	if err != nil {
		return nil, errp.WithStack(err)
	}
	log.Infof("backend config: %+v", backendConfig.AppConfig().Backend)
	log.Infof("frontend config: %+v", backendConfig.AppConfig().Frontend)
	// Disable on iOS as it does not work there.
	useProxy := backendConfig.AppConfig().Backend.Proxy.UseProxy && runtime.GOOS != "ios"
	backendProxy := socksproxy.NewSocksProxy(
		useProxy,
		backendConfig.AppConfig().Backend.Proxy.ProxyAddress,
	)
	hclient, err := backendProxy.GetHTTPClient()
	if err != nil {
		return nil, err
	}

	accountUpdate := make(chan *eth.Account)

	backend := &Backend{
		arguments:   arguments,
		environment: environment,
		config:      backendConfig,
		events:      make(chan interface{}),

		devices:  map[string]device.Interface{},
		coins:    map[coinpkg.Code]coinpkg.Coin{},
		accounts: []accounts.Interface{},
		aopp:     AOPP{State: aoppStateInactive},
		makeBtcAccount: func(config *accounts.AccountConfig, coin *btc.Coin, gapLimits *types.GapLimits, getAddress func(coinpkg.Code, blockchain.ScriptHashHex) (*addresses.AccountAddress, error), log *logrus.Entry) accounts.Interface {
			return btc.NewAccount(config, coin, gapLimits, getAddress, log, hclient)
		},
		makeEthAccount: func(config *accounts.AccountConfig, coin *eth.Coin, httpClient *http.Client, log *logrus.Entry) accounts.Interface {
			return eth.NewAccount(config, coin, httpClient, log, accountUpdate)
		},

		log: log,

		testing:              backendConfig.AppConfig().Backend.StartInTestnet || arguments.Testing(),
		etherScanRateLimiter: rate.NewLimiter(rate.Limit(etherscan.CallsPerSec), 1),
	}
	// TODO: remove when connectivity check is present on all platforms
	backend.isOnline.Store(true)

	notifier, err := NewNotifier(filepath.Join(arguments.MainDirectoryPath(), "notifier.db"))
	if err != nil {
		return nil, err
	}
	backend.notifier = notifier
	backend.socksProxy = backendProxy
	backend.httpClient = hclient
	backend.ethupdater = eth.NewUpdater(accountUpdate, backend.httpClient, backend.etherScanRateLimiter, backend.updateETHAccounts)

	ratesCache := filepath.Join(arguments.CacheDirectoryPath(), "exchangerates")
	if err := os.MkdirAll(ratesCache, 0700); err != nil {
		log.Errorf("RateUpdater DB cache dir: %v", err)
	}
	backend.ratesUpdater = rates.NewRateUpdater(hclient, ratesCache)
	backend.ratesUpdater.Observe(backend.Notify)

	backend.banners = banners.NewBanners(backend.DevServers())
	backend.banners.Observe(backend.Notify)

	backend.bluetooth = bluetooth.New(log)
	backend.bluetooth.Observe(backend.Notify)

	return backend, nil
}

// configureHistoryExchangeRates changes backend.ratesUpdater settings.
// It requires both backend.config to be up-to-date and all accounts initialized.
//
// The accountsAndKeystoreLock must be held when calling this function.
func (backend *Backend) configureHistoryExchangeRates() {
	var coins []string
	for _, acct := range backend.accounts {
		coins = append(coins, string(acct.Coin().Code()))
	}
	fiats := backend.config.AppConfig().Backend.FiatList
	backend.ratesUpdater.ReconfigureHistory(coins, fiats)
}

func (backend *Backend) notifyNewTxs(account accounts.Interface) {
	notifier := account.Notifier()
	if notifier == nil {
		return
	}
	// Notify user of new transactions
	unnotifiedCount, err := notifier.UnnotifiedCount()
	if err != nil {
		backend.log.WithError(err).Error("error getting notifier counts")
		return
	}
	if unnotifiedCount != 0 {
		backend.Notify(observable.Event{
			Subject: string(eventNewTxs),
			Action:  action.Replace,
			Object: map[string]interface{}{
				"count":       unnotifiedCount,
				"accountName": account.Config().Config.Name,
			},
		})
		if err := notifier.MarkAllNotified(); err != nil {
			backend.log.WithError(err).Error("error marking notified")
		}
	}
}

// Config returns the app config.
func (backend *Backend) Config() *config.Config {
	return backend.config
}

// Authenticate executes a system authentication if
// the authentication config flag is enabled or if the
// `force` input flag is enabled (as a consequence of an
// 'auth/auth-forced' notification).
// Otherwise, the authentication is automatically assumed as
// successful.
func (backend *Backend) Authenticate(force bool) {
	backend.log.Info("Auth requested")
	if backend.config.AppConfig().Backend.Authentication || force {
		backend.environment.Auth()
	} else {
		backend.AuthResult(AuthResultOk)
	}
}

// TriggerAuth triggers an auth-required notification.
func (backend *Backend) TriggerAuth() {
	backend.Notify(observable.Event{
		Subject: "auth",
		Action:  action.Replace,
		Object: authEventObject{
			Typ: authRequired,
		},
	})
}

// ForceAuth triggers an auth-forced notification
// followed by an auth-required notification.
func (backend *Backend) ForceAuth() {
	backend.Notify(observable.Event{
		Subject: "auth",
		Action:  action.Replace,
		Object: authEventObject{
			Typ: authForced,
		},
	})
	backend.Notify(observable.Event{
		Subject: "auth",
		Action:  action.Replace,
		Object: authEventObject{
			Typ: authRequired,
		},
	})
}

// AuthResult triggers an auth-ok or auth-err notification
// depending on the input value.
func (backend *Backend) AuthResult(result AuthResultType) {
	backend.log.Infof("Auth result: %v", result)
	backend.Notify(observable.Event{
		Subject: "auth",
		Action:  action.Replace,
		Object: authEventObject{
			Typ:    authResult,
			Result: &result,
		},
	})
}

// DefaultAppConfig returns the default app config.
func (backend *Backend) DefaultAppConfig() config.AppConfig {
	return config.NewDefaultAppConfig()
}

func (backend *Backend) defaultProdServers(code coinpkg.Code) []*config.ServerInfo {
	switch code {
	case coinpkg.CodeBTC:
		return backend.config.AppConfig().Backend.BTC.ElectrumServers
	case coinpkg.CodeTBTC:
		return backend.config.AppConfig().Backend.TBTC.ElectrumServers
	case coinpkg.CodeRBTC:
		return backend.config.AppConfig().Backend.RBTC.ElectrumServers
	case coinpkg.CodeLTC:
		return backend.config.AppConfig().Backend.LTC.ElectrumServers
	case coinpkg.CodeTLTC:
		return backend.config.AppConfig().Backend.TLTC.ElectrumServers
	default:
		panic(errp.Newf("The given code %s is unknown.", code))
	}
}

func defaultDevServers(code coinpkg.Code) []*config.ServerInfo {
	// O=Shift Crypto, CN=ShiftCrypto DEV R1
	// Serial: f67ab2bc7470c90ce027ce778a274384
	const devShiftCA = `-----BEGIN CERTIFICATE-----
MIIBmDCCAT2gAwIBAgIRAPZ6srx0cMkM4CfOd4onQ4QwCgYIKoZIzj0EAwIwNDEV
MBMGA1UEChMMU2hpZnQgQ3J5cHRvMRswGQYDVQQDExJTaGlmdENyeXB0byBERVYg
UjEwHhcNMjAxMjAyMTUzODM1WhcNMzAxMjAzMDMzODM1WjA0MRUwEwYDVQQKEwxT
aGlmdCBDcnlwdG8xGzAZBgNVBAMTElNoaWZ0Q3J5cHRvIERFViBSMTBZMBMGByqG
SM49AgEGCCqGSM49AwEHA0IABEC9ECgMAR04mfmcT499pjQFayUom3Tuczg+CPUU
BKAHMosD2hj0E5Oia5/+zYLrxwu5p/IWhuqS76tqVhFdIAmjMDAuMA4GA1UdDwEB
/wQEAwIChDAPBgNVHRMBAf8EBTADAQH/MAsGA1UdEQQEMAKCADAKBggqhkjOPQQD
AgNJADBGAiEAgEXhjnZffIZlnhnjlav3AJaqRcl/2jn+CnwTg7nFDxwCIQDE4UDd
mCMuGBNHsbrs6rI1hbI4Qq6GYazLaDRqdCufTA==
-----END CERTIFICATE-----`

	switch code {
	case coinpkg.CodeBTC:
		return []*config.ServerInfo{{Server: "btc1.shiftcrypto.dev:443", TLS: true, PEMCert: devShiftCA}}
	case coinpkg.CodeTBTC:
		return []*config.ServerInfo{{Server: "tbtc1.shiftcrypto.dev:443", TLS: true, PEMCert: devShiftCA}}
	case coinpkg.CodeRBTC:
		return []*config.ServerInfo{
			{Server: "127.0.0.1:52001", TLS: false, PEMCert: ""},
			{Server: "127.0.0.1:52002", TLS: false, PEMCert: ""},
		}
	case coinpkg.CodeLTC:
		return []*config.ServerInfo{{Server: "ltc1.shiftcrypto.dev:443", TLS: true, PEMCert: devShiftCA}}
	case coinpkg.CodeTLTC:
		return []*config.ServerInfo{{Server: "tltc1.shiftcrypto.dev:443", TLS: true, PEMCert: devShiftCA}}
	default:
		panic(errp.Newf("The given code %s is unknown.", code))
	}
}

func (backend *Backend) defaultElectrumXServers(code coinpkg.Code) []*config.ServerInfo {
	if backend.arguments.DevServers() {
		return defaultDevServers(code)
	}

	return backend.defaultProdServers(code)
}

// DevServers returns the value of the `devservers` flag.
func (backend *Backend) DevServers() bool {
	return backend.arguments.DevServers()
}

// Coin returns the coin with the given code or an error if no such coin exists.
func (backend *Backend) Coin(code coinpkg.Code) (coinpkg.Coin, error) {
	defer backend.coinsLock.Lock()()
	coin, ok := backend.coins[code]
	if ok {
		return coin, nil
	}
	dbFolder := backend.arguments.CacheDirectoryPath()

	erc20Token := erc20TokenByCode(code)
	btcFormatUnit := backend.config.AppConfig().Backend.BtcUnit
	switch {
	case code == coinpkg.CodeRBTC:
		servers := backend.defaultElectrumXServers(code)
		coin = btc.NewCoin(coinpkg.CodeRBTC, "Bitcoin Regtest", "RBTC", coinpkg.BtcUnitDefault, &chaincfg.RegressionNetParams, dbFolder, servers, "", backend.socksProxy)
	case code == coinpkg.CodeTBTC:
		servers := backend.defaultElectrumXServers(code)
		coin = btc.NewCoin(coinpkg.CodeTBTC, "Bitcoin Testnet", "TBTC", btcFormatUnit, &chaincfg.TestNet3Params, dbFolder, servers,
			"https://mempool.space/testnet/tx/", backend.socksProxy)
	case code == coinpkg.CodeBTC:
		servers := backend.defaultElectrumXServers(code)
		coin = btc.NewCoin(coinpkg.CodeBTC, "Bitcoin", "BTC", btcFormatUnit, &chaincfg.MainNetParams, dbFolder, servers,
			"https://mempool.space/tx/", backend.socksProxy)
	case code == coinpkg.CodeTLTC:
		servers := backend.defaultElectrumXServers(code)
		coin = btc.NewCoin(coinpkg.CodeTLTC, "Litecoin Testnet", "TLTC", coinpkg.BtcUnitDefault, &ltc.TestNet4Params, dbFolder, servers,
			"https://sochain.com/tx/LTCTEST/", backend.socksProxy)
	case code == coinpkg.CodeLTC:
		servers := backend.defaultElectrumXServers(code)
		coin = btc.NewCoin(coinpkg.CodeLTC, "Litecoin", "LTC", coinpkg.BtcUnitDefault, &ltc.MainNetParams, dbFolder, servers,
			"https://blockchair.com/litecoin/transaction/", backend.socksProxy)
	case code == coinpkg.CodeETH:
		etherScan := etherscan.NewEtherScan("1", backend.httpClient, backend.etherScanRateLimiter)
		coin = eth.NewCoin(etherScan, code, "Ethereum", "ETH", "ETH", params.MainnetChainConfig,
			"https://etherscan.io/tx/",
			etherScan,
			nil)
	case code == coinpkg.CodeSEPETH:
		etherScan := etherscan.NewEtherScan("11155111", backend.httpClient, backend.etherScanRateLimiter)
		coin = eth.NewCoin(etherScan, code, "Ethereum Sepolia", "SEPETH", "SEPETH", params.SepoliaChainConfig,
			"https://sepolia.etherscan.io/tx/",
			etherScan,
			nil)
	case erc20Token != nil:
		etherScan := etherscan.NewEtherScan("1", backend.httpClient, backend.etherScanRateLimiter)
		coin = eth.NewCoin(etherScan, erc20Token.code, erc20Token.name, erc20Token.unit, "ETH", params.MainnetChainConfig,
			"https://etherscan.io/tx/",
			etherScan,
			erc20Token.token,
		)
	default:
		return nil, errp.Newf("unknown coin code %s", code)
	}
	backend.coins[code] = coin
	coin.Observe(backend.Notify)
	return coin, nil
}

func (backend *Backend) updateETHAccounts() error {
	backend.log.Debug("Updating ETH accounts balances")

	accountsChainID := map[string][]*eth.Account{}
	for _, account := range backend.Accounts() {
		ethAccount, ok := account.(*eth.Account)
		if ok {
			chainID := ethAccount.ETHCoin().ChainIDstr()
			accountsChainID[chainID] = append(accountsChainID[chainID], ethAccount)
		}

	}

	for chainID, ethAccounts := range accountsChainID {
		etherScanClient := etherscan.NewEtherScan(chainID, backend.httpClient, backend.etherScanRateLimiter)
		backend.ethupdater.UpdateBalancesAndBlockNumber(ethAccounts, etherScanClient)
	}

	return nil
}

// ManualReconnect triggers reconnecting to Electrum servers if their connection is down.
// Only coin connections that were previously established are reconnected.
// Calling this is a no-op for coins that are already connected.
func (backend *Backend) ManualReconnect(reconnectETH bool) {
	var electrumCoinCodes []coinpkg.Code
	if backend.Testing() {
		electrumCoinCodes = []coinpkg.Code{
			coinpkg.CodeTBTC,
			coinpkg.CodeTLTC,
		}
	} else {
		electrumCoinCodes = []coinpkg.Code{
			coinpkg.CodeBTC,
			coinpkg.CodeLTC,
		}
	}
	backend.log.Info("Manually reconnecting")
	for _, code := range electrumCoinCodes {
		c, err := backend.Coin(code)
		if err != nil {
			backend.log.WithError(err).Errorf("could not find coin: %s", code)
			continue
		}
		btcCoin, ok := c.(*btc.Coin)
		if !ok {
			backend.log.Errorf("Expected %s to be a btc coin", code)
			continue
		}
		blockchain := btcCoin.Blockchain()
		if blockchain == nil {
			// Not initialized yet
			continue
		}
		blockchain.ManualReconnect()
	}
	if reconnectETH {
		backend.log.Info("Reconnecting ETH accounts")
		backend.ethupdater.EnqueueUpdateForAllAccounts()
	}
}

// Testing returns whether this backend is for testing only.
func (backend *Backend) Testing() bool {
	return backend.testing
}

// Accounts returns the current accounts of the backend.
func (backend *Backend) Accounts() AccountsList {
	defer backend.accountsAndKeystoreLock.RLock()()
	return slices.Clone(backend.accounts)
}

// OnAccountInit installs a callback to be called when an account is initialized.
func (backend *Backend) OnAccountInit(f func(accounts.Interface)) {
	backend.onAccountInit = f
}

// OnAccountUninit installs a callback to be called when an account is stopped.
func (backend *Backend) OnAccountUninit(f func(accounts.Interface)) {
	backend.onAccountUninit = f
}

// OnDeviceInit installs a callback to be called when a device is initialized.
func (backend *Backend) OnDeviceInit(f func(device.Interface)) {
	backend.onDeviceInit = f
}

// OnDeviceUninit installs a callback to be called when a device is uninitialized.
func (backend *Backend) OnDeviceUninit(f func(string)) {
	backend.onDeviceUninit = f
}

// Start starts the background services. It returns a channel of events to handle by the library
// client.
func (backend *Backend) Start() <-chan interface{} {
	backend.usbManager = usb.NewManager(
		backend.arguments.MainDirectoryPath(),
		backend.arguments.BitBox02DirectoryPath(),
		backend.socksProxy,
		backend.environment.DeviceInfos,
		backend.Register,
		backend.Deregister)
	backend.usbManager.Start()

	httpClient, err := backend.socksProxy.GetHTTPClient()
	if err != nil {
		backend.log.Error(err.Error())
	} else {
		go backend.banners.Init(httpClient)
	}

	defer backend.accountsAndKeystoreLock.Lock()()
	backend.initPersistedAccounts()
	backend.emitAccountsStatusChanged()

	backend.ratesUpdater.StartCurrentRates()
	backend.configureHistoryExchangeRates()

	backend.environment.OnAuthSettingChanged(backend.config.AppConfig().Backend.Authentication)

	go backend.ethupdater.PollBalances()

	if backend.config.AppConfig().Backend.StartInTestnet {
		if err := backend.config.ModifyAppConfig(func(c *config.AppConfig) error { c.Backend.StartInTestnet = false; return nil }); err != nil {
			backend.log.WithError(err).Error("Can't set StartInTestnet to false")
		}
	}
	return backend.events
}

// UsbUpdate triggers a scan of the USB devices to detect connects/disconnects.
func (backend *Backend) UsbUpdate() {
	if backend.usbManager != nil {
		backend.usbManager.Update()
	}
}

// DevicesRegistered returns a map of device IDs to device of registered devices.
func (backend *Backend) DevicesRegistered() map[string]device.Interface {
	return backend.devices
}

// HTTPClient is a getter method for the HTTPClient instance.
func (backend *Backend) HTTPClient() *http.Client {
	return backend.httpClient
}

// Keystore returns the keystore registered at this backend, or nil if no keystore is registered.
func (backend *Backend) Keystore() keystore.Keystore {
	defer backend.accountsAndKeystoreLock.RLock()()
	return backend.keystore
}

// registerKeystore registers the given keystore at this backend.
// if another keystore is already registered, it will be replaced.
func (backend *Backend) registerKeystore(keystore keystore.Keystore) {
	defer backend.accountsAndKeystoreLock.Lock()()
	// Only for logging, if there is an error we continue anyway.
	fingerprint, err := keystore.RootFingerprint()
	if err != nil {
		backend.log.WithError(err).Error("could not retrieve keystore fingerprint")
		return
	}
	log := backend.log.WithField("rootFingerprint", hex.EncodeToString(fingerprint))
	log.Info("registering keystore")
	backend.keystore = keystore
	backend.Notify(observable.Event{
		Subject: "keystores",
		Action:  action.Reload,
	})

	belongsToKeystore := func(_ *config.AccountsConfig, account *config.Account) bool {
		return account.SigningConfigurations.ContainsRootFingerprint(fingerprint)
	}

	persistKeystore := func(accountsConfig *config.AccountsConfig) error {
		keystoreName, err := keystore.Name()
		if err != nil {
			return errp.WithMessage(err, "could not retrieve keystore name")
		}
		keystoreCfg := accountsConfig.GetOrAddKeystore(fingerprint)
		keystoreCfg.Name = keystoreName
		keystoreCfg.LastConnected = time.Now()
		return nil
	}

	err = backend.config.ModifyAccountsConfig(func(accountsConfig *config.AccountsConfig) error {
		// Persist keystore with its name in the config.
		if err := persistKeystore(accountsConfig); err != nil {
			log.WithError(err).Error("Could not persist keystore")
		}

		// Persist default accounts the first time, otherwise perform any migrations that may be
		// needed on the persisted accounts.
		accounts := backend.filterAccounts(accountsConfig, belongsToKeystore)
		if len(accounts) != 0 {
			return backend.updatePersistedAccounts(keystore, accounts)
		}
		return backend.persistDefaultAccountConfigs(keystore, accountsConfig)
	})
	if err != nil {
		log.WithError(err).Error("Could not persist default accounts")
	}

	backend.initAccounts(false)

	backend.aoppKeystoreRegistered()

	backend.connectKeystore.onConnect(backend.keystore)

	go backend.maybeAddHiddenUnusedAccounts()
}

// DeregisterKeystore removes the registered keystore.
func (backend *Backend) DeregisterKeystore() {
	defer backend.accountsAndKeystoreLock.Lock()()

	if backend.keystore == nil {
		backend.log.Error("deregistering keystore, but no keystore found")
		return
	}
	// Only for logging, if there is an error we continue anyway.
	fingerprint, _ := backend.keystore.RootFingerprint()
	backend.log.WithField("rootFingerprint", hex.EncodeToString(fingerprint)).Info("deregistering keystore")
	backend.keystore = nil
	backend.Notify(observable.Event{
		Subject: "keystores",
		Action:  action.Reload,
	})

	backend.uninitAccounts(false)
	// TODO: classify accounts by keystore, remove only the ones belonging to the deregistered
	// keystore. For now we just remove all, then re-add the rest.
	backend.initPersistedAccounts()
	backend.emitAccountsStatusChanged()
	backend.connectKeystore.onDisconnect()
}

// Register registers the given device at this backend.
func (backend *Backend) Register(theDevice device.Interface) error {
	backend.devices[theDevice.Identifier()] = theDevice

	mainKeystore := len(backend.devices) == 1
	theDevice.SetOnEvent(func(event deviceevent.Event, data interface{}) {
		backend.events <- deviceEvent{
			DeviceID: theDevice.Identifier(),
			Type:     "device",
			Data:     string(event),
			Meta:     data,
		}
	})
	theDevice.Observe(func(event observable.Event) {
		switch deviceevent.Event(event.Subject) {
		case deviceevent.EventKeystoreGone:
			backend.DeregisterKeystore()
		case deviceevent.EventKeystoreAvailable:
			if mainKeystore {
				// HACK: for device based, only one is supported at the moment.
				backend.registerKeystore(theDevice.Keystore())
			}
		}
		backend.Notify(observable.Event{
			Subject: fmt.Sprintf(
				"devices/%s/%s/%s",
				theDevice.PlatformName(),
				theDevice.Identifier(),
				event.Subject),
			Action: event.Action,
			Object: event.Object,
		})
	})

	backend.onDeviceInit(theDevice)
	if err := theDevice.Init(backend.Testing()); err != nil {
		backend.onDeviceUninit(theDevice.Identifier())
		return err
	}

	backend.Notify(observable.Event{
		Subject: "devices/registered",
		Action:  action.Reload,
	})

	switch theDevice.ProductName() {
	case bitbox.ProductName:
		backend.banners.Activate(banners.KeyBitBox01)
	case bitbox02.BitBox02ProductName:
		backend.banners.Activate(banners.KeyBitBox02)
	case bitbox02.BitBox02NovaProductName:
		backend.banners.Activate(banners.KeyBitBox02Nova)
	}
	return nil
}

// Deregister deregisters the device with the given ID from this backend.
func (backend *Backend) Deregister(deviceID string) {
	if device, ok := backend.devices[deviceID]; ok {
		backend.onDeviceUninit(deviceID)
		delete(backend.devices, deviceID)
		backend.DeregisterKeystore()

		backend.Notify(observable.Event{
			Subject: "devices/registered",
			Action:  action.Reload,
		})
		switch device.ProductName() {
		case bitbox.ProductName:
			backend.banners.Deactivate(banners.KeyBitBox01)
		case bitbox02.BitBox02ProductName:
			backend.banners.Deactivate(banners.KeyBitBox02)
		case bitbox02.BitBox02NovaProductName:
			backend.banners.Deactivate(banners.KeyBitBox02Nova)
		}

	}
}

// RatesUpdater returns the backend's ratesUpdater instance.
func (backend *Backend) RatesUpdater() *rates.RateUpdater {
	return backend.ratesUpdater
}

// DownloadCert downloads the first element of the remote certificate chain.
func (backend *Backend) DownloadCert(server string) (string, error) {
	return electrum.DownloadCert(server, backend.socksProxy.GetTCPProxyDialer())
}

// CheckElectrumServer checks if a connection can be established with the electrum server, and
// whether the server is an electrum server.
func (backend *Backend) CheckElectrumServer(serverInfo *config.ServerInfo) error {
	return electrum.CheckElectrumServer(
		serverInfo, backend.log, backend.socksProxy.GetTCPProxyDialer())
}

// RegisterTestKeystore adds a keystore derived deterministically from a PIN, for convenience in
// devmode.
func (backend *Backend) RegisterTestKeystore(pin string) {
	softwareBasedKeystore := software.NewKeystoreFromPIN(pin)
	backend.registerKeystore(softwareBasedKeystore)
}

// NotifyUser creates a desktop notification.
func (backend *Backend) NotifyUser(text string) {
	backend.environment.NotifyUser(text)
}

// SystemOpen opens the given URL using backend.environment.
// It consults fixedURLWhitelist, matching the URL with each whitelist item.
// If an item is a prefix of url, it is allowed to be openend.
//
// If none matched, an ad-hoc URL construction failed or opening a URL failed,
// an error is returned.
func (backend *Backend) SystemOpen(url string) error {
	backend.log.Infof("SystemOpen: attempting to open url: %v", url)
	for _, whitelisted := range fixedURLWhitelist {
		if strings.HasPrefix(url, whitelisted) {
			return backend.environment.SystemOpen(url)
		}
	}

	return errp.Newf("Blocked /open with url: %s", url)
}

// Environment returns the app native environment.
func (backend *Backend) Environment() Environment {
	return backend.environment
}

// Close shuts down the backend. After this, no other method should be called.
func (backend *Backend) Close() error {
	backend.ratesUpdater.Stop()
	// Call this without `accountsAndKeystoreLock` as it eventually calls `DeregisterKeystore()`,
	// which acquires the same lock.
	if backend.usbManager != nil {
		backend.usbManager.Close()
	}

	defer backend.accountsAndKeystoreLock.Lock()()

	errors := []string{}

	backend.uninitAccounts(true)

	for _, coin := range backend.coins {
		if err := coin.Close(); err != nil {
			errors = append(errors, err.Error())
		}
	}
	if err := backend.notifier.Close(); err != nil {
		errors = append(errors, err.Error())
	}
	if len(errors) > 0 {
		return errp.New(strings.Join(errors, "; "))
	}

	backend.ethupdater.Close()
	return nil
}

// Banners returns the banners instance.
func (backend *Backend) Banners() *banners.Banners {
	return backend.banners
}

// HandleURI handles an external URI click for registered protocols, e.g. 'aopp:?...' URIs.  The uri
// param can be any string, as it is potentially passed without any validation from the calling
// platform.
func (backend *Backend) HandleURI(uri string) {
	u, err := url.Parse(uri)
	if err != nil {
		backend.log.WithError(err).Warningf("Handling URI failed: %s", uri)
		return
	}
	switch u.Scheme {
	case "aopp":
		backend.handleAOPP(*u)
	default:
		backend.log.Warningf("Unknown URI scheme: %s", uri)
	}
}

// SetOnline sets the backend's online status and notifies the frontend.
func (backend *Backend) SetOnline(online bool) {
	backend.log.Infof("Setting online status to %v", online)
	// If coming back online, trigger a reconnection.
	if online && !backend.isOnline.Load() {
		backend.ManualReconnect(true)
	}
	backend.isOnline.Store(online)
	backend.Notify(observable.Event{
		Subject: "online",
		Action:  action.Reload,
		Object:  online,
	})
}

// IsOnline returns whether the backend is online, i.e. able to connect to the internet.
func (backend *Backend) IsOnline() bool {
	return backend.isOnline.Load()
}

// GetAccountFromCode takes an account code as input and returns the corresponding accounts.Interface object,
// if found. It also initialize the account before returning it.
func (backend *Backend) GetAccountFromCode(acctCode accountsTypes.Code) (accounts.Interface, error) {
	// TODO: Refactor to make use of a map.
	var acct accounts.Interface
	for _, a := range backend.Accounts() {
		if a.Config().Config.Inactive {
			continue
		}
		if a.Config().Config.Code == acctCode {
			acct = a
			break
		}
	}
	if acct == nil {
		return nil, fmt.Errorf("unknown account code %q", acctCode)
	}

	if err := acct.Initialize(); err != nil {
		return nil, err
	}

	return acct, nil
}

// CancelConnectKeystore cancels a pending keystore connection request if one exists.
func (backend *Backend) CancelConnectKeystore() {
	backend.connectKeystore.cancel(errp.ErrUserAbort)
}

// SetWatchonly sets the keystore's watchonly flag to `watchonly`.
func (backend *Backend) SetWatchonly(rootFingerprint []byte, watchonly bool) error {
	err := backend.config.ModifyAccountsConfig(func(config *config.AccountsConfig) error {
		ks, err := config.LookupKeystore(rootFingerprint)
		if err != nil {
			return err
		}
		ks.Watchonly = watchonly
		return nil
	})
	if err != nil {
		return err
	}

	defer backend.accountsAndKeystoreLock.Lock()()
	backend.initAccounts(false)
	backend.emitAccountsStatusChanged()
	return nil
}

// ExportLogs function copy and save log.txt file to help users provide it to support while troubleshooting.
func (backend *Backend) ExportLogs() error {
	name := fmt.Sprintf("%s-log.txt", time.Now().Format("2006-01-02-at-15-04-05"))
	exportsDir, err := utilConfig.ExportsDir()
	if err != nil {
		backend.log.WithError(err).Error("error exporting logs")
		return err
	}
	suggestedPath := filepath.Join(exportsDir, name)
	path := backend.Environment().GetSaveFilename(suggestedPath)
	if path == "" {
		return nil
	}
	backend.log.Infof("Export logs to %s.", path)

	exportFile, err := os.Create(path)
	if err != nil {
		backend.log.WithError(err).Error("error creating new log file")
		return err
	}
	logFilePath := filepath.Join(utilConfig.AppDir(), "log.txt")

	if err := logging.WriteCombinedLog(exportFile, logFilePath); err != nil {
		backend.log.WithError(err).Error("error copying existing logs to new file")
		_ = exportFile.Close()
		return err
	}
	if err := exportFile.Close(); err != nil {
		backend.log.WithError(err).Error("error closing new log file")
		return err
	}
	backend.log.Infof("Exported logs copied to %s.", path)

	if err := backend.Environment().SystemOpen(path); err != nil {
		backend.log.WithError(err).Error("error opening log file")
		return err
	}
	return nil
}

// Bluetooth returns the backend's bluetooth instance.
func (backend *Backend) Bluetooth() *bluetooth.Bluetooth {
	return backend.bluetooth
}
