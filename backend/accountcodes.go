// SPDX-License-Identifier: Apache-2.0

package backend

import accountsTypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/types"

// Erc20AccountCode returns the account code used for an ERC20 token.
// It is derived from the account code of the parent ETH account and the token code.
func Erc20AccountCode(ethereumAccountCode accountsTypes.Code, tokenCode string) accountsTypes.Code {
	return accountsTypes.Erc20AccountCode(ethereumAccountCode, tokenCode)
}
