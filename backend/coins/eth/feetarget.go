// Copyright 2021 Shift Crypto AG
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
//
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package eth

import (
	"math/big"
	"strings"

	"github.com/digitalbitbox/bitbox-wallet-app/backend/accounts"
)

// feeTarget contains the gas price for a specific fee target.
type feeTarget struct {
	// Code is the identifier for the UI.
	code accounts.FeeTargetCode
	// gasPrice is the estimated gas price to be used in the fee calculation, in Wei.
	gasPrice *big.Int
}

// Code returns the btc fee target.
func (f *feeTarget) Code() accounts.FeeTargetCode {
	return f.code
}

// FormattedFeeRate returns a string showing the fee rate.
func (f *feeTarget) FormattedFeeRate() string {
	if f.gasPrice == nil {
		return ""
	}
	factor := big.NewInt(1e9)
	s := new(big.Rat).SetFrac(f.gasPrice, factor).FloatString(9)
	return strings.TrimRight(strings.TrimRight(s, "0"), ".") + " Gwei"
}
