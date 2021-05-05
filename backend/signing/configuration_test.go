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
	"testing"

	"github.com/btcsuite/btcd/chaincfg"
	"github.com/btcsuite/btcutil/hdkeychain"
	"github.com/stretchr/testify/require"
)

func TestConfigurationsHash(t *testing.T) {
	xpub, err := hdkeychain.NewMaster(make([]byte, 32), &chaincfg.TestNet3Params)
	require.NoError(t, err)
	xpub, err = xpub.Neuter()
	require.NoError(t, err)
	keypath, err := NewAbsoluteKeypath("m/")
	require.NoError(t, err)

	cfg1 := NewConfiguration(ScriptTypeP2PKH, keypath, xpub)
	cfg2 := NewConfiguration(ScriptTypeP2WPKH, keypath, xpub)

	// Different order does not change the hash.
	require.NotEqual(t, cfg1.Hash(), cfg2.Hash())
	require.Equal(t,
		(Configurations{cfg1, cfg2}).Hash(),
		(Configurations{cfg2, cfg1}).Hash(),
	)
}
