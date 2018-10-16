// Copyright 2018 Shift Devices AG
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package coin

// TxValidationError represents errors in the tx proposal input data.
type TxValidationError string

func (err TxValidationError) Error() string {
	return string(err)
}

var (
	// ErrInvalidAddress is used when the recipient address is invalid or does not match the correct
	// network.
	ErrInvalidAddress = TxValidationError("invalidAddress")
	// ErrInvalidAmount is used when the user entered amount is malformatted or not positive.
	ErrInvalidAmount = TxValidationError("invalidAmount")
	// ErrInsufficientFunds is returned when there are not enough funds to cover the target amount
	// and fee.
	ErrInsufficientFunds = TxValidationError("insufficientFunds")
)
