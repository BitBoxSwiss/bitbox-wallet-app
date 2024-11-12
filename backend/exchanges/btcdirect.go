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

var regions = []string{
	"AD", "AT", "BE", "BG", "CH", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GR",
	"HR", "HU", "IS", "IT", "LI", "LT", "LU", "LV", "MD", "ME", "MK", "NL", "NO",
	"PL", "PT", "RO", "RS", "SE", "SI", "SK", "SM"}

// GetBtcDirectSupportedRegions reutrn a string slice of the regions where BTC direct services
// are available.
func GetBtcDirectSupportedRegions() []string {
	return regions
}

// IsBtcDirectSupported is true if coin.Code and region are supported by BtcDirect.
func IsBtcDirectSupported(coinCode coin.Code, region string) bool {
	supportedCoins := []coin.Code{
		coin.CodeBTC, coin.CodeTBTC, coin.CodeETH, coin.CodeSEPETH,
		"eth-erc20-usdt", "eth-erc20-usdc", "eth-erc20-link"}

	coinSupported := slices.Contains(supportedCoins, coinCode)
	regionSupported := len(region) == 0 || slices.Contains(regions, region)

	return coinSupported && regionSupported
}
