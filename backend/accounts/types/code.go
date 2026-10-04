// SPDX-License-Identifier: Apache-2.0

package types

import "fmt"

// Code is a globally unique account code. It is used for example as a name in databases (e.g. cache
// database, transaction notes database, etc).
type Code string

// Erc20AccountCode returns the account code used for an ERC20 token.
// It is derived from the account code of the parent ETH account and the token code.
// The format must remain stable because account codes identify persisted account data.
func Erc20AccountCode(ethereumAccountCode Code, tokenCode string) Code {
	return Code(fmt.Sprintf("%s-%s", ethereumAccountCode, tokenCode))
}
