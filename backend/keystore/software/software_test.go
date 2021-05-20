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

package software

import (
	"testing"

	"github.com/btcsuite/btcutil/hdkeychain"
	"github.com/stretchr/testify/require"
)

func TestRootFingerprint(t *testing.T) {
	// Xprv derived from BIP39 mnemonic (no passphrase):
	// awkward squirrel wait rubber biology escape toe daring still pause fitness vendor
	rootXprv, err := hdkeychain.NewKeyFromString("xprv9s21ZrQH143K3uDh9hiNXB3a9GVzcCujEmCwmZA9g8m4i5nUDVdLHJjsLMPzV26vj8Q7ceGrUhX119Y3XzGhJqq5K6LWP1h6gjv2cbkMEH1")
	require.NoError(t, err)
	keystore := NewKeystore(rootXprv)
	rootFingerprint, err := keystore.RootFingerprint()
	require.NoError(t, err)
	// Verified by comparing to the root fingerprint produced by the BitBox02 and Electrum.
	require.Equal(t, []byte{0xfb, 0x70, 0x89, 0xbd}, rootFingerprint)
}
