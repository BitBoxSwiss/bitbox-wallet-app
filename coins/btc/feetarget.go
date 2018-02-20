package btc

import (
	"github.com/btcsuite/btcutil"
	"github.com/shiftdevices/godbb/util/errp"
)

// FeeTargetCode is the ID of a fee target. See the FeeTargetCode* constants.x
type FeeTargetCode string

// NewFeeTargetCode checks if the code is valid and returns a FeeTargetCode in that case.
func NewFeeTargetCode(code string) (FeeTargetCode, error) {
	switch code {
	case string(FeeTargetCodeLow):
	case string(FeeTargetCodeEconomy):
	case string(FeeTargetCodeNormal):
	case string(FeeTargetCodeHigh):
	default:
		return "", errp.Newf("unrecognized fee code %s", code)
	}
	return FeeTargetCode(code), nil
}

const (
	// FeeTargetCodeLow is the low priority fee target.
	FeeTargetCodeLow FeeTargetCode = "low"
	// FeeTargetCodeEconomy is the economy priority fee target.
	FeeTargetCodeEconomy = "economy"
	// FeeTargetCodeNormal is the normal priority fee target.
	FeeTargetCodeNormal = "normal"
	// FeeTargetCodeHigh is the high priority fee target.
	FeeTargetCodeHigh = "high"

	defaultFeeTarget = FeeTargetCodeNormal
)

// FeeTarget contains the fee rate for a specific fee target.
type FeeTarget struct {
	// Blocks is the target number of blocks in which the tx should be confirmed.
	Blocks int
	// Code is the identifier for the UI.
	Code FeeTargetCode
	// FeeRatePerKb is the fee rate needed for this target. Can be nil until populated.
	FeeRatePerKb *btcutil.Amount
}
