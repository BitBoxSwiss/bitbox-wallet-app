package config

// BlockExplorer defines a selectable block explorer.
type BlockExplorer struct {
	// Name of the block explorer used for UI.
	Name string `json:"name"`
	// Url of the block explorer that the txid is appended.
	Url string `json:"url"`
}

// AvailableBlockExplorers defines all available block explorers for each coin.
type AvailableBlockExplorers struct {
	Btc    []BlockExplorer `json:"btc"`
	Tbtc   []BlockExplorer `json:"tbtc"`
	Ltc    []BlockExplorer `json:"ltc"`
	Tltc   []BlockExplorer `json:"tltc"`
	Eth    []BlockExplorer `json:"eth"`
	GoEth  []BlockExplorer `json:"goeth"`
	SepEth []BlockExplorer `json:"sepeth"`
}

// AvailableExplorers holds all available block explorers for each coin.
// It is returned from the available-explorers endpoint.
var AvailableExplorers = AvailableBlockExplorers{
	Btc: []BlockExplorer{
		{
			Name: "blockstream.info",
			Url:  "https://blockstream.info/tx/",
		},
		{
			Name: "mempool.space",
			Url:  "https://mempool.space/tx",
		},
	},
	Tbtc: []BlockExplorer{
		{
			Name: "mempool.space",
			Url:  "https://mempool.space/testnet/tx/",
		},
		{
			Name: "blockstream.info",
			Url:  "https://blockstream.info/testnet/tx/",
		},
	},
	Ltc: []BlockExplorer{
		{
			Name: "sochain.com",
			Url:  "https://sochain.com/tx/",
		},
		{
			Name: "blockchair.com",
			Url:  "https://blockchair.com/litecoin/transaction",
		},
	},
	Tltc: []BlockExplorer{
		{
			Name: "sochain.com",
			Url:  "https://sochain.com/tx/LTCTEST/",
		},
	},
	Eth: []BlockExplorer{
		{
			Name: "etherscan.io",
			Url:  "https://etherscan.io/tx/",
		},
		{
			Name: "ethplorer.io",
			Url:  "https://ethplorer.io/tx/",
		},
	},
	GoEth: []BlockExplorer{
		{
			Name: "etherscan.io",
			Url:  "https://goerli.etherscan.io/tx/",
		},
		{
			Name: "ethplorer.io",
			Url:  "https://goerli.ethplorer.io/tx/",
		},
	},
	SepEth: []BlockExplorer{
		{
			Name: "etherscan.io",
			Url:  "https://sepolia.etherscan.io/tx/",
		},
		{
			Name: "ethplorer.io",
			Url:  "https://sepolia.ethplorer.io/tx/",
		},
	},
}
