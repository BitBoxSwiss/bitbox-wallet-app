// SPDX-License-Identifier: Apache-2.0

package eth

import (
	"math/big"
	"testing"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/stretchr/testify/require"
)

func TestTxProposalSignerUsesChainID(t *testing.T) {
	const chainID = uint64(10)
	recipient := common.HexToAddress("0x1111111111111111111111111111111111111111")
	privateKey, err := crypto.HexToECDSA(
		"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
	)
	require.NoError(t, err)
	expectedSender := crypto.PubkeyToAddress(privateKey.PublicKey)

	tests := []struct {
		name string
		tx   *types.Transaction
	}{
		{
			name: "legacy",
			tx: types.NewTransaction(
				0,
				recipient,
				big.NewInt(1),
				21_000,
				big.NewInt(2),
				nil,
			),
		},
		{
			name: "type 2",
			tx: types.NewTx(&types.DynamicFeeTx{
				Nonce:     0,
				GasTipCap: big.NewInt(1),
				GasFeeCap: big.NewInt(2),
				Gas:       21_000,
				To:        &recipient,
				Value:     big.NewInt(1),
			}),
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			proposal := &TxProposal{ChainID: chainID}
			signer := proposal.Signer()
			require.Equal(t, new(big.Int).SetUint64(chainID), signer.ChainID())

			signedTx, err := types.SignTx(test.tx, signer, privateKey)
			require.NoError(t, err)
			require.Equal(t, new(big.Int).SetUint64(chainID), signedTx.ChainId())

			sender, err := types.Sender(signer, signedTx)
			require.NoError(t, err)
			require.Equal(t, expectedSender, sender)
		})
	}
}

func TestTxProposalSignerRejectsDifferentTypedTransactionChainID(t *testing.T) {
	const proposalChainID = uint64(10)
	recipient := common.HexToAddress("0x1111111111111111111111111111111111111111")
	privateKey, err := crypto.HexToECDSA(
		"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
	)
	require.NoError(t, err)
	tx := types.NewTx(&types.DynamicFeeTx{
		ChainID:   big.NewInt(1),
		Nonce:     0,
		GasTipCap: big.NewInt(1),
		GasFeeCap: big.NewInt(2),
		Gas:       21_000,
		To:        &recipient,
		Value:     big.NewInt(1),
	})

	proposal := &TxProposal{ChainID: proposalChainID}
	_, err = types.SignTx(tx, proposal.Signer(), privateKey)
	require.ErrorIs(t, err, types.ErrInvalidChainId)
}
