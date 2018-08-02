// Copyright 2018 Shift Devices AG
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

package btc

import (
	"github.com/btcsuite/btcutil"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
	"github.com/sirupsen/logrus"
)

// FeeTargetCode models the code of a fee target. See the constants below.
type FeeTargetCode string

// NewFeeTargetCode checks if the code is valid and returns a FeeTargetCode in that case.
func NewFeeTargetCode(code string, log *logrus.Entry) (FeeTargetCode, error) {
	switch code {
	case string(FeeTargetCodeLow):
	case string(FeeTargetCodeEconomy):
	case string(FeeTargetCodeNormal):
	case string(FeeTargetCodeHigh):
	default:
		return "", errp.WithStack(errp.Newf("Unrecognized fee target code %s", code))
	}
	return FeeTargetCode(code), nil
}

const (
	// FeeTargetCodeLow is the low priority fee target.
	FeeTargetCodeLow FeeTargetCode = "low"

	// FeeTargetCodeEconomy is the economy priority fee target.
	FeeTargetCodeEconomy FeeTargetCode = "economy"

	// FeeTargetCodeNormal is the normal priority fee target.
	FeeTargetCodeNormal FeeTargetCode = "normal"

	// FeeTargetCodeHigh is the high priority fee target.
	FeeTargetCodeHigh FeeTargetCode = "high"

	defaultFeeTarget = FeeTargetCodeNormal
)

// FeeTarget contains the fee rate for a specific fee target.
type FeeTarget struct {
	// Blocks is the target number of blocks in which the transaction should be confirmed.
	Blocks int

	// Code is the identifier for the UI.
	Code FeeTargetCode

	// FeeRatePerKb is the fee rate needed for this target. Can be nil until populated.
	FeeRatePerKb *btcutil.Amount
}
