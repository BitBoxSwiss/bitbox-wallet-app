// SPDX-License-Identifier: Apache-2.0

package market

import (
	"fmt"
	"net/http"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/util"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
)

const (
	// ErrAddressNotFound is returned if an address provided for verification is not in the list of unused addresses.
	errAddressNotFound errp.ErrorCode = "addressNotFound"
)

const (
	// pocketMainTestURL is the url of the pocket test environment.
	pocketMainTestURL = "https://widget.staging.pocketbitcoin.com"

	// pocketWidgetTest is the url of the pocket widget in test environment.
	pocketWidgetTest = "widget_mjxWDmSUkMvdQdXDCeHrjC"

	// pocketMainLiceURL is the url of the pocket production environment.
	pocketMainLiveURL = "https://widget.pocketbitcoin.com"

	// pocketWidgetLive is the url of the pocket widget in production environment.
	pocketWidgetLive = "widget_vqx25E6kzvGBYGjN2QoXVH"

	// pocketAPILiveURL is the base url of pocket API in production environment.
	pocketAPILiveURL = "https://widget.pocketbitcoin.com/api"

	// PocketName is the name of the vendor, it is unique among all the supported vendors.
	PocketName = "pocket"
)

// PocketRegion represents informations collected by Pocket supported countries REST call.
type PocketRegion struct {
	Code    string `json:"code"`
	Country string `json:"country"`
}

// PocketURL returns the url needed to incorporate the widget in the frontend, verifying
// if the `devservers` argument is enabled.
func PocketURL(devServers bool, locale string, action Action) string {
	sellPath := ""
	if action == SellAction {
		sellPath = "/sell"
	}

	if devServers {
		return pocketMainTestURL + "/" + locale + "/" + pocketWidgetTest + sellPath
	}
	return pocketMainLiveURL + "/" + locale + "/" + pocketWidgetLive + sellPath
}

// IsPocketSupported is true if coin.Code is supported by Pocket.
func IsPocketSupported(coinCode coin.Code) bool {
	// Pocket would also support tbtc, but at the moment testnet address signing is disabled on the
	// BitBox02 firmware.
	return coinCode == coin.CodeBTC || coinCode == coin.CodeTBTC
}

// PocketDeals returns the purchase conditions (fee and payment methods) offered by Pocket.
func PocketDeals() *DealsList {
	// deals details are the same for both buy and sell. In the future we may need to use
	// an action parameter to give different results.
	return &DealsList{
		VendorName: PocketName,
		Deals: []*Deal{
			{
				Fee:     1.5, // 1.5%
				Payment: BankTransferPayment,
				IsFast:  false,
			},
		},
	}
}

// GetPocketSupportedRegions query pocket API and returns a map of available regions.
func GetPocketSupportedRegions(httpClient *http.Client) (map[string]PocketRegion, error) {
	regionsMap := make(map[string]PocketRegion)
	var regionsList []PocketRegion
	endpoint := fmt.Sprintf("%s/availabilities", pocketAPILiveURL)

	_, err := util.APIGet(httpClient, endpoint, "", 1000000, &regionsList)
	if err != nil {
		return nil, err
	}

	for _, region := range regionsList {
		regionsMap[region.Code] = region
	}

	return regionsMap, nil
}

// PocketWidgetVerifyAddress allows the user to verify an address for the Pocket Iframe workflow.
// Input params:
//
//	`account` is the account from which the address is derived, and that will be linked to the Pocket order.
//	`address` is the address to be verified. It should be the same address previously returned by
//		`PocketWidgetSignAddress`. Since this should be the first unused address, this function ranges
//		among them to retrieve the ID needed for the verification.
func PocketWidgetVerifyAddress(account accounts.Interface, address string) error {
	if !IsPocketSupported(account.Coin().Code()) {
		return fmt.Errorf("coin not supported %s", account.Coin().Code())
	}

	addressLists, err := account.GetUnusedReceiveAddresses()
	if err != nil {
		return err
	}
	// iterate over the available script types to find the correct address
	for _, list := range addressLists {
		for _, addr := range list.Addresses {
			if addr.EncodeForHumans() == address {
				_, err := account.VerifyAddress(addr.ID())
				if err != nil {
					return err
				}
				return nil
			}
		}
	}
	// If this happens the address provided by pocket is not in the list of unused addresses.
	// Reason could be that it has been used between the message signing and the verification.
	return errp.WithStack(errAddressNotFound)
}
