package crypto_test

import (
	"testing"

	"github.com/shiftdevices/godbb/util/crypto"
	"github.com/shiftdevices/godbb/util/random"
	"github.com/stretchr/testify/assert"
)

func TestEncryptThenMAC(t *testing.T) {
	for i := 0; i < 10; i++ {
		message := random.BytesOrPanic(i * 13)
		encryptionKey := random.BytesOrPanic(32)
		authenticationKey := random.BytesOrPanic(32)

		encryptedBytes, err := crypto.EncryptThenMAC(message, encryptionKey, authenticationKey)
		assert.NoError(t, err)

		decryptedBytes, err := crypto.MACThenDecrypt(encryptedBytes, encryptionKey, authenticationKey)
		assert.NoError(t, err)

		assert.Equal(t, message, decryptedBytes)
	}
}
