package swapkit

import (
	"encoding/json"
	"strings"
)

var swapkitAssetByCoinCode = map[string]string{
	"btc":    "BTC.BTC",
	"tbtc":   "BTC.BTC",
	"rbtc":   "BTC.BTC",
	"eth":    "ETH.ETH",
	"sepeth": "ETH.ETH",

	"eth-erc20-usdt":      "ETH.USDT-0xdac17f958d2ee523a2206206994597c13d831ec7",
	"eth-erc20-usdc":      "ETH.USDC-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
	"eth-erc20-link":      "ETH.LINK-0x514910771af9ca656af840dff83e8264ecf986ca",
	"eth-erc20-bat":       "ETH.BAT-0x0d8775f648430679a709e98d2b0cb6250d2887ef",
	"eth-erc20-mkr":       "ETH.MKR-0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2",
	"eth-erc20-zrx":       "ETH.ZRX-0xe41d2489571d322189246dafa5ebde1f4699f498",
	"eth-erc20-wbtc":      "ETH.WBTC-0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
	"eth-erc20-paxg":      "ETH.PAXG-0x45804880De22913dAFE09f4980848ECE6EcbAf78",
	"eth-erc20-dai0x6b17": "ETH.DAI-0x6b175474e89094c44da98b954eedeac495271d0f",
}

// AssetFromCoinCode translates an internal coin code into a SwapKit asset string.
func AssetFromCoinCode(coinCode string) (string, bool) {
	asset, ok := swapkitAssetByCoinCode[strings.ToLower(strings.TrimSpace(coinCode))]
	return asset, ok
}

// NoRoutesFoundMessage returns the provider message only when the error is noRoutesFound.
func NoRoutesFoundMessage(err error) (string, bool) {
	raw := err.Error()
	jsonStart := strings.Index(raw, "{")
	if jsonStart == -1 {
		return "", false
	}
	var payload struct {
		Error   string `json:"error"`
		Message string `json:"message"`
	}
	if unmarshalErr := json.Unmarshal([]byte(raw[jsonStart:]), &payload); unmarshalErr != nil {
		return "", false
	}
	if payload.Error != "noRoutesFound" {
		return "", false
	}
	return "no route found", true
}
