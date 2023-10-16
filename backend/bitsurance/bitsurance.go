// Copyright 2023 Shift Crypto AG
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

package bitsurance

import (
	"crypto/sha256"
	"encoding/hex"
	"net/http"

	"github.com/digitalbitbox/bitbox-wallet-app/backend/accounts"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/accounts/types"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/signing"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/util"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
)

const (
	apiKey    = "265bfd773038c9ad9da7047e107babba0269bc3d31952172d9b10335e8a9d8e9"
	xpubSalt  = "bitsurance"
	apiURL    = "https://api.bitsurance.eu/api/"
	widgetURL = "https://api.bitsurance.eu/widget/"
)

const statusActive = "active"

type accountDetails struct {
	Status string `json:"status"`
}

// bitsuranceCheckId fetches the account details of the passed accountId from the
// Bitsurance server. It returns true if the account status is "active". Possible
// status are (from Bitsurance Api docs):
// - "processing"	when still in creation/checking phase (short time)
// - "refused" application got refused
// - "waitpayment" accepted, but waiting on first payment
// - "active" insurance coverage activated
// - "inactive" offer support link for more info (maybe missed payment)
// - "canceled" contract got canceled
//
// If an accountId is not retrieved at all, the endpoint return a 404 http code.
func bitsuranceCheckId(httpClient *http.Client, accountId string) (bool, error) {
	endpoint := apiURL + "accountDetails/" + accountId
	details := accountDetails{}
	code, err := util.APIGet(httpClient, endpoint, apiKey, 1024, &details)
	if err != nil && code != http.StatusNotFound {
		return false, err
	}
	if code == http.StatusNotFound {
		return false, nil
	}

	if details.Status == statusActive {
		return true, nil
	}
	return false, nil
}

// BitsuranceGetId returns the BitsuranceId of a given account.
// The id is computed hashing with sha256 the P2WPKH xpub of the account, concatenated with a fixed salt.
// If a P2WPKH xpub can't be found in the account, empty string is returned.
func BitsuranceGetId(account accounts.Interface) (string, error) {
	for _, signingConf := range account.Info().SigningConfigurations {
		bitcoinScriptType := signingConf.BitcoinSimple
		if bitcoinScriptType != nil && bitcoinScriptType.ScriptType == signing.ScriptTypeP2WPKH {
			hash := sha256.Sum256([]byte(bitcoinScriptType.KeyInfo.ExtendedPublicKey.String() + xpubSalt))
			return hex.EncodeToString(hash[:]), nil
		}
	}
	return "", errp.New("Unable to retrieve a bitsurance Id for the account: " + string(account.Config().Config.Code))

}

// BitsuranceURL returns the url for the Bitsurance widget for a given locale.
func BitsuranceURL(lang, bitsuranceId string) string {
	return widgetURL + lang + "/?id=" + bitsuranceId
}

// BitsuranceAccountsLookup takes in input a slice of accounts. It fetches the list of insured accounts from the
// Bitsurance server and returns a map with the given accounts' codes as keys and bool values which are `true` if
// the given account is found on the list, `false` otherwise.
func BitsuranceAccountsLookup(accounts []accounts.Interface, httpClient *http.Client) (map[types.Code]bool, error) {
	insuredAccountsMap := make(map[types.Code]bool)

	for _, account := range accounts {
		code := account.Config().Config.Code
		accountId, err := BitsuranceGetId(account)
		if err != nil {
			return nil, err
		}

		accountInsured, err := bitsuranceCheckId(httpClient, accountId)
		if err != nil {
			return nil, err
		}

		insuredAccountsMap[code] = accountInsured
	}

	return insuredAccountsMap, nil
}
