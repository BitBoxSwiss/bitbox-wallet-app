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

package maketx

import (
	"encoding/hex"
	"fmt"
	"math/big"
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/addresses/test"
	addressesTest "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/addresses/test"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/types"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/signing"
	"github.com/btcsuite/btcd/btcutil"
	"github.com/btcsuite/btcd/mempool"
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
			sigScript, witness := inputAddress.SignatureScript(sig)
			tx.TxIn = append(tx.TxIn, &wire.TxIn{
				SignatureScript: sigScript,
				Witness:         witness,
				Sequence:        0,
			})
			inputConfigurations = append(inputConfigurations, inputAddress.Configuration)
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
		address := test.GetAddress(scriptType)
		t.Run(address.Configuration.String(), func(t *testing.T) {
			sigScriptSize, witnessSize := sigScriptWitnessSize(address.Configuration)
			sigScript, witness := address.SignatureScript(sig)
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
		useSegwit := useSegwit
		for _, outputScriptType := range scriptTypes {
			outputScriptType := outputScriptType
			t.Run(fmt.Sprintf("output=%s,noChange,segwit=%v", outputScriptType, useSegwit), func(t *testing.T) {
				testEstimateTxSize(t, useSegwit, outputScriptType, "")
			})
			for _, changeScriptType := range scriptTypes {
				changeScriptType := changeScriptType
				t.Run(fmt.Sprintf("output=%s,change=%s,segwit=%v", outputScriptType, changeScriptType, useSegwit), func(t *testing.T) {
					testEstimateTxSize(t, useSegwit, outputScriptType, changeScriptType)
				})
			}
		}
	}
}
