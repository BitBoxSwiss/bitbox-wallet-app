// SPDX-License-Identifier: Apache-2.0

package software

import (
	"testing"

	"github.com/btcsuite/btcd/btcutil/hdkeychain"
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
