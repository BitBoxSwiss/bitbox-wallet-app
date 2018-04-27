package ltc

import "github.com/shiftdevices/godbb/backend/coins/btc"

const (
	electrumServerLitecoinTestnet = "dev.shiftcrypto.ch:51004"
	electrumServerLitecoinMainnet = "dev.shiftcrypto.ch:50004"
)

const (
	tlsYes = true
)

var MainnetCoin = btc.NewCoin("ltc", &MainNetParams, electrumServerLitecoinMainnet, tlsYes, "https://insight.litecore.io/tx/")
var TestnetCoin = btc.NewCoin("tltc", &TestNet4Params, electrumServerLitecoinTestnet, tlsYes, "http://explorer.litecointools.com/tx/")
