package types_test

import (
	"encoding/json"
	"math/big"
	"testing"

	ethtypes "github.com/digitalbitbox/bitbox-wallet-app/backend/coins/eth/types"
	"github.com/digitalbitbox/bitbox-wallet-app/util/jsonp"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/stretchr/testify/require"
)

func TestTransactionWithHeightJSON(t *testing.T) {
	tx := &ethtypes.TransactionWithHeight{
		Transaction: types.NewTransaction(
			123,
			common.BytesToAddress([]byte("12345678901234567890")),
			big.NewInt(123456),
			45678,
			big.NewInt(123456543),
			[]byte("contract data"),
		),
		Height: 352,
	}
	tx2 := new(ethtypes.TransactionWithHeight)
	require.NoError(t, json.Unmarshal(jsonp.MustMarshal(tx), tx2))
	require.Equal(t, tx.Height, tx2.Height)
	require.Equal(t, tx.Transaction.Hash(), tx2.Transaction.Hash())
}
