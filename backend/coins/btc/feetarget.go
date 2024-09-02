// Copyright 2018 Shift Devices AG
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

package btc

import (
	"fmt"
	"strings"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	"github.com/btcsuite/btcd/btcutil"
)

// FeeTarget contains the fee rate for a specific fee target.
type FeeTarget struct {
	// Blocks is the target number of blocks in which the transaction should be confirmed.
	blocks int

	// Code is the identifier for the UI.
	code accounts.FeeTargetCode

	// FeeRatePerKb is the fee rate needed for this target. Can be nil until populated.
	feeRatePerKb *btcutil.Amount
}

// Code returns the btc fee target.
func (feeTarget *FeeTarget) Code() accounts.FeeTargetCode {
	return feeTarget.code
}

// FormattedFeeRate returns a string showing the fee rate.
func (feeTarget *FeeTarget) FormattedFeeRate() string {
	if feeTarget.feeRatePerKb == nil {
		return ""
	}
	feePerByte := fmt.Sprintf("%.03f", float64(*feeTarget.feeRatePerKb)/1000.0)
	// Truncate trailing zeroes, and final '.' if the number has no decimal places.
	feePerByte = strings.TrimRight(strings.TrimRight(feePerByte, "0"), ".")
	return feePerByte + " sat/vB"
}

// FeeTargets represents an array of FeeTarget pointers.
type FeeTargets []*FeeTarget

// highest returns the feeTarget with the highest fee.
func (feeTargets FeeTargets) highest() *FeeTarget {
	var highestFeeTarget *FeeTarget
	for _, feeTarget := range feeTargets {
		if feeTarget == nil || feeTarget.feeRatePerKb == nil {
			continue
		}

		if highestFeeTarget == nil || *feeTarget.feeRatePerKb > *highestFeeTarget.feeRatePerKb {
			highestFeeTarget = feeTarget
		}
	}
	return highestFeeTarget
}
