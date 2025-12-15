// SPDX-License-Identifier: Apache-2.0

package signing

import (
	"encoding/json"
	"testing"

	"github.com/btcsuite/btcd/btcutil/hdkeychain"
	"github.com/stretchr/testify/require"
)

func TestKeypath(t *testing.T) {
	input := " m / 44' /0'/1' / 0 "
	absoluteKeypath, err := NewAbsoluteKeypath(input)
	require.NoError(t, err)
	require.Equal(t, "m/44'/0'/1'/0", absoluteKeypath.Encode())

	bytes, err := json.Marshal(absoluteKeypath)
	require.NoError(t, err)

	var decodedKeypath AbsoluteKeypath
	err = json.Unmarshal(bytes, &decodedKeypath)
	if err != nil {
		panic(err)
	}
	require.NoError(t, err)
	require.Equal(t, absoluteKeypath.Encode(), decodedKeypath.Encode())
}

func TestNewAbsoluteKeypathFromUint32(t *testing.T) {
	require.Equal(t, "m/", NewAbsoluteKeypathFromUint32().Encode())
	require.Equal(t, "m/1", NewAbsoluteKeypathFromUint32(1).Encode())
	require.Equal(t, "m/1'", NewAbsoluteKeypathFromUint32(1+hdkeychain.HardenedKeyStart).Encode())
	require.Equal(t,
		"m/84'/1'/0'/1/10",
		NewAbsoluteKeypathFromUint32(84+hdkeychain.HardenedKeyStart, 1+hdkeychain.HardenedKeyStart, hdkeychain.HardenedKeyStart, 1, 10).Encode())
}
