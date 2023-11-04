package config

import "github.com/digitalbitbox/bitbox-wallet-app/backend/coins/coin"

// BlockExplorer interface that different coin configurations can implement.
// It defines the Enabled() method which returns true if the user enabled the
// option to use a custom blockexplorer in the settings. The ExplorerURL() method
// returns the configured URL or a defined default as a string.
type BlockExplorer interface {
	Enabled()
	ExplorerURL()
}

// The BlockExplorerConfig struct is used by the Backend configuration.
type BlockExplorerConfig struct {
	UseExplorer bool `json:"useCustomBlockExplorer"`
	// Thies field is filled with a default when the config is created
	// the default needs to be the placeholder value specified in the frontend.
	ExplorerURL string `json:"explorerURL"`
}

// Implement custom blockexplorer for Bitcoin

const defaultTestnet = "https://blockstream.info/testnet/tx/"
const defaultBitcoin = "https://blockstream.info/tx/"

func (btcCfg btcCoinConfig) Enabled() bool {
	return btcCfg.BlockExplorer.UseExplorer
}

func (btcCfg btcCoinConfig) ExplorerURL() string {
	if btcCfg.Enabled() {
		return btcCfg.BlockExplorer.ExplorerURL
	}
	url := ""
	switch btcCfg.Code {
	case coin.CodeBTC:
		url = defaultBitcoin
	case coin.CodeTBTC:
		url = defaultTestnet

	}
	return url
}
