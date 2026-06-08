// SPDX-License-Identifier: Apache-2.0

package paymentrequest

import "github.com/BitBoxSwiss/bitbox-wallet-app/backend/signing"

// TextMemo represents a slip-0024 text memo.
type TextMemo struct {
	Note string
}

// EthAddressDerivation contains the keypath used to verify an ETH receive address.
type EthAddressDerivation struct {
	Keypath []uint32
}

// BtcAddressDerivation contains the data needed to verify a BTC-family receive address.
type BtcAddressDerivation struct {
	Keypath    []uint32
	ScriptType signing.ScriptType
}

// CoinPurchaseMemo represents a slip-0024 coin purchase memo.
// AddressDerivation is local app metadata and not part of the signed payload.
type CoinPurchaseMemo struct {
	CoinType             uint32
	Amount               string
	Address              string
	EthAddressDerivation *EthAddressDerivation
	BtcAddressDerivation *BtcAddressDerivation
}

// Memo is one payment-request memo in the internal validated representation.
type Memo struct {
	Text         *TextMemo
	CoinPurchase *CoinPurchaseMemo
}

// Request contains the data needed to fulfill a slip-0024 payment request.
type Request struct {
	RecipientName string
	Memos         []Memo
	Nonce         []byte
	TotalAmount   uint64
	Signature     []byte
}
