// SPDX-License-Identifier: Apache-2.0

package eth

import (
	"math/big"
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/util/logging"
	"github.com/ethereum/go-ethereum/common"
	"github.com/stretchr/testify/require"
)

func TestNewTransactionNonce(t *testing.T) {
	zero, supplied := uint64(0), uint64(7)
	for _, test := range []struct {
		name     string
		nonce    *uint64
		expected uint64
	}{
		{name: "missing", expected: 4},
		{name: "supplied zero", nonce: &zero, expected: 0},
		{name: "supplied", nonce: &supplied, expected: 7},
	} {
		t.Run(test.name, func(t *testing.T) {
			client := newTransactionRPCClient(4, 42000, big.NewInt(3), nil)
			request := TransactionRequest{
				From:      common.HexToAddress("0x1111111111111111111111111111111111111111"),
				Recipient: common.HexToAddress("0x2222222222222222222222222222222222222222"),
				Value:     big.NewInt(42),
				Data:      []byte{0xde, 0xad, 0xbe, 0xef},
				Nonce:     test.nonce,
			}

			tx, err := newTransaction(10, client, request, logging.Get().WithGroup("transaction_test"))
			require.NoError(t, err)
			require.Equal(t, test.expected, tx.Nonce())
			require.Equal(t, request.Recipient, *tx.To())
			require.Equal(t, request.Value, tx.Value())
			require.Equal(t, request.Data, tx.Data())
			require.Equal(t, uint64(42000), tx.Gas())
			require.Equal(t, big.NewInt(3), tx.GasPrice())
			require.Len(t, client.EstimateGasCalls(), 1)
			require.Equal(t, request.From, client.EstimateGasCalls()[0].Call.From)
			if test.nonce == nil {
				require.Len(t, client.PendingNonceAtCalls(), 1)
				require.Equal(t, request.From, client.PendingNonceAtCalls()[0].Account)
			} else {
				require.Empty(t, client.PendingNonceAtCalls())
			}
		})
	}
}
