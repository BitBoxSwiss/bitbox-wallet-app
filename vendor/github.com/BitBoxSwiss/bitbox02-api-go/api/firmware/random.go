// SPDX-License-Identifier: Apache-2.0

package firmware

import (
	"crypto/rand"

	"github.com/BitBoxSwiss/bitbox02-api-go/util/errp"
)

// bytesOrPanic returns random bytes of the given length or panics in case of an error.
func bytesOrPanic(length int) []byte {
	bytes := make([]byte, length)
	_, err := rand.Read(bytes)
	if err != nil {
		panic(err)
	}
	return bytes
}

func randomBytes(length int) ([]byte, error) {
	result := make([]byte, length)
	n, err := rand.Read(result)
	if err != nil {
		return nil, err
	}
	if n != length {
		return nil, errp.Newf("did not read %d bytes", length)
	}
	return result, nil
}

var generateHostNonce = func() ([]byte, error) { return randomBytes(32) }
