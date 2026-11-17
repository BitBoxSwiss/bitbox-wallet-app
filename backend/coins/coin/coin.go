// SPDX-License-Identifier: Apache-2.0

package coin

import (
	"math/big"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/errors"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/observable"
)

const (
	// ErrInvalidPaymentInput marks unsupported or malformed payment input.
	ErrInvalidPaymentInput errp.ErrorCode = "invalidFormat"
	// ErrPaymentInputAccountMismatch means that the input specifies a different chain or asset.
	ErrPaymentInputAccountMismatch errp.ErrorCode = "accountMismatch"
)

// ParsedPaymentInput contains the extracted recipient and an optional amount in the coin's display unit.
// A parsed input can populate the form even when a field needs correction.
type ParsedPaymentInput struct {
	Recipient string `json:"recipient"`
	// Nil preserves the entered amount; an empty string clears an invalid URI amount.
	// Valid amounts, including zero, are formatted in the coin's display unit.
	Amount *string `json:"amount,omitempty"`
	// ValidationError identifies the first invalid field, independently of parsing success.
	ValidationError errors.TxValidationError `json:"validationError,omitempty"`
}

// Coin models the currency of a blockchain.
//
//go:generate moq -pkg mocks -out mocks/coin.go . Coin
type Coin interface {
	observable.Interface

	// Name is the name of the coin, show to the user.
	Name() string

	// Code returns the code used to identify the coin (should be the acronym of the coin in
	// lowercase).
	Code() Code

	// // Type returns the coin type according to BIP44:
	// // https://github.com/satoshilabs/slips/blob/master/slip-0044.md
	// Type() uint32

	// Unit is the unit code for formatting amounts, e.g. "BTC".
	// The fee unit is usually the same as the main unit, but can differ.
	Unit(isFee bool) string

	// GetFormatUnit sets the unit used to format the amount, e.g. "BTC" or "sat".
	GetFormatUnit(isFee bool) string

	// Number of decimal places in the standard unit, e.g. 8 for Bitcoin. Must be in the range
	// [0..31].
	Decimals(isFee bool) uint

	// FormatAmount formats the given amount as a number.
	FormatAmount(amount Amount, isFee bool) string

	// ToUnit returns the given amount in the unit as returned above.
	ToUnit(amount Amount, isFee bool) float64

	// SetAmount return an Amount object representing the *big.Rat given amount
	// e.g. BTC 1/2 => 50000000
	SetAmount(amount *big.Rat, isFee bool) Amount

	// ParseAmount parse a String representing a given amount, considering the formatting unit.
	// e.g. if the formatUnit is set as "sat", the amount will be considered as being sats
	ParseAmount(amount string) (Amount, error)

	// ParsePaymentInput validates a bare address or payment URI for this coin and returns
	// its recipient and optional amount in the current display unit, without creating a transaction.
	// Parsing is independent of account sync, balances, and fees so an address can be checked
	// before an amount is entered. Transaction creation remains responsible for spendability.
	// Field validation errors are part of the parsed input; a returned error rejects the whole input.
	ParsePaymentInput(input string) (*ParsedPaymentInput, error)

	// // Server returns the host and port of the full node used for blockchain synchronization.
	// Server() string

	// // Returns whether the coin is account-based (instead of UTXO).
	// // Account-based transactions can have only one output and need no change address.
	// AccountBased() bool

	// BlockExplorerTransactionURLPrefix returns the URL prefix of the block explorer.
	BlockExplorerTransactionURLPrefix() string

	// Initialize initializes the coin by connecting to a full node, downloading the headers, etc.
	Initialize() error

	// SmallestUnit returns the name of the smallest unit of a given coin
	SmallestUnit() string

	// Close shuts down all resources obtained by the coin (network connections, databases, etc.).
	Close() error
}

// DecimalsExp returns the conversion exponential from the smallest unit to the selected unit
// (BTC, LTC; ETH, etc.). e.g. 1e8 for Bitcoin/Litecoin, 1e18 for Ethereum, etc.
func DecimalsExp(coin Coin, isFee bool) *big.Int {
	return new(big.Int).Exp(
		big.NewInt(10),
		big.NewInt(int64(coin.Decimals(isFee))),
		nil,
	)
}
