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

// PendingTransfer denotes a specific output in a pending transaction.
type PendingTransfer struct {
	pendingTransaction PendingTransaction
	outputIndex        int
}

// NewPendingTransfer creates a new pending transfer.
func NewPendingTransfer(
	pendingTransaction PendingTransaction,
	outputIndex int,
) PendingTransfer {
	return PendingTransfer{
		pendingTransaction: pendingTransaction,
		outputIndex:        outputIndex,
	}
}

// PendingTransaction returns the pending transaction to which this pending transfer belongs.
func (pendingTransfer PendingTransfer) PendingTransaction() PendingTransaction {
	return pendingTransfer.pendingTransaction
}

// OutputIndex returns the index of the output in the pending transaction.
func (pendingTransfer PendingTransfer) OutputIndex() int {
	return pendingTransfer.outputIndex
}

// ConfirmedTransfer denotes a specific output in a confirmed transaction.
type ConfirmedTransfer struct {
	confirmedTransaction ConfirmedTransaction
	outputIndex          int
}

// NewConfirmedTransfer creates a new confirmed transfer.
func NewConfirmedTransfer(
	confirmedTransaction ConfirmedTransaction,
	outputIndex int,
) ConfirmedTransfer {
	return ConfirmedTransfer{
		confirmedTransaction: confirmedTransaction,
		outputIndex:          outputIndex,
	}
}

// ConfirmedTransaction returns the confirmed transaction to which this confirmed transfer belongs.
func (confirmedTransfer *ConfirmedTransfer) ConfirmedTransaction() ConfirmedTransaction {
	return confirmedTransfer.confirmedTransaction
}

// OutputIndex returns the index of the output in the confirmed transaction.
func (confirmedTransfer *ConfirmedTransfer) OutputIndex() int {
	return confirmedTransfer.outputIndex
}
