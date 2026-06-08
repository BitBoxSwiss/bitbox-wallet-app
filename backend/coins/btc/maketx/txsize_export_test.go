// SPDX-License-Identifier: Apache-2.0

package maketx

import "github.com/BitBoxSwiss/bitbox-wallet-app/backend/signing"

func TstEstimateTxSize(
	inputConfigurations []*signing.Configuration,
	outputPkScriptSize int,
	changePkScriptSize int) int {
	return estimateTxSize(
		inputConfigurations,
		outputPkScriptSize,
		changePkScriptSize)
}
