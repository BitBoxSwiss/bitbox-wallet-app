// Copyright 2020 Shift Crypto AG
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

package signing

import (
	"encoding/json"
	"testing"

	"github.com/btcsuite/btcd/btcutil/hdkeychain"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/stretchr/testify/require"
)

func mustKeypath(keypath string) *AbsoluteKeypath {
	kp, err := NewAbsoluteKeypath(keypath)
	if err != nil {
		panic(err)
	}
	return kp
}

func TestEncodeDecode(t *testing.T) {
	xpub, err := hdkeychain.NewMaster(make([]byte, 32), &chaincfg.TestNet3Params)
	require.NoError(t, err)
	xpub, err = xpub.Neuter()
	require.NoError(t, err)
	keypath := mustKeypath("m/84'/1'/0'")
	rootFingerprint := []byte{1, 2, 3, 4}

	cfg := NewBitcoinConfiguration(ScriptTypeP2WPKH, rootFingerprint, keypath, xpub)
	jsonBytes, err := json.Marshal(cfg)
	require.NoError(t, err)
	var cfgDecoded Configuration
	require.NoError(t, json.Unmarshal(jsonBytes, &cfgDecoded))
	require.Nil(t, cfgDecoded.EthereumSimple)
	require.NotNil(t, cfgDecoded.BitcoinSimple)
	require.Equal(t,
		cfg.BitcoinSimple.KeyInfo.RootFingerprint,
		cfgDecoded.BitcoinSimple.KeyInfo.RootFingerprint)
	require.Equal(t,
		cfg.BitcoinSimple.KeyInfo.ExtendedPublicKey.String(),
		cfgDecoded.BitcoinSimple.KeyInfo.ExtendedPublicKey.String())
	require.Equal(t,
		cfg.BitcoinSimple.KeyInfo.AbsoluteKeypath.Encode(),
		cfgDecoded.BitcoinSimple.KeyInfo.AbsoluteKeypath.Encode())

	cfg = NewEthereumConfiguration(rootFingerprint, keypath, xpub)
	jsonBytes, err = json.Marshal(cfg)
	require.NoError(t, err)
	var cfgDecodedEth Configuration
	require.NoError(t, json.Unmarshal(jsonBytes, &cfgDecodedEth))
	require.Nil(t, cfgDecodedEth.BitcoinSimple)
	require.NotNil(t, cfgDecodedEth.EthereumSimple)
	require.Equal(t,
		cfg.EthereumSimple.KeyInfo.RootFingerprint,
		cfgDecodedEth.EthereumSimple.KeyInfo.RootFingerprint)
	require.Equal(t,
		cfg.EthereumSimple.KeyInfo.ExtendedPublicKey.String(),
		cfgDecodedEth.EthereumSimple.KeyInfo.ExtendedPublicKey.String())
	require.Equal(t,
		cfg.EthereumSimple.KeyInfo.AbsoluteKeypath.Encode(),
		cfgDecodedEth.EthereumSimple.KeyInfo.AbsoluteKeypath.Encode())
}

func TestContainsRootFingerprint(t *testing.T) {
	xpub, err := hdkeychain.NewMaster(make([]byte, 32), &chaincfg.TestNet3Params)
	require.NoError(t, err)
	xpub, err = xpub.Neuter()
	require.NoError(t, err)
	keypath := mustKeypath("m/84'/1'/0'")
	configs := Configurations{
		NewBitcoinConfiguration(ScriptTypeP2WPKH, []byte{1, 2, 3, 4}, keypath, xpub),
		NewEthereumConfiguration([]byte{5, 6, 7, 8}, keypath, xpub),
	}
	require.False(t, configs.ContainsRootFingerprint([]byte{1, 1, 1, 1}))
	require.True(t, configs.ContainsRootFingerprint([]byte{1, 2, 3, 4}))
	require.True(t, configs.ContainsRootFingerprint([]byte{5, 6, 7, 8}))
}

func TestFindScriptType(t *testing.T) {
	xpub, err := hdkeychain.NewMaster(make([]byte, 32), &chaincfg.TestNet3Params)
	require.NoError(t, err)
	xpub, err = xpub.Neuter()
	require.NoError(t, err)
	keypath := mustKeypath("m/84'/1'/0'")
	configs := Configurations{
		NewBitcoinConfiguration(ScriptTypeP2WPKH, []byte{1, 2, 3, 4}, keypath, xpub),
		NewBitcoinConfiguration(ScriptTypeP2WPKHP2SH, []byte{1, 2, 3, 4}, keypath, xpub),
	}
	require.Equal(t, 0, configs.FindScriptType(ScriptTypeP2WPKH))
	require.Equal(t, 1, configs.FindScriptType(ScriptTypeP2WPKHP2SH))
	require.Equal(t, -1, configs.FindScriptType(ScriptTypeP2PKH))

	configs = Configurations{
		NewEthereumConfiguration([]byte{5, 6, 7, 8}, keypath, xpub),
	}
	require.Equal(t, -1, configs.FindScriptType(ScriptTypeP2WPKH))
}

func TestAccountNumber(t *testing.T) {
	xpub, err := hdkeychain.NewMaster(make([]byte, 32), &chaincfg.TestNet3Params)
	require.NoError(t, err)
	xpub, err = xpub.Neuter()
	require.NoError(t, err)
	rootFingerprint := []byte{1, 2, 3, 4}

	cfg := NewBitcoinConfiguration(
		ScriptTypeP2WPKH, rootFingerprint, mustKeypath("m/48'/0'/0'"), xpub)
	num, err := cfg.AccountNumber()
	require.NoError(t, err)
	require.Equal(t, uint16(0), num)
	cfg = NewBitcoinConfiguration(
		ScriptTypeP2WPKH, rootFingerprint, mustKeypath("m/48'/0'/10'"), xpub)
	num, err = cfg.AccountNumber()
	require.NoError(t, err)
	require.Equal(t, uint16(10), num)
	cfg = NewBitcoinConfiguration(
		ScriptTypeP2WPKH, rootFingerprint, mustKeypath("m/48'/0'/0'/10'"), xpub)
	num, err = cfg.AccountNumber()
	require.Error(t, err)
	require.Equal(t, uint16(0), num)

	cfg = NewEthereumConfiguration(
		rootFingerprint, mustKeypath("m/44'/60'/0'/0/0"), xpub)
	num, err = cfg.AccountNumber()
	require.NoError(t, err)
	require.Equal(t, uint16(0), num)
	cfg = NewEthereumConfiguration(
		rootFingerprint, mustKeypath("m/44'/60'/0'/0/10"), xpub)
	num, err = cfg.AccountNumber()
	require.NoError(t, err)
	require.Equal(t, uint16(10), num)
	cfg = NewEthereumConfiguration(
		rootFingerprint, mustKeypath("m/44'/60'/0'/0/0/10"), xpub)
	num, err = cfg.AccountNumber()
	require.Error(t, err)
	require.Equal(t, uint16(0), num)
}
