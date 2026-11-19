// SPDX-License-Identifier: Apache-2.0

package types

import "fmt"

// Code is a globally unique account code. It is used for example as a name in databases (e.g. cache
// database, transaction notes database, etc).
type Code string

// The functions here must all produce globally unique account codes. They are used as names in
// account-related databases (e.g. transaction notes). Changing the codes invalidates these
// databases.
//
// There are different types of account codes:
// - regular: for unified accounts
// - erc20: for ERC20 token accounts

// RegularAccountCode returns an account code based on a keystore root fingerprint, a coin code and
// an account number.
func RegularAccountCode(rootFingerprint []byte, coinCode string, accountNumber uint16) Code {
	return Code(fmt.Sprintf("v0-%x-%s-%d", rootFingerprint, coinCode, accountNumber))
}

// Erc20AccountCode returns the account code used for an ERC20 token.
// It is derived from the account code of the parent ETH account and the token code.
// The format must remain stable because account codes identify persisted account data.
func Erc20AccountCode(ethereumAccountCode Code, tokenCode string) Code {
	return Code(fmt.Sprintf("%s-%s", ethereumAccountCode, tokenCode))
}
