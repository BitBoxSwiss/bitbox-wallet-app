package bitrefill

import (
	"slices"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
)

const (
	bitrefillRef = "SHU5bB6y"

	bitrefillProdUrl = "https://bitboxapp.shiftcrypto.io/widgets/bitrefill/v1/bitrefill.html"
)

var supportedRegions = []string{
	"AE", "AN", "BL", "CH", "DE", "ES", "GD", "GB", "GI", "GS", "GR", "GL", "KN",
	"KR", "LC", "LI", "LK", "LR", "LY", "LT", "LU", "MA", "MC", "MD", "ME", "MG",
	"MH", "ML", "MK", "MN", "MO", "MQ", "MR", "MS", "MW", "MX", "MY", "MV", "MZ",
	"NA", "NE", "NF", "NG", "NI", "NL", "NP", "NR", "NU", "NC", "MP", "NZ", "OM",
	"PA", "PG", "PE", "PH", "PK", "PN", "PL", "PR", "PT", "QA", "RE", "RO", "RS",
	"RW", "SA", "SB", "SC", "SH", "SI", "SK", "SL", "SM", "ST", "SG", "SS", "TG",
	"TH", "TJ", "TK", "TL", "TO", "TR", "TT", "TV", "UG", "UA", "US", "UY", "UZ",
	"VA", "VE", "VN", "VU", "WF", "WS", "YT", "YE", "ZM", "ZW",
}

var supportedCoins = []coin.Code{coin.CodeBTC, coin.CodeLTC, coin.CodeETH, coin.CodeSEPETH, "eth-erc20-usdc", "eth-erc20-usdt"}

type bitrefillInfo struct {
	Url     string
	Ref     string
	Address *string
}

// Info provides information about Bitrefill integration for the given account.
func Info(acct accounts.Interface) bitrefillInfo {
	addr := acct.GetUnusedReceiveAddresses()[0].Addresses[0].EncodeForHumans()

	return bitrefillInfo{
		Url:     bitrefillProdUrl,
		Ref:     bitrefillRef,
		Address: &addr,
	}
}

// IsSupportedForCoinInRegion checks if the given coin code is supported in the specified region.
func IsSupportedForCoinInRegion(coinCode coin.Code, region string) bool {
	return slices.Contains(supportedCoins, coinCode) && slices.Contains(supportedRegions, region)
}
