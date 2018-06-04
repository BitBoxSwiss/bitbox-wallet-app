package config

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"sync"

	"github.com/shiftdevices/godbb/backend/arguments"
	"github.com/shiftdevices/godbb/util/errp"
	"github.com/shiftdevices/godbb/util/locker"
)

const (
	tlsYes bool = true
	tlsNo  bool = false
)

// ServerInfo holds information about the backend server(s).
type ServerInfo struct {
	Server string `json:"server"`
	TLS    bool   `json:"tls"`
}

// BackendProperties hold the properties of the backend
type BackendProperties struct {
	Active  bool          `json:"active"`
	Mainnet []*ServerInfo `json:"mainnet"`
	Testnet []*ServerInfo `json:"testnet"`
}

// Backend holds the backend specific configuration.
type Backend struct {
	BitcoinP2PKH       BackendProperties `json:"bitcoinP2PKH"`
	BitcoinP2WPKHP2SH  BackendProperties `json:"bitcoinP2WPKHP2SH"`
	BitcoinP2WPKH      BackendProperties `json:"bitcoinP2WPKH"`
	LitecoinP2WPKHP2SH BackendProperties `json:"litecoinP2WPKHP2SH"`
	LitecoinP2WPKH     BackendProperties `json:"litecoinP2WPKH"`
}

// getBackendProperties returns the properties for a given code
func (backend Backend) getBackendProperties(code string) BackendProperties {
	switch code {
	case "tbtc", "btc", "rbtc":
		return backend.BitcoinP2PKH
	case "tbtc-p2wpkh-p2sh", "btc-p2wpkh-p2sh", "rbtc-p2wpkh-p2sh":
		return backend.BitcoinP2WPKHP2SH
	case "tbtc-p2wpkh", "btc-p2wpkh", "rbtc-p2wpkh":
		return backend.BitcoinP2WPKH
	case "tltc-p2wpkh-p2sh", "ltc-p2wpkh-p2sh":
		return backend.LitecoinP2WPKHP2SH
	case "tltc-p2wpkh", "ltc-p2wpkh":
		return backend.LitecoinP2WPKH
	default:
		panic(fmt.Sprintf("unknown code %s", code))
	}
}

// GetServers returns the servers for a coin by code.
func (backend Backend) GetServers(code string) []*ServerInfo {
	backendProperties := backend.getBackendProperties(code)
	if code[0] == 't' { // TODO: and 'r'?
		return backendProperties.Testnet
	}
	return backendProperties.Mainnet
}

// AccountActive returns the Active setting for a coin by code.
func (backend Backend) AccountActive(code string) bool {
	backendProperties := backend.getBackendProperties(code)
	return backendProperties.Active
}

// AppConfig holds the whole app configuration.
type AppConfig struct {
	Backend  Backend     `json:"backend"`
	Frontend interface{} `json:"frontend"`
}

// combine is a utility function that combines the server/tls information with a given port.
func combine(hosts map[string]bool, port int) []*ServerInfo {
	serverInfos := []*ServerInfo{}
	for host, tls := range hosts {
		server := fmt.Sprintf("%s:%d", host, port)
		serverInfos = append(serverInfos, &ServerInfo{server, tls})
	}
	return serverInfos
}

func defaultProdServers(code string) []*ServerInfo {
	hostsBtc := map[string]bool{"btc.shiftcrypto.ch": tlsYes, "merkle.shiftcrypto.ch": tlsYes}
	hostsLtc := map[string]bool{"ltc.shiftcrypto.ch": tlsYes, "ltc.shamir.shiftcrypto.ch": tlsYes}
	switch code {
	case "btc", "btc-p2wpkh-p2sh", "btc-p2wpkh":
		port := 443
		return combine(hostsBtc, port)
	case "tbtc", "tbtc-p2wpkh-p2sh", "tbtc-p2wpkh":
		port := 51002
		return combine(hostsBtc, port)
	case "ltc", "ltc-p2wpkh-p2sh", "ltc-p2wpkh":
		port := 443
		return combine(hostsLtc, port)
	case "tltc", "tltc-p2wpkh-p2sh", "tltc-p2wpkh":
		port := 51004
		return combine(hostsLtc, port)
	default:
		panic(errp.Newf("The given code %s is unknown.", code))
	}
}

func defaultDevServers(code string) []*ServerInfo {
	hosts := map[string]bool{"s1.dev.shiftcrypto.ch": tlsYes, "s2.dev.shiftcrypto.ch": tlsYes}
	port := 0
	switch code {
	case "btc", "btc-p2wpkh-p2sh", "btc-p2wpkh":
		port = 50002
	case "tbtc", "tbtc-p2wpkh-p2sh", "tbtc-p2wpkh":
		port = 51003
	case "rbtc", "rbtc-p2wpkh-p2sh", "rbtc-p2wpkh":
		hosts = map[string]bool{"127.0.0.1": tlsNo}
		port = 52001
	case "ltc", "ltc-p2wpkh-p2sh", "ltc-p2wpkh":
		port = 50004
	case "tltc", "tltc-p2wpkh-p2sh", "tltc-p2wpkh":
		port = 51004
	default:
		panic(errp.Newf("The given code %s is unknown.", code))
	}
	return combine(hosts, port)
}

func defaultServers(code string, devmode bool) []*ServerInfo {
	if devmode {
		return defaultDevServers(code)
	}
	return defaultProdServers(code)
}

func defaultAppConfig() AppConfig {
	devmode := arguments.Get().DevMode()
	return AppConfig{
		Backend: Backend{
			BitcoinP2PKH:       BackendProperties{Active: true, Mainnet: defaultServers("btc", devmode), Testnet: defaultServers("tbtc", devmode)},
			BitcoinP2WPKHP2SH:  BackendProperties{Active: true, Mainnet: defaultServers("btc-p2wpkh-p2sh", devmode), Testnet: defaultServers("tbtc-p2wpkh-p2sh", devmode)},
			BitcoinP2WPKH:      BackendProperties{Active: false, Mainnet: defaultServers("btc-p2wpkh", devmode), Testnet: defaultServers("tbtc-p2wpkh", devmode)},
			LitecoinP2WPKHP2SH: BackendProperties{Active: false, Mainnet: defaultServers("ltc-p2wpkh-p2sh", devmode), Testnet: defaultServers("tltc-p2wpkh-p2sh", devmode)},
			LitecoinP2WPKH:     BackendProperties{Active: false, Mainnet: defaultServers("ltc-p2wpkh", devmode), Testnet: defaultServers("tltc-p2wpkh", devmode)},
		},
	}
}

// Config manages the app configuration.
type Config struct {
	lock     locker.Locker
	filename string
	config   AppConfig
}

var instance *Config
var once sync.Once

// Get returns the singleton config instance.
func Get() *Config {
	if instance == nil {
		once.Do(func() {
			instance = newConfig(arguments.Get().ConfigFilename())
		})
	}
	return instance
}

// newConfig creates a new Config, stored in the given location. The filename must be writable, but
// does not have to exist.
func newConfig(filename string) *Config {
	config := &Config{
		filename: filename,
		config:   defaultAppConfig(),
	}
	config.load()
	return config
}

func (config *Config) load() {
	jsonBytes, err := ioutil.ReadFile(config.filename)
	if err != nil {
		return
	}
	if err := json.Unmarshal(jsonBytes, &config.config); err != nil {
		return
	}
}

// Config returns the app config.
func (config *Config) Config() *AppConfig {
	defer config.lock.RLock()()
	return &config.config
}

// Set sets and persists the app config.
func (config *Config) Set(appConfig AppConfig) error {
	defer config.lock.Lock()()
	config.config = appConfig
	return config.save()
}

func (config *Config) save() error {
	jsonBytes, err := json.Marshal(config.config)
	if err != nil {
		return errp.WithStack(err)
	}
	return errp.WithStack(ioutil.WriteFile(config.filename, jsonBytes, 0644))
}
