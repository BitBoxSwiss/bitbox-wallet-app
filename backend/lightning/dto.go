// SPDX-License-Identifier: Apache-2.0

package lightning

type receivePaymentRequestDto struct {
	AmountMsat  uint64 `json:"amountMsat"`
	Description string `json:"description"`
}

type sendPaymentRequestDto struct {
	Bolt11     string  `json:"bolt11"`
	AmountMsat *uint64 `json:"amountMsat"`
}
