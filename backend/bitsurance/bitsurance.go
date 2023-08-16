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
	"io"
	"net/http"
	"sort"
	"strings"

	"github.com/digitalbitbox/bitbox-wallet-app/backend/accounts"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/accounts/types"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/signing"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
)

const (
	apiKey    = "265bfd773038c9ad9da7047e107babba0269bc3d31952172d9b10335e8a9d8e9"
	xpubSalt  = "bitsurance"
	apiURL    = "https://api.bitsurance.eu/api/"
	widgetURL = "https://api.bitsurance.eu/widget/"
)

// fetchBitsuranceIds fetches the list of insured account hashes from the Bitsurance
// server. The result is returned as a slice of strings, with each element containing
// the IDs of the insured accounts, in lexical order. (0-9a-z).
// For details on the hashing please refer to `BitsuranceGetId`.
func fetchBitsuranceIds(httpClient *http.Client) ([]string, error) {
	endpoint := apiURL + "allAccountHashes"
	req, err := http.NewRequest(http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, errp.WithStack(err)
	}
	req.Header.Add("X-API-KEY", apiKey)

	res, err := httpClient.Do(req)
	if err != nil {
		return nil, errp.WithStack(err)
	}
	defer res.Body.Close() //nolint:errcheck
	if res.StatusCode != http.StatusOK {
		return nil, errp.Newf("%s - bad response code %d", endpoint, res.StatusCode)
	}
	const max = 81920
	responseBody, err := io.ReadAll(io.LimitReader(res.Body, max+1))
	if err != nil {
		return nil, errp.WithStack(err)
	}
	return strings.Split(string(responseBody), "\n"), nil
}

// findInsuredAccounts compares `accountIds` and `insuredIds` and returns a slice
// with the matching elements.
//
// `accountIds` is an ordered slice of strings, containing the hashes of the
// requested wallet accounts xpubs
// `insuredIds` is another ordered slice of strings, containing the hashes of
// all the insured xpubs retrieved from the Bitsurance server.
//
// The complexity of the scanning is linear.
// For details on the hashing please refer to `BitsuranceGetId`.
// TODO add tests.
func findInsuredAccounts(accountIds, insuredIds []string) []string {
	var matching []string

	// Initialize indices for both lists
	i, j := 0, 0

	// Traverse both lists while there are elements in both
	for i < len(accountIds) && j < len(insuredIds) {
		// Compare the current elements in both lists
		switch {
		case accountIds[i] == insuredIds[j]:
			// If the elements match, add it to the matching slice
			matching = append(matching, accountIds[i])
			i++
			j++
		case accountIds[i] < insuredIds[j]:
			// If the element in accountIds is smaller, move to the next element
			i++
		default:
			// If the element in insuredIds is smaller, move to the next element
			j++
		}
	}

	return matching
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
	idCodeMap := make(map[string]types.Code)
	var accountIds []string

	bitsuranceIds, err := fetchBitsuranceIds(httpClient)
	if err != nil {
		return nil, err
	}

	for _, account := range accounts {
		code := account.Config().Config.Code
		accountId, err := BitsuranceGetId(account)
		if err != nil {
			return nil, err
		}

		idCodeMap[accountId] = code
		accountIds = append(accountIds, accountId)
		insuredAccountsMap[code] = false
	}

	sort.Strings(accountIds)
	// should be already sorted, but better to waste a bit more time and avoid mismatches.
	sort.Strings(bitsuranceIds)

	insuredAccountsIds := findInsuredAccounts(accountIds, bitsuranceIds)
	for _, id := range insuredAccountsIds {
		insuredAccountsMap[idCodeMap[id]] = true
	}

	return insuredAccountsMap, nil
}
