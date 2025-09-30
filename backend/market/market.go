// Copyright 2022 Shift Crypto AG
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
	"net/http"
	"slices"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/logging"
)

// RegionCodes is an array containing ISO 3166-1 alpha-2 code of all regions.
// Source: https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2
var RegionCodes = []string{
	"AD", "AE", "AF", "AG", "AI", "AL", "AM", "AO", "AQ", "AR", "AS", "AT", "AU", "AW", "AX", "AZ",
	"BA", "BB", "BD", "BE", "BF", "BG", "BH", "BI", "BJ", "BL", "BM", "BN", "BO", "BQ", "BR", "BS",
	"BT", "BV", "BW", "BY", "BZ", "CA", "CC", "CD", "CF", "CG", "CH", "CI", "CK", "CL", "CM", "CN",
	"CO", "CR", "CU", "CV", "CW", "CX", "CY", "CZ", "DE", "DJ", "DK", "DM", "DO", "DZ", "EC", "EE",
	"EG", "EH", "ER", "ES", "ET", "FI", "FJ", "FK", "FM", "FO", "FR", "GA", "GB", "GD", "GE", "GF",
	"GG", "GH", "GI", "GL", "GM", "GN", "GP", "GQ", "GR", "GS", "GT", "GU", "GW", "GY", "HK", "HM",
	"HN", "HR", "HT", "HU", "ID", "IE", "IL", "IM", "IN", "IO", "IQ", "IR", "IS", "IT", "JE", "JM",
	"JO", "JP", "KE", "KG", "KH", "KI", "KM", "KN", "KP", "KR", "KW", "KY", "KZ", "LA", "LB", "LC",
	"LI", "LK", "LR", "LS", "LT", "LU", "LV", "LY", "MA", "MC", "MD", "ME", "MF", "MG", "MH", "MK",
	"ML", "MM", "MN", "MO", "MP", "MQ", "MR", "MS", "MT", "MU", "MV", "MW", "MX", "MY", "MZ", "NA",
	"NC", "NE", "NF", "NG", "NI", "NL", "NO", "NP", "NR", "NU", "NZ", "OM", "PA", "PE", "PF", "PG",
	"PH", "PK", "PL", "PM", "PN", "PR", "PS", "PT", "PW", "PY", "QA", "RE", "RO", "RS", "RU", "RW",
	"SA", "SB", "SC", "SD", "SE", "SG", "SH", "SI", "SJ", "SK", "SL", "SM", "SN", "SO", "SR", "SS",
	"ST", "SV", "SX", "SY", "SZ", "TC", "TD", "TF", "TG", "TH", "TJ", "TK", "TL", "TM", "TN", "TO",
	"TR", "TT", "TV", "TW", "TZ", "UA", "UG", "UM", "US", "UY", "UZ", "VA", "VC", "VE", "VG", "VI",
	"VN", "VU", "WF", "WS", "XK", "YE", "YT", "ZA", "ZM", "ZW"}

// Error is an error code for market related issues.
type Error string

func (err Error) Error() string {
	return string(err)
}

var (
	// ErrCoinNotSupported is used when the vendor doesn't support a given coin type.
	ErrCoinNotSupported = Error("coinNotSupported")
	// ErrRegionNotSupported is used when the vendor doesn't operate in a given region.
	ErrRegionNotSupported = Error("regionNotSupported")
)

// Action identifies buy, sell or spend actions.
type Action string

const (
	// BuyAction identifies a buy market action.
	BuyAction Action = "buy"
	// SellAction identifies a sell market action.
	SellAction Action = "sell"
	// SpendAction identifies a spend market action.
	SpendAction Action = "spend"
)

// ParseAction parses an action string and returns an Action.
func ParseAction(action string) (Action, error) {
	switch action {
	case "buy":
		return BuyAction, nil
	case "sell":
		return SellAction, nil
	case "spend":
		return SpendAction, nil
	default:
		return "", errp.New("Invalid Market action")
	}
}

// RegionList contains a list of Region objects.
type RegionList struct {
	Regions []Region `json:"regions"`
}

// Region contains the ISO 3166-1 alpha-2 code of a specific region and a boolean
// for each vendor, indicating if that vendor is enabled for the region.
type Region struct {
	Code               string `json:"code"`
	IsMoonpayEnabled   bool   `json:"isMoonpayEnabled"`
	IsPocketEnabled    bool   `json:"isPocketEnabled"`
	IsBtcDirectEnabled bool   `json:"isBtcDirectEnabled"`
	IsBitrefillEnabled bool   `json:"isBitrefillEnabled"`
}

// PaymentMethod type is used for payment options in market deals.
type PaymentMethod string

const (
	// CardPayment is a payment with credit/debit card.
	CardPayment PaymentMethod = "card"
	// BankTransferPayment is a payment with bank transfer.
	BankTransferPayment PaymentMethod = "bank-transfer"
	// SOFORTPayment is a payment method in the SEPA region.
	SOFORTPayment PaymentMethod = "sofort"
	// BancontactPayment is a payment method in the SEPA region.
	BancontactPayment PaymentMethod = "bancontact"
)

// Deal represents a specific purchase option of a vendor.
type Deal struct {
	// Fee that goes to the vendor in percentage.
	Fee float32 `json:"fee"`
	// Payment is the payment method offered in the deal (usually different payment methods bring different fees).
	Payment PaymentMethod `json:"payment"`
	// IsFast is usually associated with card payments. It is used by the frontend to display the `fast` badge in deals list.
	IsFast bool `json:"isFast"`
	// IsBest is assigned to the deal with the lowest fee, it is used to show the `best deal` badge in the frontend.
	IsBest bool `json:"isBest"`
	// IsHidden deals are not explicitly listed in the frontend deals list.
	IsHidden bool `json:"isHidden"`
}

// DealsList list the name of a specific vendors and the list of available deals offered by that vendor.
type DealsList struct {
	VendorName string  `json:"vendorName"`
	Deals      []*Deal `json:"deals"`
}

// ListVendorsByRegion populates an array of `Region` objects representing the availability
// of the various vendors in each of them, for the provided account.
// For each region, a vendor is enabled if it supports the account coin and it is active in that region.
// NOTE: if one of the endpoint fails for any reason, the related vendor will be set as available in any
// region by default (for the supported coins).
func ListVendorsByRegion(account accounts.Interface, httpClient *http.Client) RegionList {
	moonpayRegions, moonpayError := GetMoonpaySupportedRegions(httpClient)
	log := logging.Get().WithGroup("market")
	if moonpayError != nil {
		log.Error(moonpayError)
	}

	pocketRegions, pocketError := GetPocketSupportedRegions(httpClient)
	if pocketError != nil {
		log.Error(pocketError)
	}

	btcDirectRegions := GetBtcDirectSupportedRegions()
	bitrefillRegions := GetBitrefillSupportedRegions()

	isMoonpaySupported := IsMoonpaySupported(account.Coin().Code())
	isPocketSupported := IsPocketSupported(account.Coin().Code())
	isBtcDirectSupported := IsBtcDirectSupported(account.Coin().Code())
	isBitrefillSupported := IsBitrefillSupported(account.Coin().Code())

	vendorRegions := RegionList{}
	for _, code := range RegionCodes {
		// default behavior is to show the vendor if the supported regions check fails.
		moonpayEnabled, pocketEnabled := true, true
		if moonpayError == nil {
			_, moonpayEnabled = moonpayRegions[code]
		}
		if pocketError == nil {
			_, pocketEnabled = pocketRegions[code]
		}
		btcDirectEnabled := slices.Contains(btcDirectRegions, code)
		bitrefillEnabled := slices.Contains(bitrefillRegions, code)

		vendorRegions.Regions = append(vendorRegions.Regions, Region{
			Code:               code,
			IsMoonpayEnabled:   moonpayEnabled && isMoonpaySupported,
			IsPocketEnabled:    pocketEnabled && isPocketSupported,
			IsBtcDirectEnabled: btcDirectEnabled && isBtcDirectSupported,
			IsBitrefillEnabled: bitrefillEnabled && isBitrefillSupported,
		})
	}

	return vendorRegions
}

// GetDeals returns the vendor deals available for the specified account, region and action.
func GetDeals(account accounts.Interface, regionCode string, action Action, httpClient *http.Client) ([]*DealsList, error) {
	moonpaySupportsCoin := IsMoonpaySupported(account.Coin().Code()) && action == BuyAction
	pocketSupportsCoin := IsPocketSupported(account.Coin().Code()) && (action == BuyAction || action == SellAction)
	btcDirectSupportsCoin := IsBtcDirectSupported(account.Coin().Code()) && (action == BuyAction || action == SellAction)
	bitrefillSupportsCoin := IsBitrefillSupported(account.Coin().Code()) && action == SpendAction
	coinSupported := moonpaySupportsCoin || pocketSupportsCoin || btcDirectSupportsCoin || bitrefillSupportsCoin
	if !coinSupported {
		return nil, ErrCoinNotSupported
	}

	var userRegion *Region
	if len(regionCode) > 0 {
		vendorsByRegion := ListVendorsByRegion(account, httpClient)
		for _, region := range vendorsByRegion.Regions {
			if region.Code == regionCode {
				// to avoid exporting loop refs
				region := region
				userRegion = &region
				break
			}
		}
	}
	if userRegion == nil {
		userRegion = &Region{
			IsMoonpayEnabled:   true,
			IsPocketEnabled:    true,
			IsBtcDirectEnabled: true,
			IsBitrefillEnabled: true,
		}
	}

	marketDealsLists := []*DealsList{}

	if pocketSupportsCoin && userRegion.IsPocketEnabled {
		deals := PocketDeals()
		if deals != nil {
			marketDealsLists = append(marketDealsLists, deals)
		}
	}
	if moonpaySupportsCoin && userRegion.IsMoonpayEnabled {
		deals := MoonpayDeals(action)
		if deals != nil {
			marketDealsLists = append(marketDealsLists, deals)
		}
	}
	if btcDirectSupportsCoin && userRegion.IsBtcDirectEnabled {
		deals := BtcDirectDeals(action)
		if deals != nil {
			marketDealsLists = append(marketDealsLists, deals)
		}
	}
	if bitrefillSupportsCoin && userRegion.IsBitrefillEnabled {
		deals := BitrefillDeals()
		if deals != nil {
			marketDealsLists = append(marketDealsLists, deals)
		}
	}

	if len(marketDealsLists) == 0 {
		return nil, ErrRegionNotSupported
	}

	deals := []*Deal{}
	for _, dealsList := range marketDealsLists {
		if dealsList != nil {
			deals = append(deals, dealsList.Deals...)
		}
	}

	if len(deals) > 1 {
		bestDealIndex := 0
		for i, deal := range deals {
			oldBestDeal := deals[bestDealIndex]
			if !deal.IsHidden && deal.Fee < oldBestDeal.Fee {
				bestDealIndex = i
			}
		}
		deals[bestDealIndex].IsBest = true
	}

	return marketDealsLists, nil
}
