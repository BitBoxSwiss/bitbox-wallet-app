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

package exchanges

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
	"VN", "VU", "WF", "WS", "YE", "YT", "ZA", "ZM", "ZW"}

// ExchangeError is an error code for exchange related issues.
type ExchangeError string

func (err ExchangeError) Error() string {
	return string(err)
}

var (
	// ErrCoinNotSupported is used when the exchange doesn't support a given coin type.
	ErrCoinNotSupported = ExchangeError("coinNotSupported")
	// ErrRegionNotSupported is used when the exchange doesn't operate in a given region.
	ErrRegionNotSupported = ExchangeError("regionNotSupported")
)

// ExchangeAction identifies buy or sell actions.
type ExchangeAction string

const (
	// BuyAction identifies a buy exchange action.
	BuyAction ExchangeAction = "buy"
	// SellAction identifies a sell exchange action.
	SellAction ExchangeAction = "sell"
)

// ParseAction parses an action string and returns an ExchangeAction.
func ParseAction(action string) (ExchangeAction, error) {
	switch action {
	case "buy":
		return BuyAction, nil
	case "sell":
		return SellAction, nil
	default:
		return "", errp.New("Invalid Exchange action")
	}
}

// ExchangeRegionList contains a list of ExchangeRegion objects.
type ExchangeRegionList struct {
	Regions []ExchangeRegion `json:"regions"`
}

// ExchangeRegion contains the ISO 3166-1 alpha-2 code of a specific region and a boolean
// for each exchange, indicating if that exchange is enabled for the region.
type ExchangeRegion struct {
	Code               string `json:"code"`
	IsMoonpayEnabled   bool   `json:"isMoonpayEnabled"`
	IsPocketEnabled    bool   `json:"isPocketEnabled"`
	IsBtcDirectEnabled bool   `json:"isBtcDirectEnabled"`
}

// PaymentMethod type is used for payment options in exchange deals.
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

// ExchangeDeal represents a specific purchase option of an exchange.
type ExchangeDeal struct {
	// Fee that goes to the exchange in percentage.
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

// ExchangeDealsList list the name of a specific exchange and the list of available deals offered by that exchange.
type ExchangeDealsList struct {
	ExchangeName string          `json:"exchangeName"`
	Deals        []*ExchangeDeal `json:"deals"`
}

// ListExchangesByRegion populates an array of `ExchangeRegion` objects representing the availability
// of the various exchanges in each of them, for the provided account.
// For each region, an exchange is enabled if it supports the account coin and it is active in that region.
// NOTE: if one of the endpoint fails for any reason, the related exchange will be set as available in any
// region by default (for the supported coins).
func ListExchangesByRegion(account accounts.Interface, httpClient *http.Client) ExchangeRegionList {
	moonpayRegions, moonpayError := GetMoonpaySupportedRegions(httpClient)
	log := logging.Get().WithGroup("exchanges")
	if moonpayError != nil {
		log.Error(moonpayError)
	}

	pocketRegions, pocketError := GetPocketSupportedRegions(httpClient)
	if pocketError != nil {
		log.Error(pocketError)
	}

	btcDirectRegions := GetBtcDirectSupportedRegions()

	isMoonpaySupported := IsMoonpaySupported(account.Coin().Code())
	isPocketSupported := IsPocketSupported(account.Coin().Code())
	isBtcDirectSupported := IsBtcDirectSupported(account.Coin().Code())

	exchangeRegions := ExchangeRegionList{}
	for _, code := range RegionCodes {
		// default behavior is to show the exchange if the supported regions check fails.
		moonpayEnabled, pocketEnabled := true, true
		if moonpayError == nil {
			_, moonpayEnabled = moonpayRegions[code]
		}
		if pocketError == nil {
			_, pocketEnabled = pocketRegions[code]
		}
		btcDirectEnabled := slices.Contains(btcDirectRegions, code)

		exchangeRegions.Regions = append(exchangeRegions.Regions, ExchangeRegion{
			Code:               code,
			IsMoonpayEnabled:   moonpayEnabled && isMoonpaySupported,
			IsPocketEnabled:    pocketEnabled && isPocketSupported,
			IsBtcDirectEnabled: btcDirectEnabled && isBtcDirectSupported,
		})
	}

	return exchangeRegions
}

// GetExchangeDeals returns the exchange deals available for the specified account, region and action.
func GetExchangeDeals(account accounts.Interface, regionCode string, action ExchangeAction, httpClient *http.Client) ([]*ExchangeDealsList, error) {
	moonpaySupportsCoin := IsMoonpaySupported(account.Coin().Code()) && action == BuyAction
	pocketSupportsCoin := IsPocketSupported(account.Coin().Code())
	btcDirectSupportsCoin := IsBtcDirectSupported(account.Coin().Code()) && action == BuyAction
	coinSupported := moonpaySupportsCoin || pocketSupportsCoin || btcDirectSupportsCoin
	if !coinSupported {
		return nil, ErrCoinNotSupported
	}

	var userRegion *ExchangeRegion
	if len(regionCode) > 0 {
		exchangesByRegion := ListExchangesByRegion(account, httpClient)
		for _, region := range exchangesByRegion.Regions {
			if region.Code == regionCode {
				// to avoid exporting loop refs
				region := region
				userRegion = &region
				break
			}
		}
	}
	if userRegion == nil {
		userRegion = &ExchangeRegion{
			IsMoonpayEnabled:   true,
			IsPocketEnabled:    true,
			IsBtcDirectEnabled: true,
		}
	}

	exchangeDealsLists := []*ExchangeDealsList{}

	if pocketSupportsCoin && userRegion.IsPocketEnabled {
		deals := PocketDeals()
		if deals != nil {
			exchangeDealsLists = append(exchangeDealsLists, deals)
		}
	}
	if moonpaySupportsCoin && userRegion.IsMoonpayEnabled {
		deals := MoonpayDeals(action)
		if deals != nil {
			exchangeDealsLists = append(exchangeDealsLists, deals)
		}
	}
	if btcDirectSupportsCoin && userRegion.IsBtcDirectEnabled {
		deals := BtcDirectDeals()
		if deals != nil {
			exchangeDealsLists = append(exchangeDealsLists, deals)
		}
	}

	if len(exchangeDealsLists) == 0 {
		return nil, ErrRegionNotSupported
	}

	deals := []*ExchangeDeal{}
	for _, dealsList := range exchangeDealsLists {
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

	return exchangeDealsLists, nil
}
