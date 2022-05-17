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

package accounts

import (
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
)

// FeeTarget interface has priority codes.
// Coin specific methods are implemented in corresponding coins.
type FeeTarget interface {
	Code() FeeTargetCode
	// FormattedFeeRate returns a formatted fee rate to display in the UI.
	FormattedFeeRate() string
}

// FeeTargetCode models the code of a fee target. See the constants below.
type FeeTargetCode string

// NewFeeTargetCode checks if the code is valid and returns a FeeTargetCode in that case.
func NewFeeTargetCode(code string) (FeeTargetCode, error) {
	switch code {
	case "":
		return DefaultFeeTarget, nil
	case string(FeeTargetCodeLow):
	case string(FeeTargetCodeEconomy):
	case string(FeeTargetCodeNormal):
	case string(FeeTargetCodeHigh):
	case string(FeeTargetCodeCustom):
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

	// FeeTargetCodeCustom means that the actual feerate is supplied separately instead of being
	// estimated automatically.
	FeeTargetCodeCustom FeeTargetCode = "custom"

	// DefaultFeeTarget is the default fee target.
	DefaultFeeTarget = FeeTargetCodeNormal
)
