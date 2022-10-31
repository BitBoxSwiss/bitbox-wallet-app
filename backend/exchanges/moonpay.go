package exchanges

import (
	"fmt"
	"net/url"
	"strings"

	"github.com/digitalbitbox/bitbox-wallet-app/backend/accounts"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/coin"
)

const (
	// moonpayAPITestPubKey is the public key of Shift Crypto Moonpay account.
	// Test assets and notes:
	// - working fake CC: 4000 0231 0466 2535, 12/2020, 123
	// - always declined CC: 4008 3708 9666 2369, 12/2020, 123
	// - TBTC and testnet ETH works; send them back after a purchase to
	//   tb1q45h8zexwztmz3nyd8gmkxhpavdsva4znwwhzvs and
	//   0xc216eD2D6c295579718dbd4a797845CdA70B3C36, respectively.
	//   TODO: used to be Ropsten, which has been shut down. Replace with another tesntet.
	// - KYC always succeeds; simply click on "submit anyway"
	// - need to provide a valid email addr to receive a check code;
	//   any temp email service like fakermail.com will do
	moonpayAPITestPubKey = "pk_test_e9i4oaa4J7eKo8UI3Wm8QLagoskWGjXN"
	moonpayAPITestURL    = "https://buy-staging.moonpay.com"

	// moonpayAPILivePubKey is the production API key for real transactions.
	// It is ok for it to be public.
	moonpayAPILivePubKey = "pk_live_jfhWEt55szMLar8DhQWWiDwteX1mftY"
	moonpayAPILiveURL    = "https://buy.moonpay.com"
)

// Here's the list of all supported currencies:
// https://api.moonpay.com/v3/currencies?apiKey=pk_test_e9i4oaa4J7eKo8UI3Wm8QLagoskWGjXN
// Note that it may be different for live API key.
var moonpayAPICryptoCode = map[coin.Code]string{ // -> moonpay crypto currency code
	coin.CodeBTC: "btc",
	coin.CodeLTC: "ltc",
	coin.CodeETH: "eth",

	"eth-erc20-usdt":      "usdt",
	"eth-erc20-usdc":      "usdc",
	"eth-erc20-bat":       "bat",
	"eth-erc20-dai0x6b17": "dai",
	"eth-erc20-link":      "link",
	"eth-erc20-mkr":       "mkr",
	"eth-erc20-zrx":       "zrx",
	"eth-erc20-wbtc":      "wbtc",
	"eth-erc20-paxg":      "paxg",

	// Test mode.
	coin.CodeTBTC: "btc", // testnet
	// TODO: Ropsten is shut down, check which other testnet Moonpay supports.
	// coin.CodeTETH: "eth", // ropsten
}

// moonpayAPIPaymentMethods defines which payment methods can be used in onramp.
var moonpayAPIPaymentMethods = []string{
	"credit_debit_card",
	"apple_pay",
	"google_pay",
	"samsung_pay",
	"sepa_bank_transfer",
	"gbp_bank_transfer",
	"gbp_open_banking_payment",
}

// BuyMoonpayInfo contains a starting point for initiating an onramp flow.
type BuyMoonpayInfo struct {
	URL     string // moonpay's buy widget URL
	Address string // which address to send coins to
}

// BuyMoonpayParams specifies parameters to iniate a cryptocurrency purchase flow.
type BuyMoonpayParams struct {
	Fiat string // fiat currency code, like "CHF" or "USD"
	Lang string // user preferred language in ISO 639-1; falls back to "en"
}

// BuyMoonpay returns info for the frontend to initiate an onramp flow.
func BuyMoonpay(acct accounts.Interface, params BuyMoonpayParams) (BuyMoonpayInfo, error) {
	if !IsMoonpaySupported(acct.Coin().Code()) {
		return BuyMoonpayInfo{}, fmt.Errorf("unsupported cryptocurrency code %q", acct.Coin().Code())
	}
	ccode, ok := moonpayAPICryptoCode[acct.Coin().Code()]
	if !ok {
		return BuyMoonpayInfo{}, fmt.Errorf("unknown cryptocurrency code %q", acct.Coin().Code())
	}
	apiKey := moonpayAPILivePubKey
	apiURL := moonpayAPILiveURL
	if _, isTestnet := coin.TestnetCoins[acct.Coin().Code()]; isTestnet {
		apiKey = moonpayAPITestPubKey
		apiURL = moonpayAPITestURL
	}
	unused := acct.GetUnusedReceiveAddresses()
	addr := unused[0].Addresses[0] // TODO: Let them choose sub acct?
	// See https://www.moonpay.com/dashboard/getting_started/ for all available options.
	// Note: the link is behind authentication.
	val := url.Values{
		"apiKey":                {apiKey},
		"enabledPaymentMethods": {strings.Join(moonpayAPIPaymentMethods, ",")},
		"walletAddress":         {addr.EncodeForHumans()},
		"currencyCode":          {ccode},
		"language":              {params.Lang},
		"baseCurrencyCode":      {params.Fiat},
	}
	return BuyMoonpayInfo{
		URL:     fmt.Sprintf("%s?%s", apiURL, val.Encode()),
		Address: addr.EncodeForHumans(),
	}, nil
}

// IsMoonpaySupported reports whether moonpay.com supports onramp.
func IsMoonpaySupported(code coin.Code) bool {
	_, ok := moonpayAPICryptoCode[code]
	return ok
}
