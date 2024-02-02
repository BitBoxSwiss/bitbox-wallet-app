// Copyright 2023 Shift Crypto AG
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

package bitsurance

import (
	"testing"

	"github.com/btcsuite/btcd/btcutil/hdkeychain"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/accounts"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/accounts/mocks"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/signing"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func mustKeypath(keypath string) signing.AbsoluteKeypath {
	kp, err := signing.NewAbsoluteKeypath(keypath)
	if err != nil {
		panic(err)
	}
	return kp
}

func TestBitsuranceGetId(t *testing.T) {
	xpub, err := hdkeychain.NewMaster(make([]byte, 32), &chaincfg.MainNetParams)
	require.NoError(t, err)
	xpub, err = xpub.Neuter()
	require.NoError(t, err)
	keypath := mustKeypath("m/84'/1'/0'")
	rootFingerprint := []byte{1, 2, 3, 4}

	expectedId := "f587af7854f77c7e4d95753910717d98467bfb93156de487ecb7157c180be37a"

	cfg := signing.NewBitcoinConfiguration(signing.ScriptTypeP2WPKH, rootFingerprint, keypath, xpub)
	mockedInterface := &mocks.InterfaceMock{
		InfoFunc: func() *accounts.Info {
			return &accounts.Info{
				SigningConfigurations: []*signing.Configuration{
					{
						BitcoinSimple: cfg.BitcoinSimple,
					},
				},
			}
		},
	}
	id, err := GetBitsuranceId(mockedInterface)
	assert.NoError(t, err)
	assert.Equal(t, expectedId, id)
}
