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
	"encoding/base64"
	"fmt"
	"net/http"

	"github.com/digitalbitbox/bitbox-wallet-app/backend/accounts"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/coin"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/signing"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
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

	// PocketName is the name of the exchange, it is unique among all the supported exchanges.
	PocketName = "pocket"
)

// requestAddressScriptTypeMap maps from format codes specified by request-address js library
// to our own script type codes. See https://www.npmjs.com/package/request-address
var requestAddressScriptTypeMap = map[string]signing.ScriptType{
	"p2pkh":  signing.ScriptTypeP2PKH,
	"p2wpkh": signing.ScriptTypeP2WPKH,
	"p2sh":   signing.ScriptTypeP2WPKHP2SH,
	"p2tr":   signing.ScriptTypeP2TR,
}

// defaultScriptType is the default type used for address sharing and verification, if the
// `format` param is not defined.
var defaultScriptType = "p2wpkh"

// PocketRegion represents informations collected by Pocket supported countries REST call.
type PocketRegion struct {
	Code    string `json:"code"`
	Country string `json:"country"`
}

// PocketURL returns the url needed to incorporate the widget in the frontend, verifying
// if the `devservers` argument is enabled.
func PocketURL(devServers bool, locale string) string {
	if devServers {
		return pocketMainTestURL + "/" + locale + "/" + pocketWidgetTest
	}
	return pocketMainLiveURL + "/" + locale + "/" + pocketWidgetLive
}

// IsPocketSupported is true if coin.Code is supported by Pocket.
func IsPocketSupported(account accounts.Interface) bool {
	coinCode := account.Coin().Code()
	canSign := account.Config().Keystore.CanSignMessage(coinCode)
	// Pocket would also support tbtc, but at the moment testnet address signing is disabled on firmware.
	return (coinCode == coin.CodeBTC || coinCode == coin.CodeTBTC) && canSign
}

// PocketDeals returns the purchase conditions (fee and payment methods) offered by Pocket.
func PocketDeals() ExchangeDeals {
	return ExchangeDeals{
		ExchangeName: PocketName,
		Deals: []ExchangeDeal{
			{
				Fee:     0.015, //1.5%
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

	err := APIGet(httpClient, endpoint, &regionsList)
	if err != nil {
		return nil, err
	}

	for _, region := range regionsList {
		regionsMap[region.Code] = region
	}

	return regionsMap, nil
}

// PocketWidgetSignAddress returns an unused address and makes the user sign a message to prove ownership.
// Input params:
//
//	`account` is the account from which the address is derived, and that will be linked to the Pocket order.
//	`message` is the message that will be signed by the user with the private key linked to the address.
//	`format` is the script type that should be used in the address derivation, as received by the widget
//		(see https://github.com/pocketbitcoin/request-address#requestaddressv0messagescripttype).
//		If format is empty, native segwit type is used as a fallback.
//
// Returned values:
//
//	#1: is the first unused address corresponding to the account and the script type identified by the input values.
//	#2: base64 encoding of the message signature, obtained using the private key linked to the address.
//	#3: is an optional error that could be generated during the execution of the function.
func PocketWidgetSignAddress(account accounts.Interface, message string, format string) (string, string, error) {

	if !IsPocketSupported(account) {
		err := fmt.Errorf("Coin not supported %s", account.Coin().Code())
		return "", "", err
	}

	unused := account.GetUnusedReceiveAddresses()
	// Use the format hint to get a compatible address
	if len(format) == 0 {
		format = defaultScriptType
	}
	expectedScriptType, ok := requestAddressScriptTypeMap[format]
	if !ok {
		err := fmt.Errorf("Unknown format:  %s", format)
		return "", "", err
	}
	signingConfigIdx := account.Config().Config.Configurations.FindScriptType(expectedScriptType)
	if signingConfigIdx == -1 {
		err := fmt.Errorf("Unknown format: %s", format)
		return "", "", err
	}
	addr := unused[signingConfigIdx].Addresses[0]

	sig, err := account.Config().Keystore.SignBTCMessage(
		[]byte(message),
		addr.AbsoluteKeypath(),
		account.Config().Config.Configurations[signingConfigIdx].ScriptType(),
	)
	if err != nil {
		return "", "", err
	}

	return addr.EncodeForHumans(), base64.StdEncoding.EncodeToString(sig), nil
}

// PocketWidgetVerifyAddress allows the user to verify an address for the Pocket Iframe workflow.
// Input params:
//
//	`account` is the account from which the address is derived, and that will be linked to the Pocket order.
//	`address` is the address to be verified. It should be the same address previously returned by
//		`PocketWidgetSignAddress`. Since this should be the first unused address, this function ranges
//		among them to retrieve the ID needed for the verification.
func PocketWidgetVerifyAddress(account accounts.Interface, address string) error {
	if !IsPocketSupported(account) {
		return fmt.Errorf("Coin not supported %s", account.Coin().Code())
	}

	addressLists := account.GetUnusedReceiveAddresses()
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
	return errp.WithStack(ErrAddressNotFound)
}
