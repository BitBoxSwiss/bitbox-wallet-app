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

package addresses_test

import (
	"encoding/hex"
	"testing"

	"github.com/btcsuite/btcd/btcec"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/addresses"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/addresses/test"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/signing"
	"github.com/stretchr/testify/require"
)

var scriptTypes = []signing.ScriptType{
	signing.ScriptTypeP2PKH,
	signing.ScriptTypeP2WPKHP2SH,
	signing.ScriptTypeP2WPKH,
}

func TestSigScriptWitnessSize(t *testing.T) {
	// A signature can be 70 or 71 bytes (excluding sighash op).
	// We take one that has 71 bytes, as the size function returns the maximum possible size.
	sigBytes, err := hex.DecodeString(
		`3045022100a97dc23e47bb79dbff73e33be4a4e476d6ef67c8c23a9ee4a9ee21f4dd80f0f202201c5d4be437308539e1193d9118fae03bae1942e9ce27c86803bb5f18aa044a46`)
	require.NoError(t, err)
	sig, err := btcec.ParseDERSignature(sigBytes, btcec.S256())
	require.NoError(t, err)

	// Test all singlesig configurations.
	for _, scriptType := range scriptTypes {
		address := test.GetAddress(scriptType)
		t.Run(address.Configuration.String(), func(t *testing.T) {
			sigScriptSize, hasWitness := addresses.SigScriptWitnessSize(address.Configuration)
			sigScript, witness := address.SignatureScript(*sig)
			require.Equal(t, len(sigScript), sigScriptSize)
			require.Equal(t, witness != nil, hasWitness)
		})
	}
}
