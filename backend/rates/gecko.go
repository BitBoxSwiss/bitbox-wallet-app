package rates

import "time"

const (
	// See the following for docs and details: https://www.coingecko.com/en/api.
	coingeckoAPIV3 = "https://api.coingecko.com/api/v3"
	// A mirror of CoinGecko API specifically for use with BitBoxApp.
	shiftGeckoMirrorAPIV3 = "https://exchangerates.shiftcrypto.io/api/v3"
)

// apiRateLimit specifies the minimal interval between equally spaced API calls
// to one of the supported exchange rates providers.
func apiRateLimit(baseURL string) time.Duration {
	switch baseURL {
	default:
		return time.Second // arbitrary; localhost, staging, etc.
	case coingeckoAPIV3:
		// API calls. From https://www.coingecko.com/en/api:
		// > Generous rate limits with up to 100 requests/minute
		// We use slightly lower value.
		return 2 * time.Second
	case shiftGeckoMirrorAPIV3:
		// Avoid zero to prevent unexpected panics like in time.NewTicker
		// and leave some room to breathe.
		return 10 * time.Millisecond
	}
}

var (
	// Values are copied from https://api.coingecko.com/api/v3/coins/list.
	// TODO: Replace keys with coin.Code.
	geckoCoin = map[string]string{
		"btc": "bitcoin",
		"ltc": "litecoin",
		"eth": "ethereum",
		// Useful for testing with testnets.
		"tbtc": "bitcoin",
		"rbtc": "bitcoin",
		"tltc": "litecoin",
		"teth": "ethereum",
		"reth": "ethereum",
		// ERC20 tokens as used in the backend.
		// Frontend and app config use unprefixed name, without "eth-erc20-".
		"eth-erc20-bat":       "basic-attention-token",
		"eth-erc20-dai0x6b17": "dai",
		"eth-erc20-link":      "chainlink",
		"eth-erc20-mkr":       "maker",
		"eth-erc20-sai0x89d2": "sai",
		"eth-erc20-usdc":      "usd-coin",
		"eth-erc20-usdt":      "tether",
		"eth-erc20-zrx":       "0x",
		"eth-erc20-wbtc":      "wrapped-bitcoin",
		"eth-erc20-paxg":      "pax-gold",
	}

	// Copied from https://api.coingecko.com/api/v3/simple/supported_vs_currencies.
	// The keys must match entries in fiats slice.
	geckoFiat = map[string]string{
		"USD": "usd",
		"EUR": "eur",
		"CHF": "chf",
		"GBP": "gbp",
		"JPY": "jpy",
		"KRW": "krw",
		"CNY": "cny",
		"RUB": "rub",
		"CAD": "cad",
		"AUD": "aud",
		"ILS": "ils",
		"BTC": "btc",
		"SGD": "sgd",
	}
)
