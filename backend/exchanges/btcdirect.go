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

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
)

const (
	// BTCDirectName is the name of the exchange, it is unique among all the supported exchanges.
	BTCDirectName = "btcdirect"
)

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
		"eth-erc20-usdt", "eth-erc20-usdc", "eth-erc20-link"}

	coinSupported := slices.Contains(supportedCoins, coinCode)

	return coinSupported
}

// IsBtcDirectOTCSupportedForCoinInRegion returns whether Btc Direct OTC is supported for the specific
// combination of coin and region.
func IsBtcDirectOTCSupportedForCoinInRegion(coinCode coin.Code, region string) bool {
	return IsBtcDirectSupported(coinCode) && isRegionSupportedBtcDirect(region)
}

// BtcDirectDeals returns the purchase conditions (fee and payment methods) offered by BTCDirect.
func BtcDirectDeals() *ExchangeDealsList {
	return &ExchangeDealsList{
		ExchangeName: BTCDirectName,
		Deals: []*ExchangeDeal{
			{
				Fee:     3,
				Payment: CardPayment,
				IsFast:  true,
			},
			{
				Fee:     2,
				Payment: BankTransferPayment,
			},
		},
	}
}
