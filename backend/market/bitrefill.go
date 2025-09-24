// Copyright 2025 Shift Crypto AG
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

package market

import (
	"slices"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
)

const (
	// BitrefillName is the name of the vendor, it is unique among all the supported vendors.
	BitrefillName = "bitrefill"

	bitrefillRef = "SHU5bB6y"

	bitrefillProdUrl = "https://bitboxapp.shiftcrypto.io/widgets/bitrefill/v1/bitrefill.html"
)

type bitrefillInfo struct {
	Url     string
	Ref     string
	Address *string
}

var bitrefillRegions = []string{
	"AD", "AE", "AF", "AG", "AI", "AL", "AM", "AO", "AQ", "AR", "AS", "AT", "AU",
	"AW", "AX", "AZ", "BA", "BB", "BD", "BE", "BF", "BG", "BH", "BI", "BJ", "BL",
	"BM", "BN", "BO", "BQ", "BR", "BS", "BT", "BV", "BW", "BY", "BZ", "CA", "CC",
	"CD", "CF", "CG", "CH", "CI", "CK", "CL", "CM", "CN", "CO", "CR", "CU", "CV",
	"CW", "CX", "CY", "CZ", "DE", "DJ", "DK", "DM", "DO", "DZ", "EC", "EE", "EG",
	"EH", "ER", "ES", "ET", "FI", "FJ", "FK", "FM", "FO", "FR", "GA", "GB", "GD",
	"GE", "GF", "GG", "GH", "GI", "GL", "GM", "GN", "GP", "GQ", "GR", "GS", "GT",
	"GU", "GW", "GY", "HK", "HM", "HN", "HR", "HT", "HU", "ID", "IE", "IL", "IM",
	"IN", "IO", "IQ", "IS", "IT", "JE", "JM", "JO", "JP", "KE", "KG", "KH", "KI",
	"KM", "KN", "KR", "KW", "KY", "KZ", "LA", "LB", "LC", "LI", "LK", "LR", "LS",
	"LT", "LU", "LV", "LY", "MA", "MC", "MD", "ME", "MF", "MG", "MH", "MK", "ML",
	"MN", "MO", "MP", "MQ", "MR", "MS", "MT", "MU", "MV", "MW", "MX", "MY", "MZ",
	"NA", "NC", "NE", "NF", "NG", "NI", "NL", "NO", "NP", "NR", "NU", "NZ", "OM",
	"PA", "PE", "PF", "PG", "PH", "PK", "PL", "PM", "PN", "PR", "PS", "PT", "PW",
	"PY", "QA", "RE", "RO", "RS", "RW", "SA", "SB", "SC", "SD", "SE", "SG", "SH",
	"SI", "SJ", "SK", "SL", "SM", "SN", "SO", "SR", "SS", "ST", "SV", "SY", "SZ",
	"TC", "TD", "TF", "TG", "TH", "TJ", "TK", "TL", "TM", "TN", "TO", "TR", "TT",
	"TV", "TW", "TZ", "UA", "UG", "US", "UY", "UZ", "VA", "VC", "VE", "VG", "VI",
	"VN", "VU", "WF", "WS", "XK", "YE", "YT", "ZA", "ZM", "ZW"}

// GetBitrefillSupportedRegions returns a string slice of the regions where Bitrefill services
// are available.
func GetBitrefillSupportedRegions() []string {
	return bitrefillRegions
}

// IsRegionSupportedBitrefill returns whether a specific region (or an empty one
// for "unspecified") is supported by Bitrefill.
func IsRegionSupportedBitrefill(region string) bool {
	return len(region) == 0 || slices.Contains(bitrefillRegions, region)
}

// IsBitrefillSupported is true if coin.Code is supported by Bitrefill.
func IsBitrefillSupported(coinCode coin.Code) bool {
	supportedCoins := []coin.Code{
		coin.CodeBTC, coin.CodeLTC, coin.CodeETH, coin.CodeSEPETH,
		"eth-erc20-usdc", "eth-erc20-usdt"}

	coinSupported := slices.Contains(supportedCoins, coinCode)

	return coinSupported
}

// IsBitrefillSupportedForCoinInRegion returns whether Bitrefill is supported for the specific
// combination of coin and region.
func IsBitrefillSupportedForCoinInRegion(coinCode coin.Code, region string) bool {
	return IsBitrefillSupported(coinCode) && IsRegionSupportedBitrefill(region)
}

// BitrefillDeals returns the purchase conditions (fee and payment methods) offered by Bitrefill.
func BitrefillDeals() *DealsList {
	return &DealsList{
		VendorName: BitrefillName,
		Deals: []*Deal{
			{
				Fee: 0, // There is no fee on buying gift cards
			},
		},
	}
}

// BitrefillInfo returns the information needed to interact with Bitrefill,
// including the widget URL, referral code and an unused address for refunds.
func BitrefillInfo(action Action, acct accounts.Interface) bitrefillInfo {
	addr := acct.GetUnusedReceiveAddresses()[0].Addresses[0].EncodeForHumans()
	res := bitrefillInfo{
		Url:     bitrefillProdUrl,
		Ref:     bitrefillRef,
		Address: &addr}

	return res
}
