// SPDX-License-Identifier: Apache-2.0

package types

import (
	"bytes"
	"encoding/json"
	"math/big"
	"strings"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/erc20"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/common/hexutil"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/rlp"
)

// NumConfirmationsComplete indicates after how many confs the tx is considered complete.
const NumConfirmationsComplete = 12

// TransactionWithMetadata wraps an outgoing transaction and implements accounts.Transaction.
type TransactionWithMetadata struct {
	Transaction *types.Transaction
	// Height is 0 for pending tx.
	Height uint64
	// Only applies if Height > 0
	GasUsed uint64
	// Only applies if Height > 0.
	// false if contract execution failed, otherwise true.
	Success bool
	// Tip height at which the receipt was last checked successfully.
	LastReceiptCheckHeight uint64
	// Number of broadcast attempts.
	BroadcastAttempts uint16
}

// FeeTarget contains the gas price for a specific fee target.
type FeeTarget struct {
	// Code is the identifier for the UI.
	TargetCode accounts.FeeTargetCode
	// GasTipCap is the maxPriorityFeePerGas as specified by EIP-1559, in Wei.
	GasTipCap *big.Int
	// GasFeeCap is the maxFeePerGas (base fee + priority fee) as specified by EIP-1559, in Wei.
	GasFeeCap *big.Int
}

// Code returns the btc fee target.
func (f *FeeTarget) Code() accounts.FeeTargetCode {
	return f.TargetCode
}

// FormattedFeeRate returns a string showing the fee rate.
func (f *FeeTarget) FormattedFeeRate() string {
	if f.GasFeeCap == nil {
		return ""
	}
	factor := big.NewInt(1e9)
	s := new(big.Rat).SetFrac(f.GasFeeCap, factor).FloatString(9)
	return strings.TrimRight(strings.TrimRight(s, "0"), ".") + " Gwei"
}

// MarshalJSON implements json.Marshaler. Used for DB serialization.
func (txh *TransactionWithMetadata) MarshalJSON() ([]byte, error) {
	txSerialized, err := rlp.EncodeToBytes(txh.Transaction)
	if err != nil {
		return nil, err
	}
	return json.Marshal(map[string]interface{}{
		"tx":                     txSerialized,
		"height":                 txh.Height,
		"gasUsed":                hexutil.Uint64(txh.GasUsed),
		"success":                txh.Success,
		"lastReceiptCheckHeight": txh.LastReceiptCheckHeight,
		"broadcastAttempts":      txh.BroadcastAttempts,
	})
}

// UnmarshalJSON implements json.Unmarshaler. Used for DB serialization.
func (txh *TransactionWithMetadata) UnmarshalJSON(input []byte) error {
	m := struct {
		TransactionRLP         []byte         `json:"tx"`
		Height                 uint64         `json:"height"`
		GasUsed                hexutil.Uint64 `json:"gasUsed"`
		Success                bool           `json:"success"`
		LastReceiptCheckHeight uint64         `json:"lastReceiptCheckHeight"`
		BroadcastAttempts      uint16         `json:"broadcastAttempts"`
	}{}
	if err := json.Unmarshal(input, &m); err != nil {
		return err
	}
	txh.Transaction = new(types.Transaction)
	if err := rlp.DecodeBytes(m.TransactionRLP, txh.Transaction); err != nil {
		return err
	}
	txh.Height = m.Height
	txh.GasUsed = uint64(m.GasUsed)
	txh.Success = m.Success
	txh.LastReceiptCheckHeight = m.LastReceiptCheckHeight
	txh.BroadcastAttempts = m.BroadcastAttempts
	return nil
}

// isCanonicalERC20Transfer reports whether tx is a standard ERC20 transfer() call to the token's
// own contract: data = <0xa9059cbb><32-byte address><32-byte amount> with zero ETH value.
func isCanonicalERC20Transfer(tx *types.Transaction, erc20Token *erc20.Token) bool {
	data := tx.Data()
	to := tx.To()
	return to != nil &&
		*to == erc20Token.ContractAddress() &&
		len(data) == 68 &&
		bytes.Equal(data[:4], []byte{0xa9, 0x05, 0x9c, 0xbb}) &&
		tx.Value().Sign() == 0
}

// TransactionData returns the tx data to be shown to the user.
func (txh *TransactionWithMetadata) TransactionData(
	tipHeight uint64, erc20Token *erc20.Token, accountAddress string) *accounts.TransactionData {
	data := txh.Transaction.Data()

	// Default rendering: a send of the tx's ETH value to the callee. This covers plain ETH sends
	// and arbitrary contract calls (e.g. WalletConnect approve/swap), which display as a send of the
	// tx's ETH value to the called contract. A nil To (contract creation) renders with no address.
	amount := coin.NewAmount(txh.Transaction.Value())
	address := ""
	if to := txh.Transaction.To(); to != nil {
		address = to.Hex()
	}

	// Decode canonical ERC20 transfers so the amount and recipient reflect the token transfer
	// rather than the (zero) ETH value and the contract address. Non-canonical data on a token
	// account falls back to the default rendering above instead of panicking.
	if erc20Token != nil && isCanonicalERC20Transfer(txh.Transaction, erc20Token) {
		amount = coin.NewAmount(new(big.Int).SetBytes(data[len(data)-32:]))
		address = common.BytesToAddress(data[4+32-common.AddressLength : 4+32]).Hex()
	}

	numConfirmations := txh.numConfirmations(tipHeight)
	nonce := txh.Transaction.Nonce()

	var txType accounts.TxType
	if address == accountAddress {
		txType = accounts.TxTypeSendSelf
	} else {
		txType = accounts.TxTypeSend
	}

	return &accounts.TransactionData{
		Fee: txh.fee(),
		// ERC20 token transaction pay fees in Ether.
		FeeIsDifferentUnit:       erc20Token != nil,
		IsErc20:                  erc20Token != nil,
		Timestamp:                nil,
		TxID:                     txh.TxID(),
		InternalID:               txh.TxID(),
		Height:                   int(txh.Height),
		NumConfirmations:         numConfirmations,
		NumConfirmationsComplete: NumConfirmationsComplete,
		Status:                   txh.status(numConfirmations),
		Type:                     txType,
		Amount:                   amount,
		Addresses: []accounts.AddressAndAmount{{
			Address: address,
			Amount:  amount,
		}},
		Gas:   txh.gas(),
		Nonce: &nonce,
	}
}

func (txh *TransactionWithMetadata) fee() *coin.Amount {
	fee := new(big.Int).Mul(big.NewInt(int64(txh.Transaction.Gas())), txh.Transaction.GasPrice())
	amount := coin.NewAmount(fee)
	return &amount
}

// TxID returns the transaction ID.
func (txh *TransactionWithMetadata) TxID() string {
	return txh.Transaction.Hash().Hex()
}

func (txh *TransactionWithMetadata) gas() uint64 {
	if txh.Height == 0 {
		return txh.Transaction.Gas()
	}
	return txh.GasUsed
}

func (txh *TransactionWithMetadata) numConfirmations(tipHeight uint64) int {
	confs := 0
	if txh.Height > 0 {
		confs = int(tipHeight - txh.Height + 1)
	}
	return confs
}

func (txh *TransactionWithMetadata) status(numConfirmations int) accounts.TxStatus {
	if numConfirmations == 0 {
		return accounts.TxStatusPending
	}
	if !txh.Success {
		return accounts.TxStatusFailed
	}
	if numConfirmations >= NumConfirmationsComplete {
		return accounts.TxStatusComplete
	}
	return accounts.TxStatusPending
}
