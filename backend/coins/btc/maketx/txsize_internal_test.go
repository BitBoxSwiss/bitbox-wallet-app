package maketx

import (
	"encoding/hex"
	"fmt"
	"testing"

	"github.com/btcsuite/btcd/btcec"
	"github.com/btcsuite/btcd/mempool"
	"github.com/btcsuite/btcd/wire"
	"github.com/btcsuite/btcutil"
	"github.com/shiftdevices/godbb/backend/coins/btc/addresses"
	addressesTest "github.com/shiftdevices/godbb/backend/coins/btc/addresses/test"
	"github.com/stretchr/testify/require"
)

func TestEstimateTxSize(t *testing.T) {
	// A signature can be 70 or 71 bytes (excluding sighash op).
	// We take one that has 71 bytes, as the size function returns the maximum possible size.
	sigBytes, err := hex.DecodeString(
		`3045022100a97dc23e47bb79dbff73e33be4a4e476d6ef67c8c23a9ee4a9ee21f4dd80f0f202201c5d4be437308539e1193d9118fae03bae1942e9ce27c86803bb5f18aa044a46`)
	require.NoError(t, err)
	sig, err := btcec.ParseDERSignature(sigBytes, btcec.S256())
	require.NoError(t, err)

	addressTypeP2PKH := addresses.AddressTypeP2PKH
	addressTypeP2WPKHP2SH := addresses.AddressTypeP2WPKHP2SH
	addressTypeP2WPKH := addresses.AddressTypeP2WPKH
	addressTypes := []addresses.AddressType{addressTypeP2PKH, addressTypeP2WPKHP2SH, addressTypeP2WPKH}

	test := func(inputAddressType, outputAddressType addresses.AddressType, changeAddressType *addresses.AddressType) {
		changeStr := "noChange"
		if changeAddressType != nil {
			changeStr = string(*changeAddressType)
		}
		t.Run(fmt.Sprintf("%s/%s/%s", inputAddressType, outputAddressType, changeStr),
			func(t *testing.T) {
				sigScript, witness := addressesTest.GetAddress(inputAddressType).SignatureScript([]*btcec.Signature{sig})
				outputPkScript := addressesTest.GetAddress(outputAddressType).PubkeyScript()
				tx := &wire.MsgTx{
					Version: wire.TxVersion,
					TxIn: []*wire.TxIn{
						&wire.TxIn{
							SignatureScript: sigScript,
							Witness:         witness,
							Sequence:        0,
						},
						&wire.TxIn{
							SignatureScript: sigScript,
							Witness:         witness,
							Sequence:        0,
						},
					},
					// One output and one change.
					TxOut: []*wire.TxOut{
						&wire.TxOut{
							Value:    1,
							PkScript: outputPkScript,
						},
					},
					LockTime: 0,
				}
				changePkScriptSize := 0
				if changeAddressType != nil {
					// add change
					changePkScript := addressesTest.GetAddress(*changeAddressType).PubkeyScript()
					tx.TxOut = append(tx.TxOut, &wire.TxOut{
						Value:    1,
						PkScript: changePkScript,
					})
					changePkScriptSize = len(changePkScript)
				}

				estimatedSize := estimateTxSize(
					len(tx.TxIn), inputAddressType, len(outputPkScript), changePkScriptSize)
				require.Equal(t, mempool.GetTxVirtualSize(btcutil.NewTx(tx)), int64(estimatedSize))
			})
	}

	for _, inputAddressType := range addressTypes {
		for _, outputAddressType := range addressTypes {
			test(inputAddressType, outputAddressType, nil)
			for _, changeAddressType := range addressTypes {
				test(inputAddressType, outputAddressType, &changeAddressType)
			}
		}
	}
}
