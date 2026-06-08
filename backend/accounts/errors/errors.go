// SPDX-License-Identifier: Apache-2.0

package errors

import (
	errpkg "errors"
)

// TxValidationError represents errors in the tx proposal input data.
type TxValidationError string

func (err TxValidationError) Error() string {
	return string(err)
}

var (
	// ErrFeesNotAvailable is returned when there was an error estimating fees.
	ErrFeesNotAvailable = TxValidationError("feesNotAvailable")
	// ErrInvalidAddress is used when the recipient address is invalid or does not match the correct
	// network.
	ErrInvalidAddress = TxValidationError("invalidAddress")
	// ErrInvalidAmount is used when the user entered amount is malformatted or not positive.
	ErrInvalidAmount = TxValidationError("invalidAmount")
	// ErrInsufficientFunds is returned when there are not enough funds to cover the target amount
	// and fee.
	ErrInsufficientFunds = TxValidationError("insufficientFunds")
	// ErrFeeTooLow is returned when the custom fee the user entered is too low to be able to
	// broadcast the transaction.
	ErrFeeTooLow = TxValidationError("feeTooLow")
	// ErrAccountNotsynced is used when the account sync has not successfully finished.
	ErrAccountNotsynced = TxValidationError("accountNotSynced")

	// ErrNotAvailable is returned if data required is not available yet. Example: the headers are
	// not synced yet, which is a prerequisite to making a timeseries of the portfolio.
	ErrNotAvailable = errpkg.New("notAvailable")

	// ErrERC20InsufficientGasFunds is returned when there is not enough ETH to pay the erc20 transaction fee.
	ErrERC20InsufficientGasFunds = errpkg.New("erc20InsufficientGasFunds")
)
