// Copyright 2018 Shift Devices AG
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

package config

import (
	"encoding/json"
	"fmt"
	"io/ioutil"

	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/coin"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
	"github.com/digitalbitbox/bitbox-wallet-app/util/locker"
)

const defaultProxyAddress = "127.0.0.1:9050"

// ServerInfo holds information about the backend server(s).
type ServerInfo struct {
	Server  string `json:"server"`
	TLS     bool   `json:"tls"`
	PEMCert string `json:"pemCert"`
}

// btcCoinConfig holds configurations specific to a btc-based coin.
type btcCoinConfig struct {
	ElectrumServers []*ServerInfo `json:"electrumServers"`
}

// ETHTransactionsSource  where to get Ethereum transactions from. See the list of consts
// below.
type ETHTransactionsSource string

const (
	// ETHTransactionsSourceNone means no source of tranasctions. Only the locally cached
	// transactions will be shown.
	ETHTransactionsSourceNone ETHTransactionsSource = "none"
	// ETHTransactionsSourceEtherScan configures to get transactions from EtherScan.
	ETHTransactionsSourceEtherScan ETHTransactionsSource = "etherScan"
)

// ethCoinConfig holds configurations for ethereum coins.
type ethCoinConfig struct {
	ActiveERC20Tokens []string `json:"activeERC20Tokens"`
}

// ERC20TokenActive returns true if this token is configured to be active.
// code is the token id, e.g. "usdt".
func (eth ethCoinConfig) ERC20TokenActive(code string) bool {
	for _, tokenCode := range eth.ActiveERC20Tokens {
		if tokenCode == code {
			return true
		}
	}
	return false
}

type proxyConfig struct {
	UseProxy     bool   `json:"useProxy"`
	ProxyAddress string `json:"proxyAddress"`
}

// ProxyAddressOrDefault returns the configured proxy address. If not set, it returns the default
// one.
func (proxy proxyConfig) ProxyAddressOrDefault() string {
	if proxy.ProxyAddress != "" {
		return proxy.ProxyAddress
	}
	return defaultProxyAddress
}

// Backend holds the backend specific configuration.
type Backend struct {
	Proxy proxyConfig `json:"proxy"`

	BitcoinActive  bool `json:"bitcoinActive"`
	LitecoinActive bool `json:"litecoinActive"`
	EthereumActive bool `json:"ethereumActive"`

	// Whether Bitcoin, Litecoin should be shown in multiple accounts - one per script type -
	// instead of a combined account.
	SplitAccounts bool `json:"splitAccounts"`

	BTC  btcCoinConfig `json:"btc"`
	TBTC btcCoinConfig `json:"tbtc"`
	RBTC btcCoinConfig `json:"rbtc"`
	LTC  btcCoinConfig `json:"ltc"`
	TLTC btcCoinConfig `json:"tltc"`
	ETH  ethCoinConfig `json:"eth"`
	TETH ethCoinConfig `json:"teth"`
	RETH ethCoinConfig `json:"reth"`

	// FiatList contains all enabled fiat currencies.
	// These are used in the UI as well as by RateUpdater to fetch historical exchange rates.
	FiatList []string `json:"fiatList"`
	// MainFiat is the fiat currency used as a default for computing account portfolio data
	// and transaction amounts.
	MainFiat string `json:"mainFiat"`

	// UserLanguage is the UI language preferred by the user.
	// It may be missing from an app config.json if the user never selected one
	// or set to empty by the frontend if its value matches native locale
	// as reported by the OS.
	UserLanguage string `json:"userLanguage"`
}

// CoinActive returns the Active setting for a coin by code.
func (backend Backend) CoinActive(code coin.Code) bool {
	switch code {
	case coin.CodeBTC, coin.CodeTBTC, coin.CodeRBTC:
		return backend.BitcoinActive
	case coin.CodeLTC, coin.CodeTLTC:
		return backend.LitecoinActive
	case coin.CodeETH, coin.CodeTETH, coin.CodeRETH, coin.CodeERC20TEST:
		return backend.EthereumActive
	default:
		panic(fmt.Sprintf("unknown code %s", code))
	}
}

// AppConfig holds the whole app configuration.
type AppConfig struct {
	Backend  Backend     `json:"backend"`
	Frontend interface{} `json:"frontend"`
}

// O=Shift Crypto, CN=ShiftCrypto R1
// Serial: d35011c382968211cd4e29fefc144891.
const shiftRootCA = `
-----BEGIN CERTIFICATE-----
MIIBgjCCASigAwIBAgIRANNQEcOCloIRzU4p/vwUSJEwCgYIKoZIzj0EAwIwMDEV
MBMGA1UEChMMU2hpZnQgQ3J5cHRvMRcwFQYDVQQDEw5TaGlmdENyeXB0byBSMTAe
Fw0yMDEyMDgyMzU5MzZaFw0zMDEyMDYyMzU5MzZaMDAxFTATBgNVBAoTDFNoaWZ0
IENyeXB0bzEXMBUGA1UEAxMOU2hpZnRDcnlwdG8gUjEwWTATBgcqhkjOPQIBBggq
hkjOPQMBBwNCAARr5MqlIwZF1Vm4Ng5Smlb4ZuQ1wIwCVxl9zcX5kgMmaJFlTPpk
8jj3KE4+DXkxixuHarJgdamGP/SYawG69HyMoyMwITAOBgNVHQ8BAf8EBAMCAoQw
DwYDVR0TAQH/BAUwAwEB/zAKBggqhkjOPQQDAgNIADBFAiEApDfR07EgYNtXuXM1
YFnRE7QtJtiu97fYZk3Qu8W3/TECIAtCHAzvA2AX/eX4fNTjUho/9y1qF9GAsnNN
hbWFoWMI
-----END CERTIFICATE-----
`

// NewDefaultAppConfig returns the default app config.
func NewDefaultAppConfig() AppConfig {
	return AppConfig{
		Backend: Backend{
			Proxy: proxyConfig{
				UseProxy:     false,
				ProxyAddress: defaultProxyAddress,
			},
			BitcoinActive:  true,
			LitecoinActive: true,
			EthereumActive: true,

			SplitAccounts: false,

			BTC: btcCoinConfig{
				ElectrumServers: []*ServerInfo{
					{
						Server:  "btc1.shiftcrypto.io:50001",
						TLS:     true,
						PEMCert: shiftRootCA,
					},
					{
						Server:  "btc2.shiftcrypto.io:50002",
						TLS:     true,
						PEMCert: shiftRootCA,
					},
				},
			},
			TBTC: btcCoinConfig{
				ElectrumServers: []*ServerInfo{
					{
						Server:  "tbtc1.shiftcrypto.io:51001",
						TLS:     true,
						PEMCert: shiftRootCA,
					},
					{
						Server:  "tbtc2.shiftcrypto.io:51002",
						TLS:     true,
						PEMCert: shiftRootCA,
					},
				},
			},
			RBTC: btcCoinConfig{
				ElectrumServers: []*ServerInfo{
					{
						Server:  "127.0.0.1:52001",
						TLS:     false,
						PEMCert: "",
					},
				},
			},
			LTC: btcCoinConfig{
				ElectrumServers: []*ServerInfo{
					{
						Server:  "ltc1.shiftcrypto.io:50011",
						TLS:     true,
						PEMCert: shiftRootCA,
					},
					{
						Server:  "ltc2.shiftcrypto.io:50012",
						TLS:     true,
						PEMCert: shiftRootCA,
					},
				},
			},
			TLTC: btcCoinConfig{
				ElectrumServers: []*ServerInfo{
					{
						Server:  "tltc1.shiftcrypto.io:51011",
						TLS:     true,
						PEMCert: shiftRootCA,
					},
					{
						Server:  "tltc2.shiftcrypto.io:51012",
						TLS:     true,
						PEMCert: shiftRootCA,
					},
				},
			},
			ETH: ethCoinConfig{
				ActiveERC20Tokens: []string{},
			},
			TETH: ethCoinConfig{
				ActiveERC20Tokens: []string{},
			},
			RETH: ethCoinConfig{
				ActiveERC20Tokens: []string{},
			},
			// Copied from frontend/web/src/components/rates/rates.tsx.
			FiatList: []string{"USD", "EUR", "CHF"},
			MainFiat: "CHF",
		},
	}
}

// Config manages the app configuration.
type Config struct {
	lock locker.Locker

	appConfigFilename string
	appConfig         AppConfig

	accountsConfigFilename string
	accountsConfig         AccountsConfig
}

// NewConfig creates a new Config, stored in the given location. The filename must be writable, but
// does not have to exist.
func NewConfig(appConfigFilename string, accountsConfigFilename string) (*Config, error) {
	config := &Config{
		appConfigFilename: appConfigFilename,
		appConfig:         NewDefaultAppConfig(),

		accountsConfigFilename: accountsConfigFilename,
		accountsConfig:         newDefaultAccountsonfig(),
	}
	config.load()
	appconf := config.appConfig
	migrateFiatList(&appconf)
	migrateFiatCode(&appconf)
	migrateElectrumX(&appconf)
	migrateUserLanguage(&appconf)
	if err := config.SetAppConfig(appconf); err != nil {
		return nil, errp.WithStack(err)
	}
	return config, nil
}

// SetBtcOnly sets non-bitcoin accounts in the config to false.
func (config *Config) SetBtcOnly() {
	config.appConfig.Backend.LitecoinActive = false
	config.appConfig.Backend.EthereumActive = false
}

// SetBTCElectrumServers sets the BTC configuration to the provided electrumIP and electrumCert.
func (config *Config) SetBTCElectrumServers(electrumAddress, electrumCert string) {
	config.appConfig.Backend.BTC = btcCoinConfig{
		ElectrumServers: []*ServerInfo{
			{
				Server:  electrumAddress,
				TLS:     true,
				PEMCert: electrumCert,
			},
		},
	}
}

// SetTBTCElectrumServers sets the TBTC configuration to the provided electrumIP and electrumCert.
func (config *Config) SetTBTCElectrumServers(electrumAddress, electrumCert string) {
	config.appConfig.Backend.TBTC = btcCoinConfig{
		ElectrumServers: []*ServerInfo{
			{
				Server:  electrumAddress,
				TLS:     true,
				PEMCert: electrumCert,
			},
		},
	}
}

func (config *Config) load() {
	jsonBytes, err := ioutil.ReadFile(config.appConfigFilename)
	if err != nil {
		return
	}
	if err := json.Unmarshal(jsonBytes, &config.appConfig); err != nil {
		return
	}
	jsonBytes, err = ioutil.ReadFile(config.accountsConfigFilename)
	if err != nil {
		return
	}
	if err := json.Unmarshal(jsonBytes, &config.accountsConfig); err != nil {
		return
	}
}

// AppConfig returns the app config.
func (config *Config) AppConfig() AppConfig {
	defer config.lock.RLock()()
	return config.appConfig
}

// SetAppConfig sets and persists the app config.
func (config *Config) SetAppConfig(appConfig AppConfig) error {
	defer config.lock.Lock()()
	config.appConfig = appConfig
	return config.save(config.appConfigFilename, config.appConfig)
}

// AccountsConfig returns the accounts config.
func (config *Config) AccountsConfig() AccountsConfig {
	defer config.lock.RLock()()
	return config.accountsConfig
}

// SetAccountsConfig sets and persists the accounts config.
func (config *Config) SetAccountsConfig(accountsConfig AccountsConfig) error {
	defer config.lock.Lock()()
	config.accountsConfig = accountsConfig
	return config.save(config.accountsConfigFilename, config.accountsConfig)
}

func (config *Config) save(filename string, conf interface{}) error {
	jsonBytes, err := json.MarshalIndent(conf, "", "    ")
	if err != nil {
		return errp.WithStack(err)
	}
	return errp.WithStack(ioutil.WriteFile(filename, jsonBytes, 0644)) // #nosec G306
}

// migrateFiatList moves fiatList from appconf.Frontend to appconf.Backend.
// This is because with the account portfolio feature, backend needs to know
// which fiat currencies are enabled to fetch historical exchange rates.
func migrateFiatList(appconf *AppConfig) {
	frontconf, ok := appconf.Frontend.(map[string]interface{})
	if !ok {
		return // nothing to migrate
	}
	fiats, ok := frontconf["fiatList"].([]interface{})
	if !ok {
		return // nothing to migrate
	}
	appconf.Backend.FiatList = make([]string, len(fiats))
	for i, f := range fiats {
		if v, ok := f.(string); ok {
			appconf.Backend.FiatList[i] = v
		}
	}
	delete(frontconf, "fiatList")
}

// migrateFiatCode moves fiatCode from appconf.Frontend to appconf.Backend
// to aid the backend in constructing data series with correct main fiat code
// for portfolio feature.
func migrateFiatCode(appconf *AppConfig) {
	frontconf, ok := appconf.Frontend.(map[string]interface{})
	if !ok {
		return // nothing to migrate
	}
	if code, ok := frontconf["fiatCode"].(string); ok {
		appconf.Backend.MainFiat = code
		delete(frontconf, "fiatCode")
	}
}

// migrateElectrumX replaces all instances of old ElectrumX servers to the new
// ones which run protocol version of at least 1.4.
func migrateElectrumX(appconf *AppConfig) {
	migrateBTCCoinConfig(&appconf.Backend.BTC)
	migrateBTCCoinConfig(&appconf.Backend.TBTC)
	migrateBTCCoinConfig(&appconf.Backend.LTC)
	migrateBTCCoinConfig(&appconf.Backend.TLTC)
}

func migrateBTCCoinConfig(conf *btcCoinConfig) {
	newServers := map[string]string{ // old -> new
		"btc.shiftcrypto.ch:443":          "btc1.shiftcrypto.io:50001",
		"merkle.shiftcrypto.ch:443":       "btc2.shiftcrypto.io:50002",
		"btc.shiftcrypto.ch:51002":        "tbtc1.shiftcrypto.io:51001",
		"merkle.shiftcrypto.ch:51002":     "tbtc2.shiftcrypto.io:51002",
		"ltc.shiftcrypto.ch:443":          "ltc1.shiftcrypto.io:50011",
		"ltc.shamir.shiftcrypto.ch:443":   "ltc2.shiftcrypto.io:50012",
		"ltc.shiftcrypto.ch:51004":        "tltc1.shiftcrypto.io:51011",
		"ltc.shamir.shiftcrypto.ch:51004": "tltc2.shiftcrypto.io:51012",
	}
	for _, item := range conf.ElectrumServers {
		if host, ok := newServers[item.Server]; ok {
			item.Server = host
			item.PEMCert = shiftRootCA
		}
	}
}

// migrateUserLanguage moves userLanguage field from frontend to backend.
func migrateUserLanguage(appconf *AppConfig) {
	frontconf, ok := appconf.Frontend.(map[string]interface{})
	if !ok {
		return // nothing to migrate
	}
	if lang, ok := frontconf["userLanguage"].(string); ok {
		appconf.Backend.UserLanguage = lang
		delete(frontconf, "userLanguage")
	}
}
