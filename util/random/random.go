package random

import (
	"crypto/rand"
	"encoding/hex"

	"github.com/shiftdevices/godbb/util/errp"
)

// HexString returns a random hex-encoded string of certain length.
func HexString(n int) (string, error) {
	b := make([]byte, n)
	_, err := rand.Read(b)
	if err != nil {
		return "", errp.WithStack(err)
	}
	return hex.EncodeToString(b), nil
}
