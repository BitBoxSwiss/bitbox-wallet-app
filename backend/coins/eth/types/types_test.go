// SPDX-License-Identifier: Apache-2.0

package types_test

import (
	"encoding/json"
	"math/big"
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/erc20"
	ethtypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/types"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/jsonp"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/stretchr/testify/require"
)

func TestTransactionWithHeightJSON(t *testing.T) {
	tx := &ethtypes.TransactionWithMetadata{
		Transaction: types.NewTransaction(
			123,
			common.BytesToAddress([]byte("12345678901234567890")),
			big.NewInt(123456),
			45678,
			big.NewInt(123456543),
			[]byte("contract data"),
		),
		Height:            352,
		GasUsed:           21000,
		Success:           true,
		BroadcastAttempts: 10,
	}
	tx2 := new(ethtypes.TransactionWithMetadata)
	require.NoError(t, json.Unmarshal(jsonp.MustMarshal(tx), tx2))
	require.Equal(t, tx.Height, tx2.Height)
	require.Equal(t, tx.GasUsed, tx2.GasUsed)
	require.Equal(t, tx.Success, tx2.Success)
	require.Equal(t, tx.Transaction.Hash(), tx2.Transaction.Hash())
	require.Equal(t, tx.BroadcastAttempts, tx2.BroadcastAttempts)
}

func TestTransactionData(t *testing.T) {
	accountAddress := common.HexToAddress("0x1111111111111111111111111111111111111111").Hex()

	t.Run("plain eth send", func(t *testing.T) {
		to := common.HexToAddress("0x2222222222222222222222222222222222222222")
		tx := &ethtypes.TransactionWithMetadata{
			Transaction: types.NewTransaction(0, to, big.NewInt(1000), 21000, big.NewInt(1), nil),
		}
		td := tx.TransactionData(100, nil, accountAddress)
		require.Equal(t, to.Hex(), td.Addresses[0].Address)
		require.Equal(t, "1000", td.Amount.BigInt().String())
		require.False(t, td.IsErc20)
	})

	t.Run("walletconnect contract call does not panic", func(t *testing.T) {
		// Non-ERC20 account (erc20Token=nil) carrying calldata: this used to panic ("invalid config").
		contract := common.HexToAddress("0x3333333333333333333333333333333333333333")
		tx := &ethtypes.TransactionWithMetadata{
			Transaction: types.NewTransaction(0, contract, big.NewInt(5), 90000, big.NewInt(1), []byte{0x12, 0x34, 0x56, 0x78}),
		}
		td := tx.TransactionData(100, nil, accountAddress)
		require.Equal(t, contract.Hex(), td.Addresses[0].Address)
		require.Equal(t, "5", td.Amount.BigInt().String())
		require.False(t, td.IsErc20)
	})

	t.Run("contract creation with nil To", func(t *testing.T) {
		tx := &ethtypes.TransactionWithMetadata{
			Transaction: types.NewContractCreation(0, big.NewInt(0), 90000, big.NewInt(1), []byte{0x60, 0x80}),
		}
		td := tx.TransactionData(100, nil, accountAddress)
		require.Equal(t, "", td.Addresses[0].Address)
	})

	t.Run("canonical erc20 transfer decodes", func(t *testing.T) {
		contract := common.HexToAddress("0x4444444444444444444444444444444444444444")
		recipient := common.HexToAddress("0x00000000000000000000000000000000000000aa")
		amount := big.NewInt(777)
		data := []byte{0xa9, 0x05, 0x9c, 0xbb}
		data = append(data, common.LeftPadBytes(recipient.Bytes(), 32)...)
		data = append(data, common.LeftPadBytes(amount.Bytes(), 32)...)
		tx := &ethtypes.TransactionWithMetadata{
			Transaction: types.NewTransaction(0, contract, big.NewInt(0), 90000, big.NewInt(1), data),
		}
		token := erc20.NewToken(contract.Hex(), 18)
		td := tx.TransactionData(100, token, accountAddress)
		require.Equal(t, recipient.Hex(), td.Addresses[0].Address)
		require.Equal(t, "777", td.Amount.BigInt().String())
		require.True(t, td.IsErc20)
	})
}

func TestFeeTarget(t *testing.T) {
	require.Equal(t,
		accounts.FeeTargetCodeLow,
		(&ethtypes.FeeTarget{TargetCode: accounts.FeeTargetCodeLow, GasFeeCap: big.NewInt(21.9e9)}).Code(),
	)
	require.Equal(t,
		"21.9 Gwei",
		(&ethtypes.FeeTarget{TargetCode: accounts.FeeTargetCodeLow, GasFeeCap: big.NewInt(21.9e9)}).FormattedFeeRate(),
	)
	require.Equal(t,
		"21 Gwei",
		(&ethtypes.FeeTarget{TargetCode: accounts.FeeTargetCodeLow, GasFeeCap: big.NewInt(21e9)}).FormattedFeeRate(),
	)
	require.Equal(t,
		"210 Gwei",
		(&ethtypes.FeeTarget{TargetCode: accounts.FeeTargetCodeLow, GasFeeCap: big.NewInt(21e10)}).FormattedFeeRate(),
	)
	require.Equal(t,
		"0.123 Gwei",
		(&ethtypes.FeeTarget{TargetCode: accounts.FeeTargetCodeLow, GasFeeCap: big.NewInt(0.123e9)}).FormattedFeeRate(),
	)
}
