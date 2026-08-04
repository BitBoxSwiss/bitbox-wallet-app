// SPDX-License-Identifier: Apache-2.0

package paymentrequest

import (
	"encoding/json"
	"math/big"

	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
)

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
	Amount  string `json:"amount"`
	Address string `json:"address"`
}

// UnmarshalJSON accepts the numeric amount returned by payment-request providers as well as the
// string amount sent back by the frontend. Amount is stored as a string so values larger than
// uint64 or JavaScript's safe integer range remain exact.
func (output *Slip24Out) UnmarshalJSON(jsonBytes []byte) error {
	decoded := struct {
		Amount  json.RawMessage `json:"amount"`
		Address string          `json:"address"`
	}{}
	if err := json.Unmarshal(jsonBytes, &decoded); err != nil {
		return errp.WithStack(err)
	}

	var amount string
	if len(decoded.Amount) > 0 && decoded.Amount[0] == '"' {
		if err := json.Unmarshal(decoded.Amount, &amount); err != nil {
			return errp.WithStack(err)
		}
	} else {
		amount = string(decoded.Amount)
	}
	parsedAmount, ok := new(big.Int).SetString(amount, 10)
	if !ok || parsedAmount.Sign() < 0 {
		return errp.Newf("invalid payment request output amount %q", amount)
	}

	output.Amount = amount
	output.Address = decoded.Address
	return nil
}

// AmountBigInt returns the output amount as an arbitrary-precision integer.
func (output Slip24Out) AmountBigInt() (*big.Int, error) {
	amount, ok := new(big.Int).SetString(output.Amount, 10)
	if !ok || amount.Sign() < 0 {
		return nil, errp.Newf("invalid payment request output amount %q", output.Amount)
	}
	return amount, nil
}
