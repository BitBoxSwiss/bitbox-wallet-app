// Copyright 2018 Shift Devices AG
// Copyright 2020 Shift Crypto AG
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package backend

import (
	"bytes"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/btcsuite/btcd/chaincfg"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/accounts"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/arguments"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/banners"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/bitboxbase"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/bitboxbase/mdns"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/electrum"
	coinpkg "github.com/digitalbitbox/bitbox-wallet-app/backend/coins/coin"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/eth"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/eth/erc20"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/eth/etherscan"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/ltc"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/config"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/devices/bitbox"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/devices/device"
	deviceevent "github.com/digitalbitbox/bitbox-wallet-app/backend/devices/device/event"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/devices/usb"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/keystore"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/keystore/software"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/rates"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/signing"
	utilConfig "github.com/digitalbitbox/bitbox-wallet-app/util/config"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
	"github.com/digitalbitbox/bitbox-wallet-app/util/locker"
	"github.com/digitalbitbox/bitbox-wallet-app/util/logging"
	"github.com/digitalbitbox/bitbox-wallet-app/util/observable"
	"github.com/digitalbitbox/bitbox-wallet-app/util/observable/action"
	"github.com/digitalbitbox/bitbox-wallet-app/util/ratelimit"
	"github.com/digitalbitbox/bitbox-wallet-app/util/socksproxy"
	"github.com/ethereum/go-ethereum/params"
	"github.com/sirupsen/logrus"
)

func init() {
	electrum.SetClientSoftwareVersion(Version)
}

// fixedURLWhitelist is always allowed by SystemOpen, in addition to some
// adhoc URLs. See SystemOpen for details.
var fixedURLWhitelist = []string{
	// Shift Crypto owned domains.
	"https://shiftcrypto.ch/",
	"https://ext.shiftcrypto.ch/",
	"https://shop.shiftcrypto.ch/",
	"https://guides.shiftcrypto.ch/",
	// Exchange rates.
	"https://www.coingecko.com/",
	"https://www.cryptocompare.com/",
	// Block explorers.
	"https://blockstream.info/tx/",
	"https://blockstream.info/testnet/tx/",
	"http://explorer.litecointools.com/tx/",
	"https://insight.litecore.io/tx/",
	"https://etherscan.io/tx/",
	"https://rinkeby.etherscan.io/tx/",
	"https://ropsten.etherscan.io/tx/",
	// Moonpay onramp
	"https://www.moonpay.com/",
	"https://support.moonpay.com/",
	"https://support.moonpay.io/",
	"https://help.moonpay.io/",
	"https://help.moonpay.com/",
	// Documentation and other articles.
	"https://bitcoincore.org/en/2016/01/26/segwit-benefits/",
	"https://en.bitcoin.it/wiki/Bech32_adoption",
}

type backendEvent struct {
	Type string      `json:"type"`
	Data string      `json:"data"`
	Meta interface{} `json:"meta"`
}

type deviceEvent struct {
	DeviceID string `json:"deviceID"`
	Type     string `json:"type"`
	Data     string `json:"data"`
	// TODO: rename Data to Event, Meta to Data.
	Meta interface{} `json:"meta"`
}

// AccountEvent models an event triggered by an account.
type AccountEvent struct {
	Type string `json:"type"`
	Code string `json:"code"`
	Data string `json:"data"`
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
}

// Backend ties everything together and is the main starting point to use the BitBox wallet library.
type Backend struct {
	observable.Implementation

	arguments   *arguments.Arguments
	environment Environment

	config *config.Config

	events chan interface{}

	notifier *Notifier

	devices            map[string]device.Interface
	bitboxBases        map[string]*bitboxbase.BitBoxBase
	keystores          *keystore.Keystores
	onAccountInit      func(accounts.Interface)
	onAccountUninit    func(accounts.Interface)
	onDeviceInit       func(device.Interface)
	onDeviceUninit     func(string)
	onBitBoxBaseInit   func(*bitboxbase.BitBoxBase)
	onBitBoxBaseUninit func(string)

	coins     map[coinpkg.Code]coinpkg.Coin
	coinsLock locker.Locker

	accounts     []accounts.Interface
	accountsLock locker.Locker

	baseManager *mdns.Manager

	log *logrus.Entry

	socksProxy socksproxy.SocksProxy
	// can be a regular or, if Tor is enabled in the config, a SOCKS5 proxy client.
	httpClient          *http.Client
	etherScanHTTPClient *http.Client
	ratesUpdater        *rates.RateUpdater
	banners             *banners.Banners
}

// NewBackend creates a new backend with the given arguments.
func NewBackend(arguments *arguments.Arguments, environment Environment) (*Backend, error) {
	log := logging.Get().WithGroup("backend")
	config, err := config.NewConfig(arguments.AppConfigFilename(), arguments.AccountsConfigFilename())
	if err != nil {
		return nil, errp.WithStack(err)
	}
	log.Infof("backend config: %+v", config.AppConfig().Backend)
	log.Infof("frontend config: %+v", config.AppConfig().Frontend)
	backend := &Backend{
		arguments:   arguments,
		environment: environment,
		config:      config,
		events:      make(chan interface{}, 1000),

		devices:     map[string]device.Interface{},
		bitboxBases: map[string]*bitboxbase.BitBoxBase{},
		keystores:   keystore.NewKeystores(),
		coins:       map[coinpkg.Code]coinpkg.Coin{},
		accounts:    []accounts.Interface{},
		log:         log,
	}
	notifier, err := NewNotifier(filepath.Join(arguments.MainDirectoryPath(), "notifier.db"))
	if err != nil {
		return nil, err
	}
	backend.notifier = notifier
	backend.socksProxy = socksproxy.NewSocksProxy(
		backend.config.AppConfig().Backend.Proxy.UseProxy,
		backend.config.AppConfig().Backend.Proxy.ProxyAddress,
	)
	hclient, err := backend.socksProxy.GetHTTPClient()
	if err != nil {
		return nil, err
	}
	backend.httpClient = hclient
	backend.etherScanHTTPClient = ratelimit.FromTransport(hclient.Transport, etherscan.CallInterval)

	backend.baseManager = mdns.NewManager(
		backend.EmitBitBoxBaseDetected, backend.bitBoxBaseRegister,
		backend.BitBoxBaseDeregister, backend.BitBoxBaseRemove,
		backend.EmitBitBoxBaseReconnected, backend.config,
		backend.arguments.BitBoxBaseDirectoryPath(), backend.socksProxy)

	ratesCache := filepath.Join(arguments.CacheDirectoryPath(), "exchangerates")
	if err := os.MkdirAll(ratesCache, 0700); err != nil {
		log.Errorf("RateUpdater DB cache dir: %v", err)
	}
	backend.ratesUpdater = rates.NewRateUpdater(hclient, ratesCache)
	backend.ratesUpdater.Observe(backend.Notify)

	backend.banners = banners.NewBanners()
	backend.banners.Observe(backend.Notify)

	return backend, nil
}

// configureHistoryExchangeRates changes backend.ratesUpdater settings.
// It requires both backend.config to be up-to-date and all accounts initialized.
//
// The accountsLock must be held when calling this function.
func (backend *Backend) configureHistoryExchangeRates() {
	var coins []string
	for _, acct := range backend.accounts {
		coins = append(coins, string(acct.Coin().Code()))
	}
	// No reason continue with ERC20 tokens if Ethereum is inactive.
	// TODO: don't use deprecated setting to configure exchange rates.
	if backend.config.AppConfig().Backend.DeprecatedCoinActive(coinpkg.CodeETH) {
		for _, token := range backend.config.AppConfig().Backend.ETH.DeprecatedActiveERC20Tokens {
			// The prefix is stripped on the frontend and in app config.
			// TODO: Unify the prefix with frontend and erc20.go, and possibly
			// move all that to coins/coin/code or eth/erc20.
			coins = append(coins, "eth-erc20-"+token)
		}
	}
	fiats := backend.config.AppConfig().Backend.FiatList
	backend.ratesUpdater.ReconfigureHistory(coins, fiats)
}

// addAccount adds the given account to the backend.
// The accountsLock must be held when calling this function.
func (backend *Backend) addAccount(account accounts.Interface) {
	backend.accounts = append(backend.accounts, account)
	account.Observe(backend.Notify)
	backend.onAccountInit(account)
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
		backend.events <- backendEvent{Type: "backend", Data: "newTxs", Meta: map[string]interface{}{
			"count":       unnotifiedCount,
			"accountName": account.Config().Name,
		}}

		if err := notifier.MarkAllNotified(); err != nil {
			backend.log.WithError(err).Error("error marking notified")
		}
	}
}

func (backend *Backend) emitAccountsStatusChanged() {
	backend.Notify(observable.Event{
		Subject: "accounts",
		Action:  action.Reload,
	})
}

// persistAccount adds the account information to the accounts database. These accounts are loaded
// in `initPersistedAccounts()`.
func (backend *Backend) persistAccount(account config.Account, accountsConfig *config.AccountsConfig) error {
	for idx := range accountsConfig.Accounts {
		account2 := &accountsConfig.Accounts[idx]
		if account.CoinCode == account2.CoinCode {
			// We detect a duplicate account (subaccount in a unified account) if any of the
			// configurations is already present.
			for _, config := range account.Configurations {
				for _, config2 := range account2.Configurations {
					if config.Hash() == config2.Hash() {
						return errp.WithStack(ErrAccountAlreadyExists)
					}
				}
			}

		}
	}
	accountsConfig.Accounts = append(accountsConfig.Accounts, account)
	return nil

}

// The accountsLock must be held when calling this function.
func (backend *Backend) createAndAddAccount(
	coin coinpkg.Coin,
	code string,
	name string,
	signingConfigurations signing.Configurations,
	activeTokens []string,
) {
	var account accounts.Interface
	accountConfig := &accounts.AccountConfig{
		Code:        code,
		Name:        name,
		DBFolder:    backend.arguments.CacheDirectoryPath(),
		NotesFolder: backend.arguments.NotesDirectoryPath(),
		Keystores:   backend.keystores,
		OnEvent: func(event accounts.Event) {
			backend.events <- AccountEvent{Type: "account", Code: code, Data: string(event)}
			if account != nil && event == accounts.EventSyncDone {
				backend.notifyNewTxs(account)
			}
		},
		RateUpdater:           backend.ratesUpdater,
		SigningConfigurations: signingConfigurations,
		GetNotifier: func(configurations signing.Configurations) accounts.Notifier {
			return backend.notifier.ForAccount(fmt.Sprintf("%s-%s", configurations.Hash(), code))
		},
	}

	switch specificCoin := coin.(type) {
	case *btc.Coin:
		account = btc.NewAccount(
			accountConfig,
			specificCoin,
			backend.arguments.GapLimits(),
			backend.log,
		)
		backend.addAccount(account)
	case *eth.Coin:
		account = eth.NewAccount(accountConfig, specificCoin, backend.log)
		backend.addAccount(account)

		// Load ERC20 tokens enabled with this Ethereum account.
		for _, erc20TokenCode := range activeTokens {
			token, err := backend.Coin(coinpkg.Code(erc20TokenCode))
			if err != nil {
				backend.log.WithError(err).Error("could not find ERC20 token")
				continue
			}
			backend.createAndAddAccount(token, erc20TokenCode, token.Name(), signingConfigurations, nil)
		}
	default:
		panic("unknown coin type")
	}
}

type scriptTypeWithKeypath struct {
	scriptType signing.ScriptType
	keypath    signing.AbsoluteKeypath
}

// adds a combined BTC account with the given script types.
func (backend *Backend) persistBTCAccountConfig(
	keystore keystore.Keystore,
	coin coinpkg.Coin,
	code string,
	name string,
	configs []scriptTypeWithKeypath,
	accountsConfig *config.AccountsConfig,
) error {
	log := backend.log.WithField("code", code).WithField("name", name)
	var supportedConfigs []scriptTypeWithKeypath
	for _, cfg := range configs {
		if keystore.SupportsAccount(coin, cfg.scriptType) {
			supportedConfigs = append(supportedConfigs, cfg)
		}
	}
	if len(supportedConfigs) == 0 {
		log.Info("skipping unsupported account")
		return nil
	}
	log.Info("persist account")

	var signingConfigurations signing.Configurations
	for _, cfg := range supportedConfigs {
		extendedPublicKey, err := keystore.ExtendedPublicKey(coin, cfg.keypath)
		if err != nil {
			log.WithError(err).Errorf(
				"Could not derive xpub at keypath %s", cfg.keypath.Encode())
			continue
		}

		signingConfiguration := signing.NewBitcoinConfiguration(
			cfg.scriptType,
			cfg.keypath,
			extendedPublicKey,
		)
		signingConfigurations = append(signingConfigurations, signingConfiguration)
	}
	rootFingerprint, err := keystore.RootFingerprint()
	if err != nil {
		return err
	}
	return backend.persistAccount(config.Account{
		CoinCode:                coin.Code(),
		Name:                    name,
		Code:                    code,
		SupportsUnifiedAccounts: keystore.SupportsUnifiedAccounts(),
		RootFingerprint:         rootFingerprint,
		Configurations:          signingConfigurations,
	}, accountsConfig)
}

func (backend *Backend) persistETHAccountConfig(
	keystore keystore.Keystore,
	coin coinpkg.Coin,
	code string,
	keypath string,
	name string,
	accountsConfig *config.AccountsConfig,
) error {
	log := backend.log.
		WithField("code", code).
		WithField("name", name).
		WithField("keypath", keypath)

	if !keystore.SupportsAccount(coin, nil) {
		log.Info("skipping unsupported account")
		return nil
	}

	log.Info("persist account")
	absoluteKeypath, err := signing.NewAbsoluteKeypath(keypath)
	if err != nil {
		panic(err)
	}
	extendedPublicKey, err := keystore.ExtendedPublicKey(coin, absoluteKeypath)
	if err != nil {
		return err
	}

	signingConfigurations := signing.Configurations{
		signing.NewEthereumConfiguration(
			absoluteKeypath,
			extendedPublicKey,
		),
	}
	// In the past, ERC20 tokens were configured to be active or inactive globally, now they are
	// active/inactive per ETH account. We use the previous global settings to decide the default
	// set of active tokens, for a smoother migration for the user.
	var activeTokens []string
	if coin.Code() == coinpkg.CodeETH {
		for _, tokenCode := range backend.config.AppConfig().Backend.ETH.DeprecatedActiveERC20Tokens {
			prefix := "eth-erc20-"
			// Old config entries did not contain this prefix, but the token codes in the new config
			// do, to match the codes listed in erc20.go
			activeTokens = append(activeTokens, prefix+tokenCode)
		}
	}

	rootFingerprint, err := keystore.RootFingerprint()
	if err != nil {
		return err
	}
	return backend.persistAccount(config.Account{
		CoinCode:                coin.Code(),
		Name:                    name,
		Code:                    code,
		SupportsUnifiedAccounts: keystore.SupportsUnifiedAccounts(),
		RootFingerprint:         rootFingerprint,
		Configurations:          signingConfigurations,
		ActiveTokens:            activeTokens,
	}, accountsConfig)
}

// Config returns the app config.
func (backend *Backend) Config() *config.Config {
	return backend.config
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
		return []*config.ServerInfo{{Server: "btc1.shiftcrypto.dev:50001", TLS: true, PEMCert: devShiftCA}}
	case coinpkg.CodeTBTC:
		return []*config.ServerInfo{
			{Server: "tbtc1.shiftcrypto.dev:51001", TLS: true, PEMCert: devShiftCA},
			{Server: "tbtc2.shiftcrypto.dev:51002", TLS: true, PEMCert: devShiftCA},
		}
	case coinpkg.CodeRBTC:
		return []*config.ServerInfo{{Server: "127.0.0.1:52001", TLS: false, PEMCert: ""}}
	case coinpkg.CodeLTC:
		return []*config.ServerInfo{{Server: "ltc1.shiftcrypto.dev:50011", TLS: true, PEMCert: devShiftCA}}
	case coinpkg.CodeTLTC:
		return []*config.ServerInfo{{Server: "tltc1.shiftcrypto.dev:51011", TLS: true, PEMCert: devShiftCA}}
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

// Coin returns the coin with the given code or an error if no such coin exists.
func (backend *Backend) Coin(code coinpkg.Code) (coinpkg.Coin, error) {
	defer backend.coinsLock.Lock()()
	coin, ok := backend.coins[code]
	if ok {
		return coin, nil
	}
	dbFolder := backend.arguments.CacheDirectoryPath()

	erc20Token := erc20TokenByCode(code)
	switch {
	case code == coinpkg.CodeRBTC:
		servers := backend.defaultElectrumXServers(code)
		coin = btc.NewCoin(coinpkg.CodeRBTC, "Bitcoin Regtest", "RBTC", &chaincfg.RegressionNetParams, dbFolder, servers, "", backend.socksProxy)
	case code == coinpkg.CodeTBTC:
		servers := backend.defaultElectrumXServers(code)
		coin = btc.NewCoin(coinpkg.CodeTBTC, "Bitcoin Testnet", "TBTC", &chaincfg.TestNet3Params, dbFolder, servers,
			"https://blockstream.info/testnet/tx/", backend.socksProxy)
	case code == coinpkg.CodeBTC:
		servers := backend.defaultElectrumXServers(code)
		coin = btc.NewCoin(coinpkg.CodeBTC, "Bitcoin", "BTC", &chaincfg.MainNetParams, dbFolder, servers,
			"https://blockstream.info/tx/", backend.socksProxy)
	case code == coinpkg.CodeTLTC:
		servers := backend.defaultElectrumXServers(code)
		coin = btc.NewCoin(coinpkg.CodeTLTC, "Litecoin Testnet", "TLTC", &ltc.TestNet4Params, dbFolder, servers,
			"http://explorer.litecointools.com/tx/", backend.socksProxy)
	case code == coinpkg.CodeLTC:
		servers := backend.defaultElectrumXServers(code)
		coin = btc.NewCoin(coinpkg.CodeLTC, "Litecoin", "LTC", &ltc.MainNetParams, dbFolder, servers,
			"https://insight.litecore.io/tx/", backend.socksProxy)
	case code == coinpkg.CodeETH:
		etherScan := etherscan.NewEtherScan("https://api.etherscan.io/api", backend.etherScanHTTPClient)
		coin = eth.NewCoin(etherScan, code, "Ethereum", "ETH", "ETH", params.MainnetChainConfig,
			"https://etherscan.io/tx/",
			etherScan,
			nil)
	case code == coinpkg.CodeRETH:
		etherScan := etherscan.NewEtherScan("https://api-rinkeby.etherscan.io/api", backend.etherScanHTTPClient)
		coin = eth.NewCoin(etherScan, code, "Ethereum Rinkeby", "RETH", "RETH", params.RinkebyChainConfig,
			"https://rinkeby.etherscan.io/tx/",
			etherScan,
			nil)
	case code == coinpkg.CodeTETH:
		etherScan := etherscan.NewEtherScan("https://api-ropsten.etherscan.io/api", backend.etherScanHTTPClient)
		coin = eth.NewCoin(etherScan, code, "Ethereum Ropsten", "TETH", "TETH", params.TestnetChainConfig,
			"https://ropsten.etherscan.io/tx/",
			etherScan,
			nil)
	case code == coinpkg.CodeERC20TEST:
		etherScan := etherscan.NewEtherScan("https://api-ropsten.etherscan.io/api", backend.etherScanHTTPClient)
		coin = eth.NewCoin(etherScan, code, "ERC20 TEST", "TEST", "TETH", params.TestnetChainConfig,
			"https://ropsten.etherscan.io/tx/",
			etherScan,
			erc20.NewToken("0x2f45b6fb2f28a73f110400386da31044b2e953d4", 18),
		)
	case erc20Token != nil:
		etherScan := etherscan.NewEtherScan("https://api.etherscan.io/api", backend.etherScanHTTPClient)
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

// The accountsLock must be held when calling this function.
func (backend *Backend) initPersistedAccounts() {
	// Only load accounts which belong to connected keystores.
	var connectedFingerprints [][]byte
	for _, keystore := range backend.keystores.Keystores() {
		rootFingerprint, err := keystore.RootFingerprint()
		if err != nil {
			backend.log.WithError(err).Error("Could not retrieve root fingerprint")
			continue
		}
		connectedFingerprints = append(connectedFingerprints, rootFingerprint)
	}
	keystoreConnected := func(account *config.Account) bool {
		for _, fingerprint := range connectedFingerprints {
			if bytes.Equal(fingerprint, account.RootFingerprint) {
				return true
			}
		}
		return false
	}

	persistedAccounts := backend.config.AccountsConfig()
	for _, account := range backend.filterAccounts(&persistedAccounts, keystoreConnected) {
		coin, err := backend.Coin(account.CoinCode)
		if err != nil {
			backend.log.Errorf("skipping persisted account %s/%s, could not find coin",
				account.CoinCode, account.Code)
			continue
		}

		// We split accounts if the user setting dictates it or if the keystore connected to the
		// account does not support unified accounts.

		var isBTCBased bool
		switch account.CoinCode {
		case coinpkg.CodeBTC, coinpkg.CodeTBTC, coinpkg.CodeRBTC, coinpkg.CodeLTC, coinpkg.CodeTLTC:
			isBTCBased = true
		}
		splitAccounts := isBTCBased && (backend.config.AppConfig().Backend.SplitAccounts ||
			!account.SupportsUnifiedAccounts)

		if splitAccounts {
			for _, signingConfiguration := range account.Configurations {
				suffixedName := account.Name
				switch signingConfiguration.ScriptType() {
				case signing.ScriptTypeP2PKH:
					suffixedName += ": legacy"
				case signing.ScriptTypeP2WPKH:
					suffixedName += ": bech32"
				}
				backend.createAndAddAccount(
					coin,
					fmt.Sprintf("%s-%s", account.Code, signingConfiguration.ScriptType()),
					suffixedName,
					signing.Configurations{signingConfiguration},
					account.ActiveTokens,
				)
			}
		} else {
			backend.createAndAddAccount(
				coin, account.Code, account.Name, account.Configurations, account.ActiveTokens)
		}
	}
}

// persistDefaultAccountConfigs persists a bunch of default accounts for the connected keystore (not
// manually user-added). Currently the first bip44 account of BTC/LTC/ETH. ERC20 tokens are added if
// they were configured to be active by the user in the past, when they could still configure them
// globally in the settings.
//
// The accounts are only added for the coins that are marked active in the settings. This used to be
// a user-facing setting. Now we simply use it for migration to decide which coins to add by
// default.
func (backend *Backend) persistDefaultAccountConfigs(keystore keystore.Keystore, accountsConfig *config.AccountsConfig) error {
	if backend.arguments.Testing() {
		if backend.arguments.Regtest() {
			if backend.config.AppConfig().Backend.DeprecatedCoinActive(coinpkg.CodeRBTC) {
				if err := backend.createAndPersistAccountConfig(coinpkg.CodeRBTC, 0, "", keystore, accountsConfig); err != nil {
					return err
				}
			}
		} else {
			for _, coinCode := range []coinpkg.Code{coinpkg.CodeTBTC, coinpkg.CodeTLTC, coinpkg.CodeTETH, coinpkg.CodeRETH} {
				if backend.config.AppConfig().Backend.DeprecatedCoinActive(coinCode) {
					if err := backend.createAndPersistAccountConfig(coinCode, 0, "", keystore, accountsConfig); err != nil {
						return err

					}
				}
			}
		}
	} else {
		for _, coinCode := range []coinpkg.Code{coinpkg.CodeBTC, coinpkg.CodeLTC, coinpkg.CodeETH} {
			if backend.config.AppConfig().Backend.DeprecatedCoinActive(coinCode) {
				if err := backend.createAndPersistAccountConfig(coinCode, 0, "", keystore, accountsConfig); err != nil {
					return err
				}
			}
		}
	}
	return nil
}

// The accountsLock must be held when calling this function.
func (backend *Backend) initAccounts() {
	// Since initAccounts replaces all previous accounts, we need to properly close them first.
	backend.uninitAccounts()

	backend.initPersistedAccounts()

	backend.emitAccountsStatusChanged()

	// The updater fetches rates only for active accounts, so this seems the most
	// appropriate place to update exchange rate configuration.
	// Every time fiats or coins list is changed in the UI settings, ReinitializedAccounts
	// is invoked which triggers this method.
	backend.configureHistoryExchangeRates()
}

// ReinitializeAccounts uninits and then reinits all accounts. This is useful to reload the accounts
// if the configuration changed (e.g. which accounts are active). This is a stopgap measure until
// accounts can be added and removed individually.
func (backend *Backend) ReinitializeAccounts() {
	defer backend.accountsLock.Lock()()

	backend.log.Info("Reinitializing accounts")
	backend.initAccounts()
}

// Testing returns whether this backend is for testing only.
func (backend *Backend) Testing() bool {
	return backend.arguments.Testing()
}

// Accounts returns the current accounts of the backend.
func (backend *Backend) Accounts() []accounts.Interface {
	defer backend.accountsLock.RLock()()
	return backend.accounts
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

// OnBitBoxBaseInit installs a callback to be called when a bitboxbase is initialized.
func (backend *Backend) OnBitBoxBaseInit(f func(*bitboxbase.BitBoxBase)) {
	backend.onBitBoxBaseInit = f
}

// OnBitBoxBaseUninit installs a callback to be called when a bitboxbase is uninitialized.
func (backend *Backend) OnBitBoxBaseUninit(f func(string)) {
	backend.onBitBoxBaseUninit = f
}

// Start starts the background services. It returns a channel of events to handle by the library
// client.
func (backend *Backend) Start() <-chan interface{} {
	usb.NewManager(
		backend.arguments.MainDirectoryPath(),
		backend.arguments.BitBox02DirectoryPath(),
		backend.socksProxy,
		backend.environment.DeviceInfos,
		backend.Register,
		backend.Deregister).Start()

	httpClient, err := backend.socksProxy.GetHTTPClient()
	if err != nil {
		backend.log.Error(err.Error())
	} else {
		go backend.banners.Init(httpClient)
	}

	if backend.arguments.DevMode() {
		backend.baseManager.Start()
	}

	defer backend.accountsLock.Lock()()
	backend.initPersistedAccounts()
	backend.emitAccountsStatusChanged()

	backend.ratesUpdater.StartCurrentRates()
	backend.configureHistoryExchangeRates()

	return backend.events
}

// TryMakeNewBase calls TryMakeNewBase() in the manager with the given ip.
func (backend *Backend) TryMakeNewBase(ip string) (bool, error) {
	return backend.baseManager.TryMakeNewBase(ip)
}

// DevicesRegistered returns a map of device IDs to device of registered devices.
func (backend *Backend) DevicesRegistered() map[string]device.Interface {
	return backend.devices
}

// BitBoxBasesRegistered returns a map of bitboxBaseIDs and registered bitbox bases.
func (backend *Backend) BitBoxBasesRegistered() map[string]*bitboxbase.BitBoxBase {
	return backend.bitboxBases
}

// BitBoxBasesDetected returns a map of IPs and Hostnames of detected Bases.
func (backend *Backend) BitBoxBasesDetected() map[string]string {
	return backend.baseManager.GetDetectedBases()
}

// EmitBitBoxBaseDetected notifies the frontend that the manager.detectedBases has changed.
func (backend *Backend) EmitBitBoxBaseDetected() {
	backend.events <- backendEvent{Type: "bitboxbases", Data: "detectedChanged"}
}

// EmitBitBoxBaseReconnected notifies the frontend that a previously registered Base has successfully reconnected.
func (backend *Backend) EmitBitBoxBaseReconnected(bitboxBaseID string) {
	backend.events <- backendEvent{Type: "bitboxbases", Data: "reconnected", Meta: map[string]interface{}{
		"ID": bitboxBaseID,
	}}
}

// bitBoxBaseRegister registers the given bitboxbase at this backend.
func (backend *Backend) bitBoxBaseRegister(theBase *bitboxbase.BitBoxBase, hostname string, ip string) error {
	backend.bitboxBases[theBase.Identifier()] = theBase
	backend.onBitBoxBaseInit(theBase)
	theBase.Observe(backend.Notify)
	select {
	case backend.events <- backendEvent{
		Type: "bitboxbases",
		Data: "registeredChanged",
		Meta: map[string]interface{}{
			"ip":       ip,
			"hostname": hostname,
		},
	}:
	default:
	}
	return nil
}

// BitBoxBaseRemove removes a Base from the backend in the case it has not been fully connected
// i.e., if the noise pairing wasn't completed and so the RPC connection not established.
func (backend *Backend) BitBoxBaseRemove(bitboxBaseID string) {
	backend.baseManager.RemoveBase(bitboxBaseID)
	delete(backend.bitboxBases, bitboxBaseID)
	backend.events <- backendEvent{Type: "bitboxbases", Data: "registeredChanged"}
}

// BitBoxBaseDeregister deregisters the device with the given ID from this backend.
func (backend *Backend) BitBoxBaseDeregister(bitboxBaseID string) {
	if _, ok := backend.bitboxBases[bitboxBaseID]; ok {
		backend.bitboxBases[bitboxBaseID].Close()
		backend.onBitBoxBaseUninit(bitboxBaseID)
		delete(backend.bitboxBases, bitboxBaseID)
		backend.baseManager.RemoveBase(bitboxBaseID)
		backend.events <- backendEvent{Type: "bitboxbases", Data: "registeredChanged"}
	}
	backend.events <- backendEvent{Type: "bitboxbases", Data: "registeredChanged"}
}

// The accountsLock must be held when calling this function.
func (backend *Backend) uninitAccounts() {
	for _, account := range backend.accounts {
		account := account
		backend.onAccountUninit(account)
		account.Close()
	}
	backend.accounts = []accounts.Interface{}
}

// Keystores returns the keystores registered at this backend.
func (backend *Backend) Keystores() *keystore.Keystores {
	return backend.keystores
}

// registerKeystore registers the given keystore at this backend.
func (backend *Backend) registerKeystore(keystore keystore.Keystore) {
	backend.log.Info("registering keystore")
	if err := backend.keystores.Add(keystore); err != nil {
		backend.log.Panic("Failed to add a keystore.", err)
	}
	backend.Notify(observable.Event{
		Subject: "keystores",
		Action:  action.Reload,
	})

	belongsToKeystore := func(account *config.Account) bool {
		fingerprint, err := keystore.RootFingerprint()
		if err != nil {
			backend.log.WithError(err).Error("Could not retrieve root fingerprint")
			return false
		}
		return bytes.Equal(fingerprint, account.RootFingerprint)
	}
	err := backend.config.ModifyAccountsConfig(func(accountsConfig *config.AccountsConfig) error {
		if len(backend.filterAccounts(accountsConfig, belongsToKeystore)) != 0 {
			return nil
		}
		return backend.persistDefaultAccountConfigs(keystore, accountsConfig)
	})
	if err != nil {
		backend.log.WithError(err).Error("Could not persist default accounts")
	}

	defer backend.accountsLock.Lock()()
	backend.initAccounts()
}

// DeregisterKeystore removes the registered keystore.
func (backend *Backend) DeregisterKeystore() {
	backend.log.Info("deregistering keystore")
	backend.keystores = keystore.NewKeystores()
	backend.Notify(observable.Event{
		Subject: "keystores",
		Action:  action.Reload,
	})

	defer backend.accountsLock.Lock()()

	backend.uninitAccounts()
	// TODO: classify accounts by keystore, remove only the ones belonging to the deregistered
	// keystore. For now we just remove all, then re-add the rest.
	backend.initPersistedAccounts()
	backend.emitAccountsStatusChanged()
}

// Register registers the given device at this backend.
func (backend *Backend) Register(theDevice device.Interface) error {
	backend.devices[theDevice.Identifier()] = theDevice

	mainKeystore := len(backend.devices) == 1
	theDevice.SetOnEvent(func(event deviceevent.Event, data interface{}) {
		switch event {
		case deviceevent.EventKeystoreGone:
			backend.DeregisterKeystore()
		case deviceevent.EventKeystoreAvailable:
			if mainKeystore {
				// HACK: for device based, only one is supported at the moment.
				backend.keystores = keystore.NewKeystores()

				backend.registerKeystore(theDevice.Keystore())
			}
		}
		backend.events <- deviceEvent{
			DeviceID: theDevice.Identifier(),
			Type:     "device",
			Data:     string(event),
			Meta:     data,
		}
	})

	backend.onDeviceInit(theDevice)
	if err := theDevice.Init(backend.Testing()); err != nil {
		backend.onDeviceUninit(theDevice.Identifier())
		return err
	}
	theDevice.Observe(backend.Notify)

	// Old-school
	select {
	case backend.events <- backendEvent{
		Type: "devices",
		Data: "registeredChanged",
	}:
	default:
	}
	// New-school
	backend.Notify(observable.Event{
		Subject: "devices/registered",
		Action:  action.Reload,
	})

	switch theDevice.ProductName() {
	case bitbox.ProductName:
		backend.banners.Activate(banners.KeyBitBox01)
	}
	return nil
}

// Deregister deregisters the device with the given ID from this backend.
func (backend *Backend) Deregister(deviceID string) {
	if _, ok := backend.devices[deviceID]; ok {
		backend.onDeviceUninit(deviceID)
		delete(backend.devices, deviceID)
		backend.DeregisterKeystore()

		// Old-school
		backend.events <- backendEvent{Type: "devices", Data: "registeredChanged"}
		// New-school
		backend.Notify(observable.Event{
			Subject: "devices/registered",
			Action:  action.Reload,
		})
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
// If an item is a prefix of url, it is allowed to be openend. Otherwise, an ad-hoc
// patter matching is performed for URLs like the CSV export download path.
//
// If none matched, an ad-hoc URL construction failed or opening a URL failed,
// an error is returned.
func (backend *Backend) SystemOpen(url string) error {
	for _, whitelisted := range fixedURLWhitelist {
		if strings.HasPrefix(url, whitelisted) {
			return backend.environment.SystemOpen(url)
		}
	}

	if runtime.GOOS != "android" { // TODO: fix DownloadsDir() for android
		// Whitelist CSV export.
		downloadDir, err := utilConfig.DownloadsDir()
		if err != nil {
			return err
		}
		if strings.HasPrefix(url, downloadDir) {
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
	defer backend.accountsLock.Lock()()

	errors := []string{}

	backend.ratesUpdater.Stop()

	backend.uninitAccounts()

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
	return nil
}

// Banners returns the banners instance.
func (backend *Backend) Banners() *banners.Banners {
	return backend.banners
}
