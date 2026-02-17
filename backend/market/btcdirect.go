// SPDX-License-Identifier: Apache-2.0

package market

import (
	"slices"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
)

const (
	// BTCDirectName is the name of the vendor, it is unique among all the supported vendors.
	BTCDirectName = "btcdirect"
	// BTCDirectOTCName is the name of the OTC vendor, it is unique among all the supported vendors.
	BTCDirectOTCName = "btcdirect-otc"

	btcDirectTestApiKey = "6ed4d42bd02eeac1776a6bb54fa3126f779c04d5c228fe5128bb74e89ef61f83"

	btcDirectProdAPiKey = "7d71f633626901d5c4d06d91f7d0db2c15cdf524ddd0ebcd36f4d9c4e04694cd"

	btcDirectBaseDevUrl = "/btcdirect/"

	btcDirectBaseProdUrl = "https://bitboxapp.shiftcrypto.io/widgets/btcdirect/v1/"

	btcDirectBuyPage = "fiat-to-coin.html"

	btcDirectSellPage = "coin-to-fiat.html"
)

type btcDirectInfo struct {
	// Url is the url of the page integrating the BTC Direct widget.
	Url string
	// ApiKey is the api key that will be passed to the widget
	ApiKey string
	// Address is the address used to buy/sell coins.
	Address string
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
		coin.CodeBTC, coin.CodeLTC, coin.CodeETH, "eth-erc20-usdc", "eth-erc20-link"}

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
func BtcDirectDeals(action Action) *DealsList {
	var deals []*Deal
	switch action {
	case BuyAction:
		deals = []*Deal{
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
		deals = []*Deal{
			{
				Fee:     2.5, // 2.5%
				Payment: BankTransferPayment,
			},
		}
	}

	return &DealsList{
		VendorName: BTCDirectName,
		Deals:      deals,
	}
}

// BtcDirectOTCDeals returns the OTC purchase conditions offered by BTCDirect.
func BtcDirectOTCDeals() *DealsList {
	return &DealsList{
		VendorName: BTCDirectOTCName,
		Deals: []*Deal{
			{
				Fee: 1,
			},
		},
	}
}

// BtcDirectInfo returns the information needed to interact with BtcDirect.
// If `devServers` is true, it returns testing URL and ApiKey.
func BtcDirectInfo(action Action, acct accounts.Interface, devServers bool) (*btcDirectInfo, error) {
	res := btcDirectInfo{
		Url:    btcDirectBaseProdUrl,
		ApiKey: btcDirectProdAPiKey,
	}

	if devServers {
		res.Url = btcDirectBaseDevUrl
		res.ApiKey = btcDirectTestApiKey
	}

	if action == BuyAction {
		res.Url += btcDirectBuyPage
		addressList, err := acct.GetUnusedReceiveAddresses()
		if err != nil {
			return nil, err
		}
		res.Address = addressList[0].Addresses[0].EncodeForHumans()
	} else {
		res.Url += btcDirectSellPage
	}
	return &res, nil
}
