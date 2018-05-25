package ltc

import "github.com/shiftdevices/godbb/backend/coins/btc"

const (
	electrumServerLitecoinTestnet = "dev.shiftcrypto.ch:51004"
	electrumServerLitecoinMainnet = "dev.shiftcrypto.ch:50004"
)

const (
	tlsYes = true
)

// MainnetCoin stores the mainnet coin.
var MainnetCoin = btc.NewCoin("ltc", "LTC", &MainNetParams, electrumServerLitecoinMainnet, tlsYes, "https://insight.litecore.io/tx/")

// TestnetCoin stores the testnet coin.
var TestnetCoin = btc.NewCoin("tltc", "TLTC", &TestNet4Params, electrumServerLitecoinTestnet, tlsYes, "http://explorer.litecointools.com/tx/")
