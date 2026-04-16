// SPDX-License-Identifier: Apache-2.0

package errors

import (
	errpkg "errors"

	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
)

// TxValidationError represents errors in the tx proposal input data.
type TxValidationError string

func (err TxValidationError) Error() string {
	return string(err)
}

// CodedError preserves a descriptive message while exposing an ErrorCode to callers via Cause().
type CodedError struct {
	Code    errp.ErrorCode
	Message string
}

func (err CodedError) Error() string {
	return err.Message
}

func (err CodedError) Cause() error {
	return err.Code
}

// NewCodedError creates an error with a stable machine-readable code and a descriptive message.
func NewCodedError(code errp.ErrorCode, message string) error {
	return CodedError{
		Code:    code,
		Message: message,
	}
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
	// ErrRBFTxNotFound is returned when the transaction to replace (RBF) is not found.
	ErrRBFTxNotFound = TxValidationError("rbfTxNotFound")
	// ErrRBFTxAlreadyConfirmed is returned when attempting RBF on an already confirmed transaction.
	ErrRBFTxAlreadyConfirmed = TxValidationError("rbfTxAlreadyConfirmed")
	// ErrRBFTxNotReplaceable is returned when the transaction is no longer the active spender of
	// its inputs, e.g. it has already been replaced by another transaction.
	ErrRBFTxNotReplaceable = TxValidationError("rbfTxNotReplaceable")
	// ErrRBFInvalidTxID is returned when the transaction id provided for RBF is invalid.
	ErrRBFInvalidTxID = TxValidationError("rbfInvalidTxID")
	// ErrRBFCoinControlNotAllowed is returned when coin control is combined with RBF.
	ErrRBFCoinControlNotAllowed = TxValidationError("rbfCoinControlNotAllowed")
	// ErrRBFFeeTooLow is returned when the new fee is not sufficiently higher than the original.
	ErrRBFFeeTooLow = TxValidationError("rbfFeeTooLow")
	// ErrRBFBroadcastConflict is returned when broadcasting an RBF replacement fails because the
	// original inputs are no longer available to spend.
	ErrRBFBroadcastConflict errp.ErrorCode = "rbfBroadcastConflict"

	// ErrNotAvailable is returned if data required is not available yet. Example: the headers are
	// not synced yet, which is a prerequisite to making a timeseries of the portfolio.
	ErrNotAvailable = errpkg.New("notAvailable")

	// ErrERC20InsufficientGasFunds is returned when there is not enough ETH to pay the erc20 transaction fee.
	ErrERC20InsufficientGasFunds = errpkg.New("erc20InsufficientGasFunds")
)
