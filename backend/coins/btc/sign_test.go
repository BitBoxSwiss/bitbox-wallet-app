// SPDX-License-Identifier: Apache-2.0

package btc

import (
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/maketx"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/keystore"
	keystoreMocks "github.com/BitBoxSwiss/bitbox-wallet-app/backend/keystore/mocks"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/btcsuite/btcd/psbt/v2"
	"github.com/btcsuite/btcd/wire/v2"
	"github.com/stretchr/testify/require"
)

func TestSigningSnapshotsDisplayUnit(t *testing.T) {
	for _, unit := range []coin.BtcUnit{coin.BtcUnitDefault, coin.BtcUnitSats} {
		t.Run(string(unit), func(t *testing.T) {
			account := testAccount(t, nil)
			displayUnit := unit
			account.coin.getFormatUnit = func() coin.BtcUnit { return displayUnit }
			packet, err := psbt.NewFromUnsignedTx(wire.NewMsgTx(2))
			require.NoError(t, err)
			stopSigning := errp.New("stop after checking denomination")
			account.Config().ConnectKeystore = func() (keystore.Keystore, error) {
				if unit == coin.BtcUnitSats {
					displayUnit = coin.BtcUnitDefault
				} else {
					displayUnit = coin.BtcUnitSats
				}
				return &keystoreMocks.KeystoreMock{
					SignTransactionFunc: func(value interface{}) error {
						require.Equal(t, unit, value.(*ProposedTransaction).FormatUnit)
						return stopSigning
					},
				}, nil
			}
			_, err = account.signTransaction(&maketx.TxProposal{Coin: account.coin, Psbt: packet}, nil)
			require.ErrorIs(t, err, stopSigning)
		})
	}
}
