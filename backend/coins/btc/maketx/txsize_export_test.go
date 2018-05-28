package maketx

import "github.com/shiftdevices/godbb/backend/signing"

func TstEstimateTxSize(inputCount int,
	inputConfiguration *signing.Configuration,
	outputPkScriptSize int,
	changePkScriptSize int) int {
	return estimateTxSize(inputCount,
		inputConfiguration,
		outputPkScriptSize,
		changePkScriptSize)
}
