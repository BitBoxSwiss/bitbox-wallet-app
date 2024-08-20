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
	"os"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/rates"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/locker"
)

type blockExplorers struct {
	BTC    string `json:"btc"`
	TBTC   string `json:"tbtc"`
	LTC    string `json:"ltc"`
	TLTC   string `json:"tltc"`
	ETH    string `json:"eth"`
	GOETH  string `json:"goeth"`
	SEPETH string `json:"sepeth"`
}

// ServerInfo holds information about the backend server(s).
type ServerInfo struct {
	Server  string `json:"server"`
	TLS     bool   `json:"tls"`
	PEMCert string `json:"pemCert"`
}

func (s *ServerInfo) String() string {
	if s.TLS {
		return s.Server + ":s"
	}
	return s.Server + ":p"
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
	DeprecatedActiveERC20Tokens []string `json:"activeERC20Tokens"`
}

type proxyConfig struct {
	UseProxy     bool   `json:"useProxy"`
	ProxyAddress string `json:"proxyAddress"`
}

// Backend holds the backend specific configuration.
type Backend struct {
	Proxy proxyConfig `json:"proxy"`

	DeprecatedBitcoinActive  bool `json:"bitcoinActive"`
	DeprecatedLitecoinActive bool `json:"litecoinActive"`
	DeprecatedEthereumActive bool `json:"ethereumActive"`

	Authentication bool `json:"authentication"`

	BTC  btcCoinConfig `json:"btc"`
	TBTC btcCoinConfig `json:"tbtc"`
	RBTC btcCoinConfig `json:"rbtc"`
	LTC  btcCoinConfig `json:"ltc"`
	TLTC btcCoinConfig `json:"tltc"`
	ETH  ethCoinConfig `json:"eth"`

	BlockExplorers blockExplorers `json:"blockExplorers"`

	// Removed in v4.35 - don't reuse these two keys.
	TETH struct{} `json:"teth"`
	RETH struct{} `json:"reth"`

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

	// BtcUnit is the unit used to represent Bitcoin amounts. See `coin.BtcUnit` for details.
	BtcUnit coin.BtcUnit `json:"btcUnit"`
}

// DeprecatedCoinActive returns the Active setting for a coin by code.  This call is should not be
// used anymore except for migration purposes. Coins are not activated globally anymore, but are
// kept in the accounts config.
func (backend Backend) DeprecatedCoinActive(code coin.Code) bool {
	switch code {
	case coin.CodeBTC, coin.CodeTBTC, coin.CodeRBTC:
		return backend.DeprecatedBitcoinActive
	case coin.CodeLTC, coin.CodeTLTC:
		return backend.DeprecatedLitecoinActive
	case coin.CodeETH, coin.CodeGOETH, coin.CodeSEPETH:
		return backend.DeprecatedEthereumActive
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
				ProxyAddress: "",
			},
			Authentication:           false,
			DeprecatedBitcoinActive:  true,
			DeprecatedLitecoinActive: true,
			DeprecatedEthereumActive: true,

			BTC: btcCoinConfig{
				ElectrumServers: []*ServerInfo{
					{
						Server:  "btc1.shiftcrypto.io:443",
						TLS:     true,
						PEMCert: shiftRootCA,
					},
					{
						Server:  "btc2.shiftcrypto.io:443",
						TLS:     true,
						PEMCert: shiftRootCA,
					},
				},
			},
			TBTC: btcCoinConfig{
				ElectrumServers: []*ServerInfo{
					{
						Server:  "tbtc1.shiftcrypto.io:443",
						TLS:     true,
						PEMCert: shiftRootCA,
					},
					{
						Server:  "tbtc2.shiftcrypto.io:443",
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
					{
						Server:  "127.0.0.1:52002",
						TLS:     false,
						PEMCert: "",
					},
				},
			},
			LTC: btcCoinConfig{
				ElectrumServers: []*ServerInfo{
					{
						Server:  "ltc1.shiftcrypto.io:443",
						TLS:     true,
						PEMCert: shiftRootCA,
					},
					{
						Server:  "ltc2.shiftcrypto.io:443",
						TLS:     true,
						PEMCert: shiftRootCA,
					},
				},
			},
			TLTC: btcCoinConfig{
				ElectrumServers: []*ServerInfo{
					{
						Server:  "tltc1.shiftcrypto.io:443",
						TLS:     true,
						PEMCert: shiftRootCA,
					},
					{
						Server:  "tltc2.shiftcrypto.io:443",
						TLS:     true,
						PEMCert: shiftRootCA,
					},
				},
			},
			ETH: ethCoinConfig{
				DeprecatedActiveERC20Tokens: []string{},
			},
			BlockExplorers: blockExplorers{
				BTC:    AvailableExplorers.Btc[0].Url,
				TBTC:   AvailableExplorers.Tbtc[0].Url,
				LTC:    AvailableExplorers.Ltc[0].Url,
				TLTC:   AvailableExplorers.Tltc[0].Url,
				ETH:    AvailableExplorers.Eth[0].Url,
				GOETH:  AvailableExplorers.GoEth[0].Url,
				SEPETH: AvailableExplorers.SepEth[0].Url,
			},
			// Copied from frontend/web/src/components/rates/rates.tsx.
			FiatList: []string{rates.USD.String(), rates.EUR.String(), rates.CHF.String()},
			MainFiat: rates.USD.String(),
			BtcUnit:  coin.BtcUnitDefault,
		},
		Frontend: make(map[string]interface{}),
	}
}

// Config manages the app configuration.
type Config struct {
	appConfigFilename string
	appConfig         AppConfig
	appConfigLock     locker.Locker

	accountsConfigFilename string
	accountsConfig         AccountsConfig
	accountsConfigLock     locker.Locker
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
	if err := config.ModifyAccountsConfig(migrateActiveTokens); err != nil {
		return nil, errp.WithStack(err)
	}
	return config, nil
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
	jsonBytes, err := os.ReadFile(config.appConfigFilename)
	if err != nil {
		return
	}
	if err := json.Unmarshal(jsonBytes, &config.appConfig); err != nil {
		return
	}
	jsonBytes, err = os.ReadFile(config.accountsConfigFilename)
	if err != nil {
		return
	}
	if err := json.Unmarshal(jsonBytes, &config.accountsConfig); err != nil {
		return
	}
}

// AppConfig returns the app config.
func (config *Config) AppConfig() AppConfig {
	defer config.appConfigLock.RLock()()
	return config.appConfig
}

// SetAppConfig sets and persists the app config.
func (config *Config) SetAppConfig(appConfig AppConfig) error {
	defer config.appConfigLock.Lock()()
	config.appConfig = appConfig
	return config.save(config.appConfigFilename, config.appConfig)
}

// ModifyAppConfig calls f with the current config, allowing f to make any changes, and
// persists the result if f returns nil error.  It propagates the f's error as is.
func (config *Config) ModifyAppConfig(f func(*AppConfig) error) error {
	defer config.appConfigLock.Lock()()
	if err := f(&config.appConfig); err != nil {
		return err
	}
	return config.save(config.appConfigFilename, config.appConfig)
}

// AccountsConfig returns the accounts config.
func (config *Config) AccountsConfig() AccountsConfig {
	defer config.accountsConfigLock.RLock()()
	return config.accountsConfig
}

// ModifyAccountsConfig calls f with the current config, allowing f to make any changes, and
// persists the result if f returns nil error.  It propagates the f's error as is.
func (config *Config) ModifyAccountsConfig(f func(*AccountsConfig) error) error {
	defer config.accountsConfigLock.Lock()()
	if err := f(&config.accountsConfig); err != nil {
		return err
	}
	return config.save(config.accountsConfigFilename, config.accountsConfig)
}

func (config *Config) save(filename string, conf interface{}) error {
	jsonBytes, err := json.MarshalIndent(conf, "", "    ")
	if err != nil {
		return errp.WithStack(err)
	}
	return errp.WithStack(os.WriteFile(filename, jsonBytes, 0644)) // #nosec G306
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
	newServers := map[string]string{
		// Old pre v1.4 electrum protocol => new v1.4 or later.
		"btc.shiftcrypto.ch:443":          "btc1.shiftcrypto.io:443",
		"merkle.shiftcrypto.ch:443":       "btc2.shiftcrypto.io:443",
		"btc.shiftcrypto.ch:51002":        "tbtc1.shiftcrypto.io:443",
		"merkle.shiftcrypto.ch:51002":     "tbtc2.shiftcrypto.io:443",
		"ltc.shiftcrypto.ch:443":          "ltc1.shiftcrypto.io:443",
		"ltc.shamir.shiftcrypto.ch:443":   "ltc2.shiftcrypto.io:443",
		"ltc.shiftcrypto.ch:51004":        "tltc1.shiftcrypto.io:443",
		"ltc.shamir.shiftcrypto.ch:51004": "tltc2.shiftcrypto.io:443",
		// Same new v1.4 servers, just different ports.
		// The original 5xxxx ports is what we've migrated app v4.24.1 to.
		// They remain functional but are more likely to be blocked by various firewalls.
		"btc1.shiftcrypto.io:50001":  "btc1.shiftcrypto.io:443",
		"btc2.shiftcrypto.io:50002":  "btc2.shiftcrypto.io:443",
		"tbtc1.shiftcrypto.io:51001": "tbtc1.shiftcrypto.io:443",
		"tbtc2.shiftcrypto.io:51002": "tbtc2.shiftcrypto.io:443",
		"ltc1.shiftcrypto.io:50011":  "ltc1.shiftcrypto.io:443",
		"ltc2.shiftcrypto.io:50012":  "ltc2.shiftcrypto.io:443",
		"tltc1.shiftcrypto.io:51011": "tltc1.shiftcrypto.io:443",
		"tltc2.shiftcrypto.io:51012": "tltc2.shiftcrypto.io:443",
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
