// SPDX-License-Identifier: Apache-2.0

package backend

import (
	"fmt"

	accountsTypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/types"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
)

// The functions here must all produce globally unique account codes. They are used as names in
// account-related databases (e.g. transaction notes). Changing the codes invalidates these
// databases.
//
// There are different types of account codes:
// - regular: for unified accounts
// - erc20: for ERC20 token accounts

// regularAccountCode returns an account code based on a keystore root fingerprint, a coin code and
// an account number.
func regularAccountCode(rootFingerprint []byte, coinCode coin.Code, accountNumber uint16) accountsTypes.Code {
	return accountsTypes.Code(fmt.Sprintf("v0-%x-%s-%d", rootFingerprint, coinCode, accountNumber))
}

// Erc20AccountCode returns the account code used for an ERC20 token.
// It is derived from the account code of the parent ETH account and the token code.
func Erc20AccountCode(ethereumAccountCode accountsTypes.Code, tokenCode string) accountsTypes.Code {
	return accountsTypes.Code(fmt.Sprintf("%s-%s", ethereumAccountCode, tokenCode))
}
