package config

import (
	"encoding/json"
	"fmt"
	"io/ioutil"

	"github.com/shiftdevices/godbb/util/errp"
	"github.com/shiftdevices/godbb/util/locker"
)

// Backend holds the backend specific configuration.
type Backend struct {
	BitcoinP2PKHActive       bool `json:"bitcoinP2PKHActive"`
	BitcoinP2WPKHP2SHActive  bool `json:"bitcoinP2WPKHP2SHActive"`
	BitcoinP2WPKHActive      bool `json:"bitcoinP2WPKHActive"`
	LitecoinP2WPKHP2SHActive bool `json:"litecoinP2WPKHP2SHActive"`
	LitecoinP2WPKHActive     bool `json:"litecoinP2WPKHActive"`
}

// AccountActive returns the Active setting for a coin by code.
func (backend Backend) AccountActive(code string) bool {
	switch code {
	case "tbtc", "btc", "rbtc":
		return backend.BitcoinP2PKHActive
	case "tbtc-p2wpkh-p2sh", "btc-p2wpkh-p2sh", "rbtc-p2wpkh-p2sh":
		return backend.BitcoinP2WPKHP2SHActive
	case "tbtc-p2wpkh", "btc-p2wpkh", "rbtc-p2wpkh":
		return backend.BitcoinP2WPKHActive
	case "tltc-p2wpkh-p2sh", "ltc-p2wpkh-p2sh":
		return backend.LitecoinP2WPKHP2SHActive
	case "tltc-p2wpkh", "ltc-p2wpkh":
		return backend.LitecoinP2WPKHActive
	default:
		panic(fmt.Sprintf("unknown code %s", code))
	}
}

// AppConfig holds the whole app configuration.
type AppConfig struct {
	Backend  Backend     `json:"backend"`
	Frontend interface{} `json:"frontend"`
}

func defaultAppConfig() AppConfig {
	return AppConfig{
		Backend: Backend{
			BitcoinP2PKHActive:       true,
			BitcoinP2WPKHP2SHActive:  true,
			BitcoinP2WPKHActive:      false,
			LitecoinP2WPKHP2SHActive: true,
			LitecoinP2WPKHActive:     false,
		},
	}
}

// Config manages the app configuration.
type Config struct {
	lock     locker.Locker
	filename string
	config   AppConfig
}

// NewConfig creates a new Config, stored in the given location. The filename must be writable, but
// does not have to exist.
func NewConfig(filename string) *Config {
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
func (config *Config) Config() AppConfig {
	defer config.lock.RLock()()
	return config.config
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
