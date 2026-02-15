// SPDX-License-Identifier: Apache-2.0

package market

import (
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/util"
)

const (
	// moonpayAPITestPubKey is the public key of Shift Crypto Moonpay account.
	// See https://dev.moonpay.com/docs/credit-cards-testing for how to test.
	moonpayBuyAPITestPubKey = "pk_test_e9i4oaa4J7eKo8UI3Wm8QLagoskWGjXN"
	moonpayBuyAPITestURL    = "https://buy-staging.moonpay.com"

	// moonpayAPILivePubKey is the production API key for real transactions.
	// It is ok for it to be public.
	moonpayBuyAPILivePubKey = "pk_live_jfhWEt55szMLar8DhQWWiDwteX1mftY"
	moonpayBuyAPILiveURL    = "https://buy.moonpay.com"

	// moonpayAPILiveURL is the API url for REST calls.
	moonpayAPILiveURL = "https://api.moonpay.com/v3"

	// MoonpayName is the name of the vendor, it is unique among all the supported vendors.
	MoonpayName = "moonpay"
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

// moonpayExcludeAlpha2Codes defines country alpha2 codes to exclude from Moonpay supported regions.
var moonpayExcludeAlpha2Codes = map[string]struct{}{
	"UK": {},
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

// BuyMoonpayRegion represents informations collected by Moonpay supported countries REST call.
type BuyMoonpayRegion struct {
	Alpha2       string `json:"alpha2"`       // ISO 3166-1 alpha-2 code of the region (e.g. `CH` for Switzerland)
	IsBuyAllowed bool   `json:"isBuyAllowed"` // true if Moonpay supports this region
}

// GetMoonpaySupportedRegions query moonpay API and returns a map of regions where buy is allowed.
func GetMoonpaySupportedRegions(httpClient *http.Client) (map[string]BuyMoonpayRegion, error) {
	regionsMap := make(map[string]BuyMoonpayRegion)
	var regionsList []BuyMoonpayRegion
	endpoint := fmt.Sprintf("%s/countries", moonpayAPILiveURL)

	_, err := util.APIGet(httpClient, endpoint, "", 1000000, &regionsList)
	if err != nil {
		return nil, err
	}

	for _, region := range regionsList {
		if _, excluded := moonpayExcludeAlpha2Codes[region.Alpha2]; region.IsBuyAllowed && !excluded {
			regionsMap[region.Alpha2] = region
		}
	}

	return regionsMap, nil
}

// MoonpayDeals returns the purchase conditions (fee and payment methods) offered by Moonpay.
func MoonpayDeals(action Action) *DealsList {
	if action == BuyAction {
		return &DealsList{
			VendorName: MoonpayName,
			Deals: []*Deal{
				{
					Fee:     4.9, // 4.9%
					Payment: CardPayment,
					IsFast:  true,
				},
				{
					Fee:     1.9, // 1.9%
					Payment: BankTransferPayment,
					IsFast:  false,
				},
			},
		}
	}
	return nil
}

// MoonpayInfo returns info for the frontend to initiate an onramp flow.
func MoonpayInfo(acct accounts.Interface, params BuyMoonpayParams) (BuyMoonpayInfo, error) {
	if !IsMoonpaySupported(acct.Coin().Code()) {
		return BuyMoonpayInfo{}, fmt.Errorf("unsupported cryptocurrency code %q", acct.Coin().Code())
	}
	ccode, ok := moonpayAPICryptoCode[acct.Coin().Code()]
	if !ok {
		return BuyMoonpayInfo{}, fmt.Errorf("unknown cryptocurrency code %q", acct.Coin().Code())
	}
	apiKey := moonpayBuyAPILivePubKey
	apiURL := moonpayBuyAPILiveURL
	if _, isTestnet := coin.TestnetCoins[acct.Coin().Code()]; isTestnet {
		apiKey = moonpayBuyAPITestPubKey
		apiURL = moonpayBuyAPITestURL
	}
	unused, err := acct.GetUnusedReceiveAddresses()
	if err != nil {
		return BuyMoonpayInfo{}, err
	}
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
