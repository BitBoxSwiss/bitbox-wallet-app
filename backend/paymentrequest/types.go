// SPDX-License-Identifier: Apache-2.0

package paymentrequest

// Slip24 models a payment request payload.
type Slip24 struct {
	RecipientName string       `json:"recipientName"`
	Nonce         *string      `json:"nonce"`
	Memos         []Slip24Memo `json:"memos"`
	Outputs       []Slip24Out  `json:"outputs"`
	Signature     string       `json:"signature"`
}

// Slip24Memo models one payment request memo.
type Slip24Memo struct {
	Type         string              `json:"type"`
	Text         string              `json:"text,omitempty"`
	CoinPurchase *Slip24CoinPurchase `json:"coinPurchase,omitempty"`
}

// Slip24CoinPurchase models a coin purchase memo.
type Slip24CoinPurchase struct {
	CoinType          uint32                   `json:"coinType"`
	Amount            string                   `json:"amount"`
	Address           string                   `json:"address"`
	AddressDerivation *Slip24AddressDerivation `json:"addressDerivation,omitempty"`
}

// Slip24AddressDerivation models optional destination-address ownership metadata.
type Slip24AddressDerivation struct {
	Eth *Slip24EthAddressDerivation `json:"eth,omitempty"`
	Btc *Slip24BtcAddressDerivation `json:"btc,omitempty"`
}

// Slip24EthAddressDerivation models ETH receive-address derivation metadata.
type Slip24EthAddressDerivation struct {
	Keypath []uint32 `json:"keypath"`
}

// Slip24BtcAddressDerivation models BTC-family receive-address derivation metadata.
type Slip24BtcAddressDerivation struct {
	Keypath    []uint32 `json:"keypath"`
	ScriptType string   `json:"scriptType"`
}

// Slip24Out models a single signed payment-request output.
type Slip24Out struct {
	Amount  uint64 `json:"amount"`
	Address string `json:"address"`
}
