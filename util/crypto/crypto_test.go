// Copyright 2018 Shift Devices AG
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

package crypto_test

import (
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/util/crypto"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/random"
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
