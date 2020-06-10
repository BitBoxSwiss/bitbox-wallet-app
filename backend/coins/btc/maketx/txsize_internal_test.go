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
	"testing"

	"github.com/btcsuite/btcd/btcec"
	"github.com/btcsuite/btcd/mempool"
	"github.com/btcsuite/btcd/wire"
	"github.com/btcsuite/btcutil"
	addressesTest "github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/addresses/test"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/signing"
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

	scriptTypeP2PKH := signing.ScriptTypeP2PKH
	scriptTypeP2WPKHP2SH := signing.ScriptTypeP2WPKHP2SH
	scriptTypeP2WPKH := signing.ScriptTypeP2WPKH
	scriptTypes := []signing.ScriptType{scriptTypeP2PKH, scriptTypeP2WPKHP2SH, scriptTypeP2WPKH}

	test := func(outputScriptType signing.ScriptType, changeScriptType *signing.ScriptType) {
		changeStr := "noChange"
		if changeScriptType != nil {
			changeStr = string(*changeScriptType)
		}
		t.Run(fmt.Sprintf("%s/%s", outputScriptType, changeStr),
			func(t *testing.T) {

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
					for _, inputScriptType := range scriptTypes {
						inputAddress := addressesTest.GetAddress(inputScriptType)
						sigScript, witness := inputAddress.SignatureScript([]*btcec.Signature{sig})
						tx.TxIn = append(tx.TxIn, &wire.TxIn{
							SignatureScript: sigScript,
							Witness:         witness,
							Sequence:        0,
						})
						inputConfigurations = append(inputConfigurations, inputAddress.Configuration)
					}
				}
				changePkScriptSize := 0
				if changeScriptType != nil {
					// add change
					changePkScript := addressesTest.GetAddress(*changeScriptType).PubkeyScript()
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
			})
	}

	for _, outputScriptType := range scriptTypes {
		test(outputScriptType, nil)
		for _, changeScriptType := range scriptTypes {
			changeScriptType := changeScriptType // avoids referencing the same variable across loop iterations
			test(outputScriptType, &changeScriptType)
		}
	}
}
