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
	"path/filepath"
	"regexp"
	"runtime"
	"strings"

	"github.com/btcsuite/btcd/chaincfg"
	"github.com/cloudfoundry-attic/jibber_jabber"
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
	"github.com/digitalbitbox/bitbox-wallet-app/util/socksproxy"
	"github.com/ethereum/go-ethereum/params"
	"github.com/sirupsen/logrus"
	"golang.org/x/text/language"
)

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

	socksProxy   socksproxy.SocksProxy
	ratesUpdater *rates.RateUpdater
	banners      *banners.Banners
}

// NewBackend creates a new backend with the given arguments.
func NewBackend(arguments *arguments.Arguments, environment Environment) (*Backend, error) {
	log := logging.Get().WithGroup("backend")
	config, err := config.NewConfig(arguments.AppConfigFilename(), arguments.AccountsConfigFilename())
	if err != nil {
		return nil, errp.WithStack(err)
	}
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
	backend.baseManager = mdns.NewManager(
		backend.EmitBitBoxBaseDetected, backend.bitBoxBaseRegister,
		backend.BitBoxBaseDeregister, backend.BitBoxBaseRemove,
		backend.EmitBitBoxBaseReconnected, backend.config,
		backend.arguments.BitBoxBaseDirectoryPath(), backend.socksProxy)

	backend.ratesUpdater = rates.NewRateUpdater(backend.socksProxy)
	backend.ratesUpdater.Observe(backend.Notify)

	backend.banners = banners.NewBanners()
	backend.banners.Observe(backend.Notify)

	return backend, nil
}

// addAccount adds the given account to the backend.
func (backend *Backend) addAccount(account accounts.Interface) {
	defer backend.accountsLock.Lock()()
	backend.accounts = append(backend.accounts, account)
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
			"accountName": account.Name(),
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
	onEvent := func(event accounts.Event) {
		backend.events <- AccountEvent{Type: "account", Code: code, Data: string(event)}
		if account != nil && event == accounts.EventSyncDone {
			backend.notifyNewTxs(account)
		}
	}

	getNotifier := func(configurations signing.Configurations) accounts.Notifier {
		return backend.notifier.ForAccount(fmt.Sprintf("%s-%s", configurations.Hash(), coin.Code()))
	}

	accountAdded := false
	switch specificCoin := coin.(type) {
	case *btc.Coin:
		account = btc.NewAccount(
			specificCoin,
			backend.arguments.CacheDirectoryPath(),
			code, name,
			backend.arguments.GapLimits(),
			getSigningConfigurations,
			backend.keystores,
			getNotifier,
			onEvent,
			backend.log,
			backend.ratesUpdater,
		)
		backend.addAccount(account)
		accountAdded = true
	case *eth.Coin:
		account = eth.NewAccount(specificCoin, backend.arguments.CacheDirectoryPath(), code, name,
			func() (*signing.Configuration, error) {
				signingConfigurations, err := getSigningConfigurations()
				if err != nil {
					return nil, err
				}
				if len(signingConfigurations) != 1 {
					return nil, errp.New("Ethereum only supports one signing config")
				}
				return signingConfigurations[0], nil
			},
			backend.keystores, getNotifier, onEvent, backend.log, backend.ratesUpdater)
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

func (backend *Backend) createAndAddAccount(
	coin coin.Coin,
	code string,
	name string,
	keypath string,
	scriptType signing.ScriptType,
) {
	log := backend.log.WithField("code", code).WithField("name", name)
	prefix := "eth-erc20-"
	if strings.HasPrefix(code, prefix) {
		if !backend.config.AppConfig().Backend.ETH.ERC20TokenActive(code[len(prefix):]) {
			log.WithField("name", name).Info("skipping inactive erc20 token")
			return
		}
	} else if !backend.arguments.Multisig() && !backend.config.AppConfig().Backend.CoinActive(coin.Code()) {
		log.WithField("name", name).Info("skipping inactive account")
		return
	}

	var meta interface{}
	switch coin.(type) {
	case *btc.Coin:
		meta = scriptType
	default:
	}
	for _, keystore := range backend.keystores.Keystores() {
		if !keystore.SupportsAccount(coin, backend.arguments.Multisig(), meta) {
			log.Info("skipping unsupported account")
			return
		}
	}

	log.Info("init account")
	absoluteKeypath, err := signing.NewAbsoluteKeypath(keypath)
	if err != nil {
		panic(err)
	}
	getSigningConfigurations := func() (signing.Configurations, error) {
		// TODO: unified-accounts, allow multiple
		signingConfiguration, err := backend.keystores.Configuration(
			coin, scriptType, absoluteKeypath, backend.keystores.Count())
		if err != nil {
			return nil, err
		}
		return signing.Configurations{signingConfiguration}, nil
	}
	if backend.arguments.Multisig() {
		name += " Multisig"
	}
	err = backend.CreateAndAddAccount(coin, code, name, getSigningConfigurations, false, false)
	if err != nil {
		panic(err)
	}
}

// Config returns the app config.
func (backend *Backend) Config() *config.Config {
	return backend.config
}

// DefaultAppConfig returns the default app config.y
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
	const devShiftCA = `-----BEGIN CERTIFICATE-----
MIIGGjCCBAKgAwIBAgIJAO1AEqR+xvjRMA0GCSqGSIb3DQEBDQUAMIGZMQswCQYD
VQQGEwJDSDEPMA0GA1UECAwGWnVyaWNoMR0wGwYDVQQKDBRTaGlmdCBDcnlwdG9z
ZWN1cml0eTEzMDEGA1UECwwqU2hpZnQgQ3J5cHRvc2VjdXJpdHkgQ2VydGlmaWNh
dGUgQXV0aG9yaXR5MSUwIwYDVQQDDBxTaGlmdCBDcnlwdG9zZWN1cml0eSBSb290
IENBMB4XDTE4MDMwNzE3MzUxMloXDTM4MDMwMjE3MzUxMlowgZkxCzAJBgNVBAYT
AkNIMQ8wDQYDVQQIDAZadXJpY2gxHTAbBgNVBAoMFFNoaWZ0IENyeXB0b3NlY3Vy
aXR5MTMwMQYDVQQLDCpTaGlmdCBDcnlwdG9zZWN1cml0eSBDZXJ0aWZpY2F0ZSBB
dXRob3JpdHkxJTAjBgNVBAMMHFNoaWZ0IENyeXB0b3NlY3VyaXR5IFJvb3QgQ0Ew
ggIiMA0GCSqGSIb3DQEBAQUAA4ICDwAwggIKAoICAQDlz32VZk/D3rfm7Qwx6WkE
Fp9cdQV2FNYTeTjWVErVeTev02ctHHXV1fR3Svk8iIJWaALSJy7phdEDwC/3gDIQ
Ylm15kpntCibOWiQPZZxGq7Udts20fooccdZqtG/PKFRCPWZ2MOgHAOWDKGk6Kb+
siqkr55hkxwtiHuwkCcTh/Q2orEIuteSRbbYwgURZwd6dDIQq4ty7reC3j32xphh
edbnVBoDE6DSdebSS5SJL/gb6LxUdio98XdJPwkaD8292uEODxx0DKw/Ou2e1f5Q
Iv1WBl+LBaSrZ3sJSFUqoSvCQwBQmMAPoPJ1O13jCnFz1xoNygxUfz2eiKRL5E2l
VTmTh7zIez4oniOh5MOmDnKMVgTUGP1II2UU5r6PAq2tDpw4lVwyezhyLaBegwMc
pg/LinbABxUJrP8c8G2tve0yuTAhsir7r+Koo+nAE7FwcuIkD0UTyQcoag2IMS8O
dKZdYMGXjfUPJRBWg60LfXJeqMyU1oHpDrsRoa5iaYPt7ZApxc41kyynqfuuuIRD
du8327gd1nJ6ExMxGHY7dYelE4GNkOg3R0+5czykm/RxnGyDuDcO/RcYBJTChN1L
HYq+dTt0dYPAzBtiXnfuvjDyOsDK5f65pbrDgoOr6AQ4lvDJabcXFsWPrulM9Dyu
p0Y4+fuwXOCd8cr1Zm34MQIDAQABo2MwYTAdBgNVHQ4EFgQU486X86LMbNNSDw7J
NcT2U30NrikwHwYDVR0jBBgwFoAU486X86LMbNNSDw7JNcT2U30NrikwDwYDVR0T
AQH/BAUwAwEB/zAOBgNVHQ8BAf8EBAMCAYYwDQYJKoZIhvcNAQENBQADggIBAN0N
IPVBv8aaKDHDK9Nsu5fwiGp8GgkAN0B1+D34CbxTuzCDurToVMHCPEdo9tk/AzE4
Aa1p/kMW9X3XP8IyCFFj+BpEVkBRr9fXTVuh3XRHbyN6tXFbkKWQ/6QeUcnefq2k
DCpqEGjJQWsujZ4tJKkJl2HLIBZL6FAa/kaDLFHd3LeV1immC66CiN3ieHejCJL1
zZXiWi8pNxvEanTLPBaBjCw/AAl/owg/ySu2hGZzL0wsFboPrUbo4J+KvL1pvwql
PCT8AylJKCu+cn/N9zZDtUsgZJQBIq7btoakC3mCSnfVTlcbxfHVef0DbfohFqoV
ZpdmIuy0/njw7o+2uL/ArPJscPOhNl60ocDbdFIyYvc85oxyts8yMvKDdWV9Bm//
kl7lv4QUAvjqjb7ZgUhYibVk3Eu6n1MGZOP40l1/mm922/Wcd2n/HZVk/LsJs4tt
B6DLMDpf5nzeI1Yz/QtDGvNyb4aiJoRV5tQb9KkFfIeSzBS/ORZto4tVHKS37lxV
d1r8kFyCgpL9KASdahfyLBWCC7awlcOQP1QJA5QoO9u5Feq3lU0VnJF0YCZh8GOy
py3n1TR6S59eT495BiKDjWnhdVchEa8zMGIW/wFW7EX/LyW2zX3hQsdfnmMWUPVr
O3nOxjgSfRAfKWQ2Ny1APKcn6I83P5PFLhtO5I12
-----END CERTIFICATE-----`

	switch code {
	case coinpkg.CodeBTC:
		return []*config.ServerInfo{{Server: "dev.shiftcrypto.ch:50002", TLS: true, PEMCert: devShiftCA}}
	case coinpkg.CodeTBTC:
		return []*config.ServerInfo{
			{Server: "s1.dev.shiftcrypto.ch:51003", TLS: true, PEMCert: devShiftCA},
			{Server: "s2.dev.shiftcrypto.ch:51003", TLS: true, PEMCert: devShiftCA},
		}
	case coinpkg.CodeRBTC:
		return []*config.ServerInfo{{Server: "127.0.0.1:52001", TLS: false, PEMCert: ""}}
	case coinpkg.CodeLTC:
		return []*config.ServerInfo{{Server: "dev.shiftcrypto.ch:50004", TLS: true, PEMCert: devShiftCA}}
	case coinpkg.CodeTLTC:
		return []*config.ServerInfo{{Server: "dev.shiftcrypto.ch:51004", TLS: true, PEMCert: devShiftCA}}
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

	// ethMakeTransactionsSource selects between the provided transactions sources based on the coin
	// config. Currently we can only switch between None and EtherScan.
	ethMakeTransactionsSource := func(
		source config.ETHTransactionsSource,
		etherScan eth.TransactionsSourceMaker) eth.TransactionsSourceMaker {
		switch source {
		case config.ETHTransactionsSourceNone:
			return eth.TransactionsSourceNone
		case config.ETHTransactionsSourceEtherScan:
			return etherScan
		default:
			panic(fmt.Sprintf("unknown eth transactions source: %s", source))
		}
	}
	erc20Token := erc20TokenByCode(code)
	switch {
	case code == coinpkg.CodeRBTC:
		servers := backend.defaultElectrumXServers(code)
		coin = btc.NewCoin(coinpkg.CodeRBTC, "RBTC", &chaincfg.RegressionNetParams, dbFolder, servers, "", backend.socksProxy)
	case code == coinpkg.CodeTBTC:
		servers := backend.defaultElectrumXServers(code)
		coin = btc.NewCoin(coinpkg.CodeTBTC, "TBTC", &chaincfg.TestNet3Params, dbFolder, servers,
			"https://blockstream.info/testnet/tx/", backend.socksProxy)
	case code == coinpkg.CodeBTC:
		servers := backend.defaultElectrumXServers(code)
		coin = btc.NewCoin(coinpkg.CodeBTC, "BTC", &chaincfg.MainNetParams, dbFolder, servers,
			"https://blockstream.info/tx/", backend.socksProxy)
	case code == coinpkg.CodeTLTC:
		servers := backend.defaultElectrumXServers(code)
		coin = btc.NewCoin(coinpkg.CodeTLTC, "TLTC", &ltc.TestNet4Params, dbFolder, servers,
			"http://explorer.litecointools.com/tx/", backend.socksProxy)
	case code == coinpkg.CodeLTC:
		servers := backend.defaultElectrumXServers(code)
		coin = btc.NewCoin(coinpkg.CodeLTC, "LTC", &ltc.MainNetParams, dbFolder, servers,
			"https://insight.litecore.io/tx/", backend.socksProxy)
	case code == coinpkg.CodeETH:
		coinConfig := backend.config.AppConfig().Backend.ETH
		transactionsSource := ethMakeTransactionsSource(
			coinConfig.TransactionsSource,
			eth.TransactionsSourceEtherScan("https://api.etherscan.io/api", backend.socksProxy),
		)
		coin = eth.NewCoin(code, "ETH", "ETH", params.MainnetChainConfig,
			"https://etherscan.io/tx/",
			transactionsSource,
			coinConfig.NodeURL,
			nil, backend.socksProxy)
	case code == coinpkg.CodeRETH:
		coinConfig := backend.config.AppConfig().Backend.RETH
		transactionsSource := ethMakeTransactionsSource(
			coinConfig.TransactionsSource,
			eth.TransactionsSourceEtherScan("https://api-rinkeby.etherscan.io/api", backend.socksProxy),
		)
		coin = eth.NewCoin(code, "RETH", "RETH", params.RinkebyChainConfig,
			"https://rinkeby.etherscan.io/tx/",
			transactionsSource,
			coinConfig.NodeURL,
			nil, backend.socksProxy)
	case code == coinpkg.CodeTETH:
		coinConfig := backend.config.AppConfig().Backend.TETH
		transactionsSource := ethMakeTransactionsSource(
			coinConfig.TransactionsSource,
			eth.TransactionsSourceEtherScan("https://api-ropsten.etherscan.io/api", backend.socksProxy),
		)
		coin = eth.NewCoin(code, "TETH", "TETH", params.TestnetChainConfig,
			"https://ropsten.etherscan.io/tx/",
			transactionsSource,
			coinConfig.NodeURL,
			nil, backend.socksProxy)
	case code == coinpkg.CodeERC20TEST:
		coinConfig := backend.config.AppConfig().Backend.TETH
		transactionsSource := ethMakeTransactionsSource(
			coinConfig.TransactionsSource,
			eth.TransactionsSourceEtherScan("https://api-ropsten.etherscan.io/api", backend.socksProxy),
		)
		coin = eth.NewCoin(code, "TEST", "TETH", params.TestnetChainConfig,
			"https://ropsten.etherscan.io/tx/",
			transactionsSource,
			coinConfig.NodeURL,
			erc20.NewToken("0x2f45b6fb2f28a73f110400386da31044b2e953d4", 18),
			backend.socksProxy,
		)
	case erc20Token != nil:
		coinConfig := backend.config.AppConfig().Backend.ETH
		transactionsSource := ethMakeTransactionsSource(
			coinConfig.TransactionsSource,
			eth.TransactionsSourceEtherScan("https://api.etherscan.io/api", backend.socksProxy),
		)
		coin = eth.NewCoin(erc20Token.code, erc20Token.unit, "ETH", params.MainnetChainConfig,
			"https://etherscan.io/tx/",
			transactionsSource,
			coinConfig.NodeURL,
			erc20Token.token,
			backend.socksProxy,
		)
	default:
		return nil, errp.Newf("unknown coin code %s", code)
	}
	backend.coins[code] = coin
	coin.Observe(backend.Notify)
	return coin, nil
}

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
		err = backend.CreateAndAddAccount(coin, account.Code, account.Name, getSigningConfigurations, false, false)
		if err != nil {
			panic(err)
		}
	}
}

// initDefaultAccounts creates a bunch of default accounts for a set of keystores (not manually
// user-added). Currently the first bip44 account for all supported and active account types.
func (backend *Backend) initDefaultAccounts() {
	if backend.keystores.Count() == 0 {
		return
	}
	if backend.keystores.Count() > 1 {
		// If needed, insert multisig account initialization here based on multiple connected
		// keystores.
		return
	}
	if backend.arguments.Testing() {
		if backend.arguments.Regtest() {
			RBTC, _ := backend.Coin(coinpkg.CodeRBTC)
			backend.createAndAddAccount(RBTC, "rbtc-p2pkh", "Bitcoin Regtest Legacy", "m/44'/1'/0'",
				signing.ScriptTypeP2PKH)
			backend.createAndAddAccount(RBTC, "rbtc-p2wpkh-p2sh", "Bitcoin Regtest Segwit", "m/49'/1'/0'",
				signing.ScriptTypeP2WPKHP2SH)
		} else {
			TBTC, _ := backend.Coin(coinpkg.CodeTBTC)
			backend.createAndAddAccount(TBTC, "tbtc-p2wpkh-p2sh", "Bitcoin Testnet", "m/49'/1'/0'",
				signing.ScriptTypeP2WPKHP2SH)
			backend.createAndAddAccount(TBTC, "tbtc-p2wpkh", "Bitcoin Testnet: bech32", "m/84'/1'/0'",
				signing.ScriptTypeP2WPKH)
			backend.createAndAddAccount(TBTC, "tbtc-p2pkh", "Bitcoin Testnet Legacy", "m/44'/1'/0'",
				signing.ScriptTypeP2PKH)

			TLTC, _ := backend.Coin(coinpkg.CodeTLTC)
			backend.createAndAddAccount(TLTC, "tltc-p2wpkh-p2sh", "Litecoin Testnet", "m/49'/1'/0'",
				signing.ScriptTypeP2WPKHP2SH)
			backend.createAndAddAccount(TLTC, "tltc-p2wpkh", "Litecoin Testnet: bech32", "m/84'/1'/0'",
				signing.ScriptTypeP2WPKH)

			TETH, _ := backend.Coin(coinpkg.CodeTETH)
			backend.createAndAddAccount(TETH, "teth", "Ethereum Ropsten", "m/44'/1'/0'/0", signing.ScriptTypeP2WPKH)
			RETH, _ := backend.Coin(coinpkg.CodeRETH)
			backend.createAndAddAccount(RETH, "reth", "Ethereum Rinkeby", "m/44'/1'/0'/0", signing.ScriptTypeP2WPKH)
			erc20TEST, _ := backend.Coin(coinpkg.CodeERC20TEST)
			backend.createAndAddAccount(erc20TEST, "erc20Test", "ERC20 TEST", "m/44'/1'/0'/0",
				signing.ScriptTypeP2WPKH)
		}
	} else {
		BTC, _ := backend.Coin(coinpkg.CodeBTC)
		backend.createAndAddAccount(BTC, "btc-p2wpkh-p2sh", "Bitcoin", "m/49'/0'/0'",
			signing.ScriptTypeP2WPKHP2SH)
		backend.createAndAddAccount(BTC, "btc-p2wpkh", "Bitcoin: bech32", "m/84'/0'/0'",
			signing.ScriptTypeP2WPKH)
		backend.createAndAddAccount(BTC, "btc-p2pkh", "Bitcoin Legacy", "m/44'/0'/0'",
			signing.ScriptTypeP2PKH)

		LTC, _ := backend.Coin(coinpkg.CodeLTC)
		backend.createAndAddAccount(LTC, "ltc-p2wpkh-p2sh", "Litecoin", "m/49'/2'/0'",
			signing.ScriptTypeP2WPKHP2SH)
		backend.createAndAddAccount(LTC, "ltc-p2wpkh", "Litecoin: bech32", "m/84'/2'/0'",
			signing.ScriptTypeP2WPKH)

		ETH, _ := backend.Coin(coinpkg.CodeETH)
		backend.createAndAddAccount(ETH, "eth", "Ethereum", "m/44'/60'/0'/0", signing.ScriptTypeP2WPKH)

		if backend.config.AppConfig().Backend.CoinActive(coinpkg.CodeETH) {
			for _, erc20Token := range erc20Tokens {
				token, _ := backend.Coin(erc20Token.code)
				backend.createAndAddAccount(token, string(erc20Token.code), erc20Token.name, "m/44'/60'/0'/0", signing.ScriptTypeP2WPKH)
			}
		}
	}
}

func (backend *Backend) initAccounts() {
	// Since initAccounts replaces all previous accounts, we need to properly close them first.
	backend.uninitAccounts()

	backend.initDefaultAccounts()
	backend.initPersistedAccounts()

	backend.emitAccountsStatusChanged()
}

// ReinitializeAccounts uninits and then reinits all accounts. This is useful to reload the accounts
// if the configuration changed (e.g. which accounts are active). This is a stopgap measure until
// accounts can be added and removed individually.
func (backend *Backend) ReinitializeAccounts() {
	backend.log.Info("Reinitializing accounts")
	backend.initAccounts()
}

// Testing returns whether this backend is for testing only.
func (backend *Backend) Testing() bool {
	return backend.arguments.Testing()
}

// Accounts returns the current accounts of the backend.
func (backend *Backend) Accounts() []accounts.Interface {
	return backend.accounts
}

// UserLanguage returns the language the UI should be presented in to the user.
func (backend *Backend) UserLanguage() language.Tag {
	userLocale, err := jibber_jabber.DetectIETF()
	if err != nil {
		return language.English
	}
	languages := []language.Tag{
		language.English,
		language.German,
	}
	tag, _, _ := language.NewMatcher(languages).Match(language.Make(userLocale))
	backend.log.WithField("user-language", tag).Debug("Detected user language")
	return tag
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
	backend.initPersistedAccounts()
	backend.emitAccountsStatusChanged()
	return backend.events
}

// TryMakeNewBase calls TryMakeNewBase() in the manager with the given ip
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

// EmitBitBoxBaseDetected notifies the frontend that the manager.detectedBases has changed
func (backend *Backend) EmitBitBoxBaseDetected() {
	backend.events <- backendEvent{Type: "bitboxbases", Data: "detectedChanged"}
}

// EmitBitBoxBaseReconnected notifies the frontend that a previously registered Base has successfully reconnected
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
// i.e., if the noise pairing wasn't completed and so the RPC connection not established
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

func (backend *Backend) uninitAccounts() {
	defer backend.accountsLock.Lock()()
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

// RatesUpdater returns the backend's ratesUpdater instance
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
		"https://bitcoincore.org/en/2016/01/26/segwit-benefits/",
		"https://en.bitcoin.it/wiki/Bech32_adoption",
		"https://help.safello.com",
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
	errors := []string{}

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
