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
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
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
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/coin"
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

// ErrAccountAlreadyExists is returned if an account is being added which already exists.
var ErrAccountAlreadyExists = errors.New("already exists")

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

	coins     map[coinpkg.Code]coin.Coin
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
		coins:       map[coinpkg.Code]coin.Coin{},
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
		backend.config.AppConfig().Backend.Proxy.ProxyAddressOrDefault(),
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
	if backend.config.AppConfig().Backend.CoinActive(coin.CodeETH) {
		for _, token := range backend.config.AppConfig().Backend.ETH.ActiveERC20Tokens {
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

// The accountsLock must be held when calling this function.
func (backend *Backend) createAndAddAccount(
	coin coin.Coin,
	code string,
	name string,
	getSigningConfigurations func() (signing.Configurations, error),
	persist bool,
	emitEvent bool,
) error {
	if persist {
		configurations, err := getSigningConfigurations()
		if err != nil {
			return err
		}
		if len(configurations) != 1 {
			// TODO: unified-accounts
			return errp.New("Watch-only accounts don't support mixed inputs yet")
		}
		configuration := configurations[0]
		accountsConfig := backend.config.AccountsConfig()
		for _, account := range accountsConfig.Accounts {
			if account.Configuration.Hash() == configuration.Hash() && account.CoinCode == coin.Code() {
				return errp.WithStack(ErrAccountAlreadyExists)
			}
		}
		accountsConfig.Accounts = append(accountsConfig.Accounts, config.Account{
			CoinCode:      coin.Code(),
			Code:          code,
			Name:          name,
			Configuration: configuration,
		})
		if err := backend.config.SetAccountsConfig(accountsConfig); err != nil {
			return err
		}
	}

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
		RateUpdater:              backend.ratesUpdater,
		GetSigningConfigurations: getSigningConfigurations,
		GetNotifier: func(configurations signing.Configurations) accounts.Notifier {
			return backend.notifier.ForAccount(fmt.Sprintf("%s-%s", configurations.Hash(), code))
		},
	}

	accountAdded := false
	switch specificCoin := coin.(type) {
	case *btc.Coin:
		account = btc.NewAccount(
			accountConfig,
			specificCoin,
			backend.arguments.GapLimits(),
			backend.log,
		)
		backend.addAccount(account)
		accountAdded = true
	case *eth.Coin:
		account = eth.NewAccount(accountConfig, specificCoin, backend.log)
		backend.addAccount(account)
		accountAdded = true
	default:
		panic("unknown coin type")
	}
	if emitEvent && accountAdded {
		backend.emitAccountsStatusChanged()
	}
	return nil
}

// CreateAndAddAccount creates an account with the given parameters and adds it to the backend. If
// persist is true, the configuration is fetched and saved in the accounts configuration.
func (backend *Backend) CreateAndAddAccount(
	coin coin.Coin,
	code string,
	name string,
	getSigningConfigurations func() (signing.Configurations, error),
	persist bool,
	emitEvent bool,
) error {
	defer backend.accountsLock.Lock()()
	return backend.createAndAddAccount(coin, code, name, getSigningConfigurations, persist, emitEvent)
}

type scriptTypeWithKeypath struct {
	scriptType signing.ScriptType
	keypath    signing.AbsoluteKeypath
}

func newScriptTypeWithKeypath(scriptType signing.ScriptType, keypath string) scriptTypeWithKeypath {
	absoluteKeypath, err := signing.NewAbsoluteKeypath(keypath)
	if err != nil {
		panic(err)
	}
	return scriptTypeWithKeypath{
		scriptType: scriptType,
		keypath:    absoluteKeypath,
	}
}

// adds a combined BTC account with the given script types. If the keystore requires split accounts
// (bitbox01) or the user configure split accounts in the settings, one account per script type is
// added instead of a combined account.
//
// The accountsLock must be held when calling this function.
func (backend *Backend) createAndAddBTCAccount(
	keystore keystore.Keystore,
	coin coin.Coin,
	code string,
	configs []scriptTypeWithKeypath,
) {
	name := coin.Name()
	log := backend.log.WithField("code", code).WithField("name", name)
	if !backend.config.AppConfig().Backend.CoinActive(coin.Code()) {
		log.Info("skipping inactive account")
		return
	}
	var supportedConfigs []scriptTypeWithKeypath
	for _, cfg := range configs {
		if keystore.SupportsAccount(coin, false, cfg.scriptType) {
			supportedConfigs = append(supportedConfigs, cfg)
		}
	}
	if len(supportedConfigs) == 0 {
		log.Info("skipping unsupported account")
		return
	}
	log.Info("init account")

	getSigningConfiguration := func(cfg scriptTypeWithKeypath) (*signing.Configuration, error) {
		extendedPublicKey, err := keystore.ExtendedPublicKey(coin, cfg.keypath)
		if err != nil {
			return nil, err
		}

		return signing.NewSinglesigConfiguration(
			cfg.scriptType,
			cfg.keypath,
			extendedPublicKey,
		), nil
	}

	splitAccounts := backend.config.AppConfig().Backend.SplitAccounts ||
		!keystore.SupportsUnifiedAccounts()
	if splitAccounts {
		for _, cfg := range supportedConfigs {
			cfg := cfg
			getSigningConfigurations := func() (signing.Configurations, error) {
				signingConfiguration, err := getSigningConfiguration(cfg)
				if err != nil {
					return nil, err
				}
				return signing.Configurations{signingConfiguration}, nil
			}
			suffixedName := name
			switch cfg.scriptType {
			case signing.ScriptTypeP2PKH:
				suffixedName += ": legacy"
			case signing.ScriptTypeP2WPKH:
				suffixedName += ": bech32"
			}
			err := backend.createAndAddAccount(
				coin,
				fmt.Sprintf("%s-%s", code, cfg.scriptType),
				suffixedName,
				getSigningConfigurations,
				false, false,
			)
			if err != nil {
				panic(err)
			}
		}
	} else {
		getSigningConfigurations := func() (signing.Configurations, error) {
			var result signing.Configurations
			for _, cfg := range supportedConfigs {
				signingConfiguration, err := getSigningConfiguration(cfg)
				if err != nil {
					return nil, err
				}
				result = append(result, signingConfiguration)
			}
			return result, nil
		}
		err := backend.createAndAddAccount(coin, code, name, getSigningConfigurations, false, false)
		if err != nil {
			panic(err)
		}
	}
}

// The accountsLock must be held when calling this function.
func (backend *Backend) createAndAddETHAccount(
	keystore keystore.Keystore,
	coin coin.Coin,
	code string,
	keypath string,
) {
	name := coin.Name()
	log := backend.log.WithField("code", code).WithField("name", name)
	prefix := "eth-erc20-"
	if strings.HasPrefix(code, prefix) {
		if !backend.config.AppConfig().Backend.ETH.ERC20TokenActive(code[len(prefix):]) {
			log.Info("skipping inactive erc20 token")
			return
		}
	} else if !backend.config.AppConfig().Backend.CoinActive(coin.Code()) {
		log.Info("skipping inactive account")
		return
	}

	if !keystore.SupportsAccount(coin, false, nil) {
		log.Info("skipping unsupported account")
		return
	}

	log.Info("init account")
	absoluteKeypath, err := signing.NewAbsoluteKeypath(keypath)
	if err != nil {
		panic(err)
	}
	getSigningConfigurations := func() (signing.Configurations, error) {
		extendedPublicKey, err := keystore.ExtendedPublicKey(coin, absoluteKeypath)
		if err != nil {
			return nil, err
		}

		return signing.Configurations{
			signing.NewSinglesigConfiguration(
				signing.ScriptTypeP2PKH, // TODO: meaningless in Ethereum
				absoluteKeypath,
				extendedPublicKey,
			),
		}, nil
	}
	err = backend.createAndAddAccount(coin, code, name, getSigningConfigurations, false, false)
	if err != nil {
		panic(err)
	}
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
func (backend *Backend) Coin(code coinpkg.Code) (coin.Coin, error) {
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
	for _, account := range backend.config.AccountsConfig().Accounts {
		account := account
		if _, isTestnet := coinpkg.TestnetCoins[account.CoinCode]; isTestnet != backend.Testing() {
			// Don't load testnet accounts when running normally, nor mainnet accounts when running
			// in testing mode
			continue
		}
		coin, err := backend.Coin(account.CoinCode)
		if err != nil {
			backend.log.Errorf("skipping persisted account %s/%s, could not find coin",
				account.CoinCode, account.Code)
			continue
		}
		getSigningConfigurations := func() (signing.Configurations, error) {
			return signing.Configurations{account.Configuration}, nil
		}
		err = backend.createAndAddAccount(coin, account.Code, account.Name, getSigningConfigurations, false, false)
		if err != nil {
			panic(err)
		}
	}
}

// initDefaultAccounts creates a bunch of default accounts for a set of keystores (not manually
// user-added). Currently the first bip44 account for all supported and active account types.
//
// The accountsLock must be held when calling this function.
func (backend *Backend) initDefaultAccounts() {
	if backend.keystores.Count() == 0 {
		return
	}
	if backend.keystores.Count() > 1 {
		// If needed, insert multisig account initialization here based on multiple connected
		// keystores.
		return
	}
	keystore := backend.keystores.Keystores()[0]
	if backend.arguments.Testing() {
		if backend.arguments.Regtest() {
			RBTC, _ := backend.Coin(coinpkg.CodeRBTC)
			backend.createAndAddBTCAccount(keystore, RBTC,
				"rbtc",
				[]scriptTypeWithKeypath{
					newScriptTypeWithKeypath(signing.ScriptTypeP2WPKHP2SH, "m/49'/1'/0'"),
					newScriptTypeWithKeypath(signing.ScriptTypeP2PKH, "m/44'/1'/0'"),
				},
			)
		} else {
			TBTC, _ := backend.Coin(coinpkg.CodeTBTC)
			backend.createAndAddBTCAccount(keystore, TBTC,
				"tbtc",
				[]scriptTypeWithKeypath{
					newScriptTypeWithKeypath(signing.ScriptTypeP2WPKH, "m/84'/1'/0'"),
					newScriptTypeWithKeypath(signing.ScriptTypeP2WPKHP2SH, "m/49'/1'/0'"),
					newScriptTypeWithKeypath(signing.ScriptTypeP2PKH, "m/44'/1'/0'"),
				},
			)

			TLTC, _ := backend.Coin(coinpkg.CodeTLTC)
			backend.createAndAddBTCAccount(keystore, TLTC,
				"tltc",
				[]scriptTypeWithKeypath{
					newScriptTypeWithKeypath(signing.ScriptTypeP2WPKH, "m/84'/1'/0'"),
					newScriptTypeWithKeypath(signing.ScriptTypeP2WPKHP2SH, "m/49'/1'/0'"),
				},
			)

			TETH, _ := backend.Coin(coinpkg.CodeTETH)
			backend.createAndAddETHAccount(keystore, TETH, "teth", "m/44'/1'/0'/0")
			RETH, _ := backend.Coin(coinpkg.CodeRETH)
			backend.createAndAddETHAccount(keystore, RETH, "reth", "m/44'/1'/0'/0")
			erc20TEST, _ := backend.Coin(coinpkg.CodeERC20TEST)
			backend.createAndAddETHAccount(keystore, erc20TEST, "erc20Test", "m/44'/1'/0'/0")
		}
	} else {
		BTC, _ := backend.Coin(coinpkg.CodeBTC)
		backend.createAndAddBTCAccount(keystore, BTC,
			"btc",
			[]scriptTypeWithKeypath{
				newScriptTypeWithKeypath(signing.ScriptTypeP2WPKH, "m/84'/0'/0'"),
				newScriptTypeWithKeypath(signing.ScriptTypeP2WPKHP2SH, "m/49'/0'/0'"),
				newScriptTypeWithKeypath(signing.ScriptTypeP2PKH, "m/44'/0'/0'"),
			},
		)

		LTC, _ := backend.Coin(coinpkg.CodeLTC)
		backend.createAndAddBTCAccount(keystore, LTC,
			"ltc",
			[]scriptTypeWithKeypath{
				newScriptTypeWithKeypath(signing.ScriptTypeP2WPKH, "m/84'/2'/0'"),
				newScriptTypeWithKeypath(signing.ScriptTypeP2WPKHP2SH, "m/49'/2'/0'"),
			},
		)

		ETH, _ := backend.Coin(coinpkg.CodeETH)
		backend.createAndAddETHAccount(keystore, ETH, "eth", "m/44'/60'/0'/0")

		if backend.config.AppConfig().Backend.CoinActive(coinpkg.CodeETH) {
			for _, erc20Token := range erc20Tokens {
				token, _ := backend.Coin(erc20Token.code)
				backend.createAndAddETHAccount(keystore, token, string(erc20Token.code), "m/44'/60'/0'/0")
			}
		}
	}
}

// The accountsLock must be held when calling this function.
func (backend *Backend) initAccounts() {
	// Since initAccounts replaces all previous accounts, we need to properly close them first.
	backend.uninitAccounts()

	backend.initDefaultAccounts()
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
	// We support only one device at a time at the moment.
	onlyOne := !backend.arguments.Multisig()
	usb.NewManager(
		backend.arguments.MainDirectoryPath(),
		backend.arguments.BitBox02DirectoryPath(),
		backend.socksProxy,
		backend.environment.DeviceInfos,
		backend.Register,
		backend.Deregister, onlyOne).Start()

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

// RegisterKeystore registers the given keystore at this backend.
func (backend *Backend) RegisterKeystore(keystore keystore.Keystore) {
	backend.log.Info("registering keystore")
	if err := backend.keystores.Add(keystore); err != nil {
		backend.log.Panic("Failed to add a keystore.", err)
	}
	backend.Notify(observable.Event{
		Subject: "keystores",
		Action:  action.Reload,
	})
	if backend.arguments.Multisig() && backend.keystores.Count() != 2 {
		return
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
			// absoluteKeypath := signing.NewEmptyAbsoluteKeypath().Child(44, signing.Hardened)
			// extendedPublicKey, err := backend.device.ExtendedPublicKey(absoluteKeypath)
			// if err != nil {
			// 	panic(err)
			// }
			// configuration := signing.NewConfiguration(absoluteKeypath,
			// 	[]*hdkeychain.ExtendedKey{extendedPublicKey}, 1)
			if backend.arguments.Multisig() {
				backend.RegisterKeystore(
					theDevice.KeystoreForConfiguration(nil, backend.keystores.Count()))
			} else if mainKeystore {
				// HACK: for device based, only one is supported at the moment.
				backend.keystores = keystore.NewKeystores()

				backend.RegisterKeystore(
					theDevice.KeystoreForConfiguration(nil, backend.keystores.Count()))
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
	return electrum.DownloadCert(server, backend.socksProxy)
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
	softwareBasedKeystore := software.NewKeystoreFromPIN(
		backend.keystores.Count(), pin)
	backend.RegisterKeystore(softwareBasedKeystore)
}

// NotifyUser creates a desktop notification.
func (backend *Backend) NotifyUser(text string) {
	backend.environment.NotifyUser(text)
}

// SystemOpen opens a web url in the default browser, or a file url in the default application. It
// whitelists url patterns and blocks all invalid ones. Returns an error if the url was blocked or
// the url could not be opened.
func (backend *Backend) SystemOpen(url string) error {
	blocked := true

	for _, whitelistedURL := range []string{
		"https://www.cryptocompare.com",
		"https://www.coingecko.com",
		"https://bitcoincore.org/en/2016/01/26/segwit-benefits/",
		"https://en.bitcoin.it/wiki/Bech32_adoption",
		// Moonpay onramp
		"https://www.moonpay.com",
		"https://support.moonpay.com",
		"https://support.moonpay.io",
		"https://help.moonpay.io",
		"https://help.moonpay.com",
	} {
		if url == whitelistedURL {
			blocked = false
			break
		}
	}

	whitelistedPatterns := []string{
		"^https://shiftcrypto.ch/",
		"^https://ext.shiftcrypto.ch/",
		"^https://guides.shiftcrypto.ch/",
		"^https://shop.shiftcrypto.ch/",
		"^https://blockstream\\.info/(testnet/)?tx/",
		"^http://explorer\\.litecointools\\.com/tx/",
		"^https://insight\\.litecore\\.io/tx/",
		"^https://etherscan\\.io/tx/",
		"^https://rinkeby\\.etherscan\\.io/tx/",
		"^https://ropsten\\.etherscan\\.io/tx/",
	}

	if runtime.GOOS != "android" { // TODO: fix DownloadsDir() for android
		// Whitelist csv export.
		downloadDir, err := utilConfig.DownloadsDir()
		if err != nil {
			return err
		}
		whitelistedPatterns = append(whitelistedPatterns,
			fmt.Sprintf("^%s", regexp.QuoteMeta(downloadDir)),
		)
	}

	for _, pattern := range whitelistedPatterns {
		if regexp.MustCompile(pattern).MatchString(url) {
			blocked = false
			break
		}
	}
	if blocked {
		return errp.Newf("Blocked /open with url: %s", url)
	}
	return backend.environment.SystemOpen(url)

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
