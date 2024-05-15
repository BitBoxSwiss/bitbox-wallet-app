package types_test

import (
	"encoding/json"
	"math/big"
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
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
