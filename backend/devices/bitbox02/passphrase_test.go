// SPDX-License-Identifier: Apache-2.0

package bitbox02

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestValidateHostPassphrase(t *testing.T) {
	// The device keyboard supports printable ASCII except backtick and tilde.
	for c := 0; c <= 255; c++ {
		err := validateHostPassphrase(string([]byte{byte(c)}))
		if c >= 0x20 && c <= 0x7d && c != 0x60 {
			require.NoError(t, err, "byte %x", c)
		} else {
			require.Equal(t, errPassphraseInvalidChars, err, "byte %x", c)
		}
	}

	for _, passphrase := range []string{"", "  a B9  ", strings.Repeat("a", 149)} {
		require.NoError(t, validateHostPassphrase(passphrase))
	}
	for _, passphrase := range []string{strings.Repeat("a", 150), strings.Repeat("a", 8192), strings.Repeat("é", 75)} {
		require.Equal(t, errPassphraseTooLong, validateHostPassphrase(passphrase))
	}
	for _, passphrase := range []string{"a\x00b", "a\nb", "a\tb", "é", "👛", "a`b", "a~b"} {
		require.Equal(t, errPassphraseInvalidChars, validateHostPassphrase(passphrase))
	}
}
