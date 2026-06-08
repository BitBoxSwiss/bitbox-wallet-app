// SPDX-License-Identifier: Apache-2.0

package crypto_test

import (
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/util/crypto"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/random"
	"github.com/stretchr/testify/require"
)

func TestEncryptThenMAC(t *testing.T) {
	for i := 0; i < 10; i++ {
		message := random.BytesOrPanic(i * 13)
		encryptionKey := random.BytesOrPanic(32)
		authenticationKey := random.BytesOrPanic(32)

		encryptedBytes, err := crypto.EncryptThenMAC(message, encryptionKey, authenticationKey)
		require.NoError(t, err)

		decryptedBytes, err := crypto.MACThenDecrypt(encryptedBytes, encryptionKey, authenticationKey)
		require.NoError(t, err)

		require.Equal(t, message, decryptedBytes)
	}
}
