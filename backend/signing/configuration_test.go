// SPDX-License-Identifier: Apache-2.0

package signing

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/btcsuite/btcd/btcutil/hdkeychain"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/stretchr/testify/require"
)

func mustKeypath(keypath string) AbsoluteKeypath {
	kp, err := NewAbsoluteKeypath(keypath)
	if err != nil {
		panic(err)
	}
	return kp
}

func mustXPub(t *testing.T, net *chaincfg.Params) *hdkeychain.ExtendedKey {
	t.Helper()
	xpub, err := hdkeychain.NewMaster(make([]byte, 32), net)
	require.NoError(t, err)
	xpub, err = xpub.Neuter()
	require.NoError(t, err)
	return xpub
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

func TestAccountNumberOnConfigurations(t *testing.T) {
	xpub, err := hdkeychain.NewMaster(make([]byte, 32), &chaincfg.TestNet3Params)
	require.NoError(t, err)
	xpub, err = xpub.Neuter()
	require.NoError(t, err)
	rootFingerprint := []byte{1, 2, 3, 4}

	cfg1 := NewBitcoinConfiguration(
		ScriptTypeP2WPKH, rootFingerprint, mustKeypath("m/48'/0'/10'"), xpub)
	cfg2 := NewBitcoinConfiguration(
		ScriptTypeP2WPKH, rootFingerprint, mustKeypath("m/84'/0'/10'"), xpub)
	cfgs := Configurations{cfg1, cfg2}
	num, err := cfgs.AccountNumber()
	require.NoError(t, err)
	require.Equal(t, uint16(10), num)
}

func TestBitcoinSimpleDescriptorScriptTypes(t *testing.T) {
	xpub := mustXPub(t, &chaincfg.TestNet3Params)
	cfg := &BitcoinSimple{
		KeyInfo: KeyInfo{
			RootFingerprint:   []byte{0xde, 0xad, 0xbe, 0xef},
			AbsoluteKeypath:   mustKeypath("m/84'/1'/0'"),
			ExtendedPublicKey: xpub,
		},
	}

	tests := []struct {
		name               string
		scriptType         ScriptType
		expectedDescriptor string
	}{
		{
			name:       "p2pkh",
			scriptType: ScriptTypeP2PKH,
			expectedDescriptor: "pkh([deadbeef/84'/1'/0']" +
				xpub.String() + "/<0;1>/*)#ef5x28x4",
		},
		{
			name:       "p2wpkh-p2sh",
			scriptType: ScriptTypeP2WPKHP2SH,
			expectedDescriptor: "sh(wpkh([deadbeef/84'/1'/0']" +
				xpub.String() + "/<0;1>/*))#59g6xt5j",
		},
		{
			name:       "p2wpkh",
			scriptType: ScriptTypeP2WPKH,
			expectedDescriptor: "wpkh([deadbeef/84'/1'/0']" +
				xpub.String() + "/<0;1>/*)#8r4fxrzh",
		},
		{
			name:       "p2tr",
			scriptType: ScriptTypeP2TR,
			expectedDescriptor: "tr([deadbeef/84'/1'/0']" +
				xpub.String() + "/<0;1>/*)#kyemv552",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			cfg.ScriptType = test.scriptType
			descriptor, err := cfg.Descriptor(&chaincfg.TestNet3Params)
			require.NoError(t, err)
			require.Equal(t, test.expectedDescriptor, descriptor)
		})
	}
}

func TestBitcoinSimpleDescriptorNetPrefix(t *testing.T) {
	cfg := &BitcoinSimple{
		ScriptType: ScriptTypeP2WPKH,
		KeyInfo: KeyInfo{
			RootFingerprint:   []byte{1, 2, 3, 4},
			AbsoluteKeypath:   mustKeypath("m/84'/0'/0'"),
			ExtendedPublicKey: mustXPub(t, &chaincfg.TestNet3Params),
		},
	}

	mainnetDescriptor, err := cfg.Descriptor(&chaincfg.MainNetParams)
	require.NoError(t, err)
	require.Equal(
		t,
		"wpkh([01020304/84'/0'/0']xpub661MyMwAqRbcFhCvdhTAfpEEDV58oqDvv65YNHC686NNs4KbH8YZQJWVmrfbve7aAVHzxw8bKFxA7MLeDK6BbLfkE3bqkvHLPgaGHHtYGeY/<0;1>/*)#q37lylqm",
		mainnetDescriptor,
	)

	testnetDescriptor, err := cfg.Descriptor(&chaincfg.TestNet3Params)
	require.NoError(t, err)
	require.Equal(
		t,
		"wpkh([01020304/84'/0'/0']tpubD6NzVbkrYhZ4XVPn5tSFsjZbYcAnoDizTifqiqFEU18GcLzJMMPeYkBL1tkPT94oxPpuaWeTrMnCoXqFcAwRUn83HeM9SSwZyeAg3J62ssn/<0;1>/*)#js3sz23h",
		testnetDescriptor,
	)

	regtestDescriptor, err := cfg.Descriptor(&chaincfg.RegressionNetParams)
	require.NoError(t, err)
	require.Equal(
		t,
		"wpkh([01020304/84'/0'/0']tpubD6NzVbkrYhZ4XVPn5tSFsjZbYcAnoDizTifqiqFEU18GcLzJMMPeYkBL1tkPT94oxPpuaWeTrMnCoXqFcAwRUn83HeM9SSwZyeAg3J62ssn/<0;1>/*)#js3sz23h",
		regtestDescriptor,
	)
}

func TestDescriptorChecksumVector(t *testing.T) {
	// Bitcoin Core checksum test vector:
	// https://github.com/bitcoin/bitcoin/blob/v30.2/src/test/descriptor_tests.cpp#L1004-L1006
	payload := "sh(multi(2,[00000000/111'/222]xpub6ERApfZwUNrhLCkDtcHTcxd75RbzS1ed54G1LkBUHQVHQKqhMkhgbmJbZRkrgZw4koxb5JaHWkY4ALHY2grBGRjaDMzQLcgJvLJuZZvRcEL,xpub68NZiKmJWnxxS6aaHmn81bvJeTESw724CRDs6HbuccFQN9Ku14VQrADWgqbhhTHBaohPX4CjNLf9fq9MYo6oDaPPLPxSb7gwQN3ih19Zm4Y/0))"
	checksum, err := descriptorChecksum(payload)
	require.NoError(t, err)
	require.Equal(t, "tjg09x5t", checksum)

	withChecksum, err := addDescriptorChecksum(payload)
	require.NoError(t, err)
	require.Equal(t, payload+"#tjg09x5t", withChecksum)
}

func TestBitcoinSimpleDescriptorEmptyBasePath(t *testing.T) {
	xpub := mustXPub(t, &chaincfg.MainNetParams)
	cfg := &BitcoinSimple{
		ScriptType: ScriptTypeP2WPKH,
		KeyInfo: KeyInfo{
			RootFingerprint:   []byte{1, 2, 3, 4},
			AbsoluteKeypath:   mustKeypath("m/"),
			ExtendedPublicKey: xpub,
		},
	}
	descriptor, err := cfg.Descriptor(&chaincfg.MainNetParams)
	require.NoError(t, err)
	payload, _, found := strings.Cut(descriptor, "#")
	require.True(t, found)
	require.Equal(t, "wpkh([01020304]"+xpub.String()+"/<0;1>/*)", payload)
}
