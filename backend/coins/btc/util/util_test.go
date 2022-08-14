// Copyright 2021 Shift Crypto AG
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

package util

import (
	"encoding/hex"
	"testing"

	"github.com/btcsuite/btcd/btcutil"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/ltc"
	"github.com/stretchr/testify/require"
)

func mustBytesFromHex(v string) []byte {
	b, err := hex.DecodeString(v)
	if err != nil {
		panic(err)
	}
	return b
}

func TestPkScriptFromAddress(t *testing.T) {
	hash := mustBytesFromHex("92953b6991297002faa62a1dd24313ff621e10ab")
	net := &chaincfg.MainNetParams

	var address btcutil.Address

	address, err := btcutil.NewAddressPubKeyHash(hash, net)
	require.NoError(t, err)
	pkScript, err := PkScriptFromAddress(address)
	require.NoError(t, err)
	require.Equal(t,
		mustBytesFromHex("76a91492953b6991297002faa62a1dd24313ff621e10ab88ac"),
		pkScript)

	address, err = btcutil.NewAddressWitnessPubKeyHash(hash, net)
	require.NoError(t, err)
	pkScript, err = PkScriptFromAddress(address)
	require.NoError(t, err)
	require.Equal(t,
		mustBytesFromHex("001492953b6991297002faa62a1dd24313ff621e10ab"),
		pkScript)

	address, err = btcutil.NewAddressScriptHashFromHash(hash, net)
	require.NoError(t, err)
	pkScript, err = PkScriptFromAddress(address)
	require.NoError(t, err)
	require.Equal(t,
		mustBytesFromHex("a91492953b6991297002faa62a1dd24313ff621e10ab87"),
		pkScript)

	scriptHash := mustBytesFromHex("4af2e4549a5cbb736e77cef52fe30b9df8121d7356ab2005463ecb089723458d")
	address, err = btcutil.NewAddressWitnessScriptHash(scriptHash, net)
	require.NoError(t, err)
	pkScript, err = PkScriptFromAddress(address)
	require.NoError(t, err)
	require.Equal(t,
		mustBytesFromHex("00204af2e4549a5cbb736e77cef52fe30b9df8121d7356ab2005463ecb089723458d"),
		pkScript)

	// Taproot: test vector #1 from https://github.com/bitcoin/bips/blob/d7cc20992724ea484087c07d2ed53fb3bc3a108b/bip-0086.mediawiki#test-vectors
	pubkey := mustBytesFromHex("a60869f0dbcf1dc659c9cecbaf8050135ea9e8cdc487053f1dc6880949dc684c")
	address, err = btcutil.NewAddressTaproot(pubkey, net)
	require.NoError(t, err)
	pkScript, err = PkScriptFromAddress(address)
	require.NoError(t, err)
	require.Equal(t,
		mustBytesFromHex("5120a60869f0dbcf1dc659c9cecbaf8050135ea9e8cdc487053f1dc6880949dc684c"),
		pkScript)
}

func TestAddressFromPkScript(t *testing.T) {
	hash := mustBytesFromHex("92953b6991297002faa62a1dd24313ff621e10ab")
	net := &chaincfg.MainNetParams

	var address btcutil.Address

	address, err := btcutil.NewAddressPubKeyHash(hash, net)
	require.NoError(t, err)
	pkScript, err := PkScriptFromAddress(address)
	require.NoError(t, err)
	recoveredAddres, err := AddressFromPkScript(pkScript, &chaincfg.MainNetParams)
	require.NoError(t, err)
	require.Equal(t, address.ScriptAddress(), recoveredAddres.ScriptAddress())

	address, err = btcutil.NewAddressWitnessPubKeyHash(hash, net)
	require.NoError(t, err)
	pkScript, err = PkScriptFromAddress(address)
	require.NoError(t, err)
	recoveredAddres, err = AddressFromPkScript(pkScript, &chaincfg.MainNetParams)
	require.NoError(t, err)
	require.Equal(t, address.ScriptAddress(), recoveredAddres.ScriptAddress())

	address, err = btcutil.NewAddressScriptHashFromHash(hash, net)
	require.NoError(t, err)
	pkScript, err = PkScriptFromAddress(address)
	require.NoError(t, err)
	recoveredAddres, err = AddressFromPkScript(pkScript, &chaincfg.MainNetParams)
	require.NoError(t, err)
	require.Equal(t, address.ScriptAddress(), recoveredAddres.ScriptAddress())

	scriptHash := mustBytesFromHex("4af2e4549a5cbb736e77cef52fe30b9df8121d7356ab2005463ecb089723458d")
	address, err = btcutil.NewAddressWitnessScriptHash(scriptHash, net)
	require.NoError(t, err)
	pkScript, err = PkScriptFromAddress(address)
	require.NoError(t, err)
	recoveredAddres, err = AddressFromPkScript(pkScript, &chaincfg.MainNetParams)
	require.NoError(t, err)
	require.Equal(t, address.ScriptAddress(), recoveredAddres.ScriptAddress())

	pubkey := mustBytesFromHex("a60869f0dbcf1dc659c9cecbaf8050135ea9e8cdc487053f1dc6880949dc684c")
	address, err = btcutil.NewAddressTaproot(pubkey, net)
	require.NoError(t, err)
	pkScript, err = PkScriptFromAddress(address)
	require.NoError(t, err)
	recoveredAddres, err = AddressFromPkScript(pkScript, &chaincfg.MainNetParams)
	require.NoError(t, err)
	require.Equal(t, address.ScriptAddress(), recoveredAddres.ScriptAddress())
	// Taproot is not activated on Litecoin.
	_, err = AddressFromPkScript(pkScript, &ltc.MainNetParams)
	require.Error(t, err)
}
