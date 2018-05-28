package random

import (
	"crypto/rand"
	"encoding/hex"

	"github.com/shiftdevices/godbb/util/errp"
)

// HexString returns a random hex-encoded string of the given length in bytes.
func HexString(length int) (string, error) {
	bytes := make([]byte, length)
	_, err := rand.Read(bytes)
	if err != nil {
		return "", errp.WithStack(err)
	}
	return hex.EncodeToString(bytes), nil
}

// BytesOrPanic returns random bytes of the given length or panics in case of an error.
func BytesOrPanic(length int) []byte {
	bytes := make([]byte, length)
	_, err := rand.Read(bytes)
	if err != nil {
		panic(err)
	}
	return bytes
}
