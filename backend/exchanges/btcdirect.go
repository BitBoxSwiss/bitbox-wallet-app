// Copyright 2024 Shift Crypto AG
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package exchanges

import (
	"slices"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
)

const (
	// BTCDirectName is the name of the exchange, it is unique among all the supported exchanges.
	BTCDirectName = "btcdirect"

	btcDirectTestApiKey = "6ed4d42bd02eeac1776a6bb54fa3126f779c04d5c228fe5128bb74e89ef61f83"

	btcDirectProdAPiKey = "7d71f633626901d5c4d06d91f7d0db2c15cdf524ddd0ebcd36f4d9c4e04694cd"

	btcDirectTestUrl = "/btcdirect/fiat-to-coin.html"

	btcDirectProdUrl = "https://bitboxapp.shiftcrypto.io/widgets/btcdirect/v1/fiat-to-coin.html"
)

type btcDirectInfo struct {
	Url     string
	ApiKey  string
	Address *string
}

var regions = []string{
	"AT", "BE", "BG", "CH", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GR",
	"HR", "HU", "IE", "IS", "IT", "LI", "LT", "LU", "LV", "MC", "MT", "NL", "NO",
	"PL", "PT", "RO", "SE", "SI", "SK", "SM"}

// GetBtcDirectSupportedRegions returns a string slice of the regions where BTC direct services
// are available.
func GetBtcDirectSupportedRegions() []string {
	return regions
}

// isRegionSupportedBtcDirect returns whether a specific region (or an empty one
// for "unspecified") is supported by BtcDirect.
func isRegionSupportedBtcDirect(region string) bool {
	return len(region) == 0 || slices.Contains(regions, region)
}

// IsBtcDirectSupported is true if coin.Code is supported by BtcDirect.
func IsBtcDirectSupported(coinCode coin.Code) bool {
	supportedCoins := []coin.Code{
		coin.CodeBTC, coin.CodeTBTC, coin.CodeLTC, coin.CodeTLTC, coin.CodeETH, coin.CodeSEPETH,
		"eth-erc20-usdc", "eth-erc20-link"}

	coinSupported := slices.Contains(supportedCoins, coinCode)

	return coinSupported
}

// IsBtcDirectOTCSupportedForCoinInRegion returns whether Btc Direct OTC is supported for the specific
// combination of coin and region.
func IsBtcDirectOTCSupportedForCoinInRegion(coinCode coin.Code, region string) bool {
	return IsBtcDirectSupported(coinCode) && isRegionSupportedBtcDirect(region)
}

// BtcDirectDeals returns the purchase conditions (fee and payment methods) offered by BTCDirect,
// based on the action.
func BtcDirectDeals(action ExchangeAction) *ExchangeDealsList {
	var deals []*ExchangeDeal
	switch action {
	case BuyAction:
		deals = []*ExchangeDeal{
			{
				Fee:     3.9, // 3.9%
				Payment: CardPayment,
				IsFast:  true,
			},
			{
				Fee:     2, // 2%
				Payment: BankTransferPayment,
			},
			{
				Fee:      4.9, // 4.9%
				Payment:  SOFORTPayment,
				IsHidden: true,
			},
			{
				Fee:      3.6, // 3.6%
				Payment:  BancontactPayment,
				IsHidden: true,
			},
		}
	case SellAction:
		deals = []*ExchangeDeal{
			{
				Fee:     2, // 2%
				Payment: BankTransferPayment,
			},
		}
	}

	return &ExchangeDealsList{
		ExchangeName: BTCDirectName,
		Deals:        deals,
	}
}

// BtcDirectInfo returns the information needed to interact with BtcDirect.
// If `devServers` is true, it returns testing URL and ApiKey.
func BtcDirectInfo(action ExchangeAction, acct accounts.Interface, devServers bool) btcDirectInfo {
	res := btcDirectInfo{
		Url:    btcDirectProdUrl,
		ApiKey: btcDirectProdAPiKey,
	}

	if devServers {
		res.Url = btcDirectTestUrl
		res.ApiKey = btcDirectTestApiKey
	}

	if action == BuyAction {
		addr := acct.GetUnusedReceiveAddresses()[0].Addresses[0].EncodeForHumans()
		res.Address = &addr
	}
	return res
}
