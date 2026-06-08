// SPDX-License-Identifier: Apache-2.0

package random

import (
	"crypto/rand"
)

// BytesOrPanic returns random bytes of the given length or panics in case of an error.
func BytesOrPanic(length int) []byte {
	bytes := make([]byte, length)
	_, err := rand.Read(bytes)
	if err != nil {
		panic(err)
	}
	return bytes
}
