package ltc

import "github.com/shiftdevices/godbb/backend/coins/btc"

// MainnetCoin stores the mainnet coin.
var MainnetCoin = btc.NewCoin("ltc", "LTC", &MainNetParams, "https://insight.litecore.io/tx/")

// TestnetCoin stores the testnet coin.
var TestnetCoin = btc.NewCoin("tltc", "TLTC", &TestNet4Params, "http://explorer.litecointools.com/tx/")
