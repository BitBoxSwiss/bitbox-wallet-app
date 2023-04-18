// Copyright 2021 Shift Crypto AG
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

package backend

import (
	"fmt"

	accountsTypes "github.com/digitalbitbox/bitbox-wallet-app/backend/accounts/types"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/coin"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/signing"
)

// The functions here must all produce globally unique account codes. They are used as names in
// account-related databases (e.g. transaction notes). Changing the codes invalidates these
// databases.
//
// There are different types of account codes:
// - regular: for unified accounts
// - split: for the individual accounts split from a unified account, if the keystore does not support unified accounts, such as the BitBox01.
// - erc20: for ERC20 token accounts

// regularAccountCode returns an account code based on a keystore root fingerprint, a coin code and
// an account number.
func regularAccountCode(rootFingerprint []byte, coinCode coin.Code, accountNumber uint16) accountsTypes.Code {
	return accountsTypes.Code(fmt.Sprintf("v0-%x-%s-%d", rootFingerprint, coinCode, accountNumber))
}

// splitAccountCode returns an account code for split accounts, made by exploding a unified account
// into one account per signing configuration. This only applies to BTC/LTC.
func splitAccountCode(parentCode accountsTypes.Code, scriptType signing.ScriptType) accountsTypes.Code {
	return accountsTypes.Code(fmt.Sprintf("%s-%s", parentCode, scriptType))
}

// Erc20AccountCode returns the account code used for an ERC20 token.
// It is derived from the account code of the parent ETH account and the token code.
func Erc20AccountCode(ethereumAccountCode accountsTypes.Code, tokenCode string) accountsTypes.Code {
	return accountsTypes.Code(fmt.Sprintf("%s-%s", ethereumAccountCode, tokenCode))
}
