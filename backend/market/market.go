// SPDX-License-Identifier: Apache-2.0

package market

import (
	"net/http"
	"slices"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
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

// Action identifies buy, sell, spend, swap or otc actions.
type Action string

const (
	// BuyAction identifies a buy market action.
	BuyAction Action = "buy"
	// SellAction identifies a sell market action.
	SellAction Action = "sell"
	// SpendAction identifies a spend market action.
	SpendAction Action = "spend"
	// SwapAction identifies a swap market action.
	SwapAction Action = "swap"
	// OtcAction identifies an OTC market action.
	OtcAction Action = "otc"
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
	case "swap":
		return SwapAction, nil
	case "otc":
		return OtcAction, nil
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

// PaymentMethod type is used for payment options in market offers.
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

// FeeModel describes how vendor fees are represented for services.
type FeeModel string

const (
	// FeeModelNone means no explicit vendor fee is exposed.
	FeeModelNone FeeModel = "none"
	// FeeModelDynamic means fees are resolved dynamically at quote/runtime.
	FeeModelDynamic FeeModel = "dynamic"
	// FeeModelRange means fees are represented as a min/max percentage range.
	FeeModelRange FeeModel = "range"
)

// Offer represents a specific priced option for buy/sell actions.
type Offer struct {
	Fee      float32       `json:"fee"`
	Payment  PaymentMethod `json:"payment,omitempty"`
	IsFast   bool          `json:"isFast,omitempty"`
	IsBest   bool          `json:"isBest,omitempty"`
	IsHidden bool          `json:"isHidden,omitempty"`
}

// OfferVendor groups buy/sell offers by vendor.
type OfferVendor struct {
	VendorName string   `json:"vendorName"`
	Offers     []*Offer `json:"offers"`
}

// FeeRange describes a percentage fee interval.
type FeeRange struct {
	MinPercent float32 `json:"minPercent"`
	MaxPercent float32 `json:"maxPercent"`
}

// MinTradeAmount describes the minimum order size for a service.
type MinTradeAmount struct {
	Amount   string `json:"amount"`
	Currency string `json:"currency"`
}

// Service represents a market service capability for spend/otc/swap actions.
type Service struct {
	VendorName     string          `json:"vendorName"`
	FeeModel       FeeModel        `json:"feeModel"`
	FeeRange       *FeeRange       `json:"feeRange,omitempty"`
	MinTradeAmount *MinTradeAmount `json:"minTradeAmount,omitempty"`
}

// ActionSection represents one action tab in the market catalog.
type ActionSection struct {
	Success      bool           `json:"success"`
	ErrorCode    string         `json:"errorCode,omitempty"`
	OfferVendors []*OfferVendor `json:"offerVendors,omitempty"`
	Services     []*Service     `json:"services,omitempty"`
}

// Catalog contains all market actions in one payload.
type Catalog struct {
	Buy   ActionSection `json:"buy"`
	Sell  ActionSection `json:"sell"`
	Spend ActionSection `json:"spend"`
	Swap  ActionSection `json:"swap"`
	Otc   ActionSection `json:"otc"`
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

func resolveUserRegion(account accounts.Interface, regionCode string, httpClient *http.Client) Region {
	userRegion := Region{
		IsMoonpayEnabled:   true,
		IsPocketEnabled:    true,
		IsBtcDirectEnabled: true,
		IsBitrefillEnabled: true,
	}
	if len(regionCode) == 0 {
		return userRegion
	}

	vendorsByRegion := ListVendorsByRegion(account, httpClient)
	for _, region := range vendorsByRegion.Regions {
		if region.Code == regionCode {
			userRegion = region
			break
		}
	}
	return userRegion
}

// GetCatalog returns all market actions grouped by type for the specified account and region.
func GetCatalog(account accounts.Interface, regionCode string, httpClient *http.Client) *Catalog {
	coinCode := account.Coin().Code()
	userRegion := resolveUserRegion(account, regionCode, httpClient)

	return &Catalog{
		Buy:   buySection(coinCode, userRegion),
		Sell:  sellSection(coinCode, userRegion),
		Spend: spendSection(coinCode, userRegion),
		Swap:  swapSection(coinCode),
		Otc:   otcSection(coinCode, regionCode),
	}
}

func buySection(coinCode coin.Code, userRegion Region) ActionSection {
	moonpaySupportsCoin := IsMoonpaySupported(coinCode)
	pocketSupportsCoin := IsPocketSupported(coinCode)
	btcDirectSupportsCoin := IsBtcDirectSupported(coinCode)
	coinSupported := moonpaySupportsCoin || pocketSupportsCoin || btcDirectSupportsCoin
	if !coinSupported {
		return ActionSection{Success: false, ErrorCode: ErrCoinNotSupported.Error()}
	}

	section := ActionSection{Success: true}
	if pocketSupportsCoin && userRegion.IsPocketEnabled {
		section.OfferVendors = append(section.OfferVendors, PocketBuyOffers())
	}
	if moonpaySupportsCoin && userRegion.IsMoonpayEnabled {
		section.OfferVendors = append(section.OfferVendors, MoonpayBuyOffers())
	}
	if btcDirectSupportsCoin && userRegion.IsBtcDirectEnabled {
		section.OfferVendors = append(section.OfferVendors, BtcDirectBuyOffers())
	}

	if len(section.OfferVendors) == 0 {
		return ActionSection{Success: false, ErrorCode: ErrRegionNotSupported.Error()}
	}

	assignBestOffer(section.OfferVendors)
	return section
}

func sellSection(coinCode coin.Code, userRegion Region) ActionSection {
	pocketSupportsCoin := IsPocketSupported(coinCode)
	btcDirectSupportsCoin := IsBtcDirectSupported(coinCode)
	coinSupported := pocketSupportsCoin || btcDirectSupportsCoin
	if !coinSupported {
		return ActionSection{Success: false, ErrorCode: ErrCoinNotSupported.Error()}
	}

	section := ActionSection{Success: true}
	if pocketSupportsCoin && userRegion.IsPocketEnabled {
		section.OfferVendors = append(section.OfferVendors, PocketSellOffers())
	}
	if btcDirectSupportsCoin && userRegion.IsBtcDirectEnabled {
		section.OfferVendors = append(section.OfferVendors, BtcDirectSellOffers())
	}

	if len(section.OfferVendors) == 0 {
		return ActionSection{Success: false, ErrorCode: ErrRegionNotSupported.Error()}
	}

	assignBestOffer(section.OfferVendors)
	return section
}

func spendSection(coinCode coin.Code, userRegion Region) ActionSection {
	if !IsBitrefillSupported(coinCode) {
		return ActionSection{Success: false, ErrorCode: ErrCoinNotSupported.Error()}
	}
	if !userRegion.IsBitrefillEnabled {
		return ActionSection{Success: false, ErrorCode: ErrRegionNotSupported.Error()}
	}

	return ActionSection{
		Success:  true,
		Services: []*Service{BitrefillSpendService()},
	}
}

func otcSection(coinCode coin.Code, regionCode string) ActionSection {
	if !IsBtcDirectSupported(coinCode) {
		return ActionSection{Success: false, ErrorCode: ErrCoinNotSupported.Error()}
	}
	if !IsBtcDirectOTCSupportedForCoinInRegion(coinCode, regionCode) {
		return ActionSection{Success: false, ErrorCode: ErrRegionNotSupported.Error()}
	}

	return ActionSection{
		Success:  true,
		Services: []*Service{BtcDirectOTCService()},
	}
}

func swapSection(coinCode coin.Code) ActionSection {
	if !IsSwapKitSupported(coinCode) {
		return ActionSection{Success: false, ErrorCode: ErrCoinNotSupported.Error()}
	}

	return ActionSection{
		Success:  true,
		Services: []*Service{SwapKitService()},
	}
}

func assignBestOffer(vendors []*OfferVendor) {
	type indexedOffer struct {
		offer *Offer
	}

	offers := []indexedOffer{}
	for _, vendor := range vendors {
		for _, offer := range vendor.Offers {
			offers = append(offers, indexedOffer{offer: offer})
		}
	}

	if len(offers) <= 1 {
		return
	}

	bestIdx := 0
	for i, indexed := range offers {
		oldBest := offers[bestIdx].offer
		if !indexed.offer.IsHidden && indexed.offer.Fee < oldBest.Fee {
			bestIdx = i
		}
	}
	offers[bestIdx].offer.IsBest = true
}
