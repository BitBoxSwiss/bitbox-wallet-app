// SPDX-License-Identifier: Apache-2.0

package bitsurance

import (
	"crypto/sha256"
	"encoding/hex"
	"math/big"
	"net/http"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/types"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/rates"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/signing"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/util"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
)

const (
	apiKey        = "cv9K9SXaMGMy26ThA3sqVetROkhRSPLU"
	apiURL        = "https://api.bitsurance.io/api/"
	testApiURL    = "https://api.bs-test.de/api/"
	widgetVersion = "1"
	widgetURL     = "https://get.bitsurance.io/?wallet=bitbox&version=" + widgetVersion + "&lang="
	widgetTestURL = "https://get.bs-test.de/?wallet=bitbox&version=" + widgetVersion + "&lang="
	xpubSalt      = "bitsurance"
)

// DetailStatus is the status of the insurance contract.
// Possible values (from Bitsurance Api docs) are listed below.
type DetailStatus string

const (
	// ActiveStatus - insurance coverage activated.
	ActiveStatus DetailStatus = "active"
	// ProcessingStatus -	when still in creation/checking phase (short time).
	ProcessingStatus DetailStatus = "processing"
	// RefusedStatus - application got refused.
	RefusedStatus DetailStatus = "refused"
	// WaitPaymentStatus - accepted, but waiting on first payment.
	WaitPaymentStatus DetailStatus = "waitpayment"
	// InactiveStatus - offer support link for more info (maybe missed payment).
	InactiveStatus DetailStatus = "inactive"
	// CanceledStatus - contract got canceled.
	CanceledStatus DetailStatus = "canceled"
)

// AccountDetails represents the response of the bitsurance server
// for a single account.
type AccountDetails struct {
	AccountCode types.Code   `json:"code"`
	Status      DetailStatus `json:"status"`
	Details     struct {
		MaxCoverage          int    `json:"maxCoverage"`
		MaxCoverageFormatted string `json:"maxCoverageFormatted"`
		Currency             string `json:"currency"`
		// Support contains a link to the bitsurance support page relevant for the account
		Support string `json:"support"`
	} `json:"details"`
}

// bitsuranceCheckId fetches and returns the account details of the passed accountId from the
// Bitsurance server.
// If an accountId is not retrieved at all, the endpoint return a 404 http code.
func bitsuranceCheckId(devServer bool, httpClient *http.Client, accountId string) (AccountDetails, error) {
	url := apiURL
	if devServer {
		url = testApiURL
	}
	endpoint := url + "accountDetails/" + accountId
	account := AccountDetails{}
	code, err := util.APIGet(httpClient, endpoint, apiKey, 1024, &account)
	if err != nil && code != http.StatusNotFound {
		return account, err
	}
	ratAmount := new(big.Rat).SetInt64(int64(account.Details.MaxCoverage))
	account.Details.MaxCoverageFormatted = coin.FormatAsCurrency(ratAmount, rates.EUR.String())
	return account, nil
}

// GetBitsuranceId returns the BitsuranceId of a given account.
// The id is computed hashing with sha256 the P2WPKH xpub of the account, concatenated with a fixed salt.
// If a P2WPKH xpub can't be found in the account, empty string is returned.
func GetBitsuranceId(account accounts.Interface) (string, error) {
	for _, signingConf := range account.Info().SigningConfigurations {
		bitcoinScriptType := signingConf.BitcoinSimple
		if bitcoinScriptType != nil && bitcoinScriptType.ScriptType == signing.ScriptTypeP2WPKH {
			hash := sha256.Sum256([]byte(bitcoinScriptType.KeyInfo.ExtendedPublicKey.String() + xpubSalt))
			return hex.EncodeToString(hash[:]), nil
		}
	}
	return "", errp.New("Unable to retrieve a bitsurance Id for the account: " + string(account.Config().Config.Code))

}

// WidgetURL returns the url for the Bitsurance widget for a given locale.
func WidgetURL(devServer bool, lang string) string {
	if devServer {
		return widgetTestURL + lang
	}
	return widgetURL + lang
}

// LookupBitsuranceAccounts takes in input a slice of accounts. For each account, it interrogates the
// Bitsurance server and returns a map with the given accounts' codes as keys and the insurance details as value.
func LookupBitsuranceAccounts(devServer bool, accounts []accounts.Interface, httpClient *http.Client) ([]AccountDetails, error) {
	insuredAccounts := []AccountDetails{}

	for _, account := range accounts {
		bitsuranceId, err := GetBitsuranceId(account)
		if err != nil {
			return nil, err
		}

		bitsuranceAccount, err := bitsuranceCheckId(devServer, httpClient, bitsuranceId)
		if err != nil {
			return nil, err
		}

		if len(bitsuranceAccount.Status) > 0 {
			bitsuranceAccount.AccountCode = account.Config().Config.Code
			insuredAccounts = append(insuredAccounts, bitsuranceAccount)
		}
	}

	return insuredAccounts, nil
}
