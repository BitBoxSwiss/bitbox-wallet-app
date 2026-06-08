// SPDX-License-Identifier: Apache-2.0

package maketx

import (
	"encoding/hex"
	"fmt"
	"math/big"
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/addresses"
	addressesTest "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/addresses/test"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/types"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/signing"
	"github.com/btcsuite/btcd/btcutil"
	"github.com/btcsuite/btcd/mempool"
	"github.com/btcsuite/btcd/txscript"
	"github.com/btcsuite/btcd/wire"
	"github.com/stretchr/testify/require"
)

var scriptTypes = []signing.ScriptType{
	signing.ScriptTypeP2PKH,
	signing.ScriptTypeP2WPKHP2SH,
	signing.ScriptTypeP2WPKH,
	signing.ScriptTypeP2TR,
}

func unhex(s string) []byte {
	r, err := hex.DecodeString(s)
	if err != nil {
		panic(err)
	}
	return r
}

func makeSig() types.Signature {
	// In the DER encoding, a signature can be 70 or 71 bytes (excluding sighash op).
	// We take one that has 71 bytes, as the size function returns the maximum possible size.
	sig := types.Signature{
		R: new(big.Int).SetBytes(unhex("a97dc23e47bb79dbff73e33be4a4e476d6ef67c8c23a9ee4a9ee21f4dd80f0f2")),
		S: new(big.Int).SetBytes(unhex("1c5d4be437308539e1193d9118fae03bae1942e9ce27c86803bb5f18aa044a46")),
	}
	if len(sig.SerializeDER()) != 71 {
		panic("bad test signature")
	}
	return sig
}

// signatureScript returns the signature script (and witness) needed to spend from this address.
func signatureScript(
	t *testing.T,
	address *addresses.AccountAddress,
	signature types.Signature,
) ([]byte, wire.TxWitness) {
	t.Helper()
	publicKey := address.PublicKey
	switch address.AccountConfiguration.ScriptType() {
	case signing.ScriptTypeP2PKH:
		signatureScript, err := txscript.NewScriptBuilder().
			AddData(append(signature.SerializeDER(), byte(txscript.SigHashAll))).
			AddData(publicKey.SerializeCompressed()).
			Script()
		require.NoError(t, err)
		return signatureScript, nil
	case signing.ScriptTypeP2WPKHP2SH:
		signatureScript, err := txscript.NewScriptBuilder().
			AddData(address.RedeemScript).
			Script()
		require.NoError(t, err)
		txWitness := wire.TxWitness{
			append(signature.SerializeDER(), byte(txscript.SigHashAll)),
			publicKey.SerializeCompressed(),
		}
		return signatureScript, txWitness
	case signing.ScriptTypeP2WPKH:
		txWitness := wire.TxWitness{
			append(signature.SerializeDER(), byte(txscript.SigHashAll)),
			publicKey.SerializeCompressed(),
		}
		return []byte{}, txWitness
	case signing.ScriptTypeP2TR:
		// We assume SIGHASH_DEFAULT, which defaults to SIGHASH_ALL without needing to explicitly
		// append it to the signature. See:
		// https://github.com/bitcoin/bips/blob/97e02b2223b21753acefa813a4e59dbb6e849e77/bip-0341.mediawiki#taproot-key-path-spending-signature-validation
		txWitness := wire.TxWitness{
			signature.SerializeCompact(),
		}
		return []byte{}, txWitness
	default:
		panic("Unrecognized address type.")
	}
}

func testEstimateTxSize(
	t *testing.T, useSegwit bool, outputScriptType, changeScriptType signing.ScriptType) {
	t.Helper()
	sig := makeSig()

	inputScriptTypes := scriptTypes
	if !useSegwit {
		inputScriptTypes = []signing.ScriptType{signing.ScriptTypeP2PKH}
	}

	outputPkScript := addressesTest.GetAddress(outputScriptType).PubkeyScript()
	tx := &wire.MsgTx{
		Version: wire.TxVersion,
		// One output and one change.
		TxOut: []*wire.TxOut{
			{
				Value:    1,
				PkScript: outputPkScript,
			},
		},
		LockTime: 0,
	}

	var inputConfigurations []*signing.Configuration
	// Add each type of input, multiple times.  Only once might not catch errors that
	// are smoothed over by the rounding (ceiling) of the tx weight.
	for counter := 0; counter < 10; counter++ {
		for _, inputScriptType := range inputScriptTypes {
			inputAddress := addressesTest.GetAddress(inputScriptType)
			sigScript, witness := signatureScript(t, inputAddress, sig)
			tx.TxIn = append(tx.TxIn, &wire.TxIn{
				SignatureScript: sigScript,
				Witness:         witness,
				Sequence:        0,
			})
			inputConfigurations = append(inputConfigurations, inputAddress.AccountConfiguration)
		}
	}
	changePkScriptSize := 0
	if changeScriptType != "" {
		// add change
		changePkScript := addressesTest.GetAddress(changeScriptType).PubkeyScript()
		tx.TxOut = append(tx.TxOut, &wire.TxOut{
			Value:    1,
			PkScript: changePkScript,
		})
		changePkScriptSize = len(changePkScript)
	}

	estimatedSize := estimateTxSize(
		inputConfigurations,
		len(outputPkScript), changePkScriptSize)
	require.Equal(t, mempool.GetTxVirtualSize(btcutil.NewTx(tx)), int64(estimatedSize))

}

func TestSigScriptWitnessSize(t *testing.T) {
	sig := makeSig()

	// Test all singlesig configurations.
	for _, scriptType := range scriptTypes {
		address := addressesTest.GetAddress(scriptType)
		t.Run(address.AccountConfiguration.String(), func(t *testing.T) {
			sigScriptSize, witnessSize := sigScriptWitnessSize(address.AccountConfiguration)
			sigScript, witness := signatureScript(t, address, sig)
			require.Equal(t, len(sigScript), sigScriptSize)
			if witness != nil {
				require.Equal(t, witness.SerializeSize(), witnessSize)
			} else {
				require.Equal(t, 0, witnessSize)
			}
		})
	}
}

func TestEstimateTxSize(t *testing.T) {
	scriptTypes := []signing.ScriptType{
		signing.ScriptTypeP2PKH,
		signing.ScriptTypeP2WPKHP2SH,
		signing.ScriptTypeP2WPKH,
	}

	for _, useSegwit := range []bool{false, true} {
		for _, outputScriptType := range scriptTypes {
			t.Run(fmt.Sprintf("output=%s,noChange,segwit=%v", outputScriptType, useSegwit), func(t *testing.T) {
				testEstimateTxSize(t, useSegwit, outputScriptType, "")
			})
			for _, changeScriptType := range scriptTypes {
				t.Run(fmt.Sprintf("output=%s,change=%s,segwit=%v", outputScriptType, changeScriptType, useSegwit), func(t *testing.T) {
					testEstimateTxSize(t, useSegwit, outputScriptType, changeScriptType)
				})
			}
		}
	}
}
