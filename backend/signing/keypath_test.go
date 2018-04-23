package signing_test

import (
	"encoding/json"
	"testing"

	"github.com/shiftdevices/godbb/backend/signing"
	"github.com/stretchr/testify/assert"
)

func TestKeypath(t *testing.T) {
	input := " m / 44' /0'/1' / 0 "
	absoluteKeypath, err := signing.NewAbsoluteKeypath(input)
	assert.NoError(t, err)
	assert.Equal(t, "m/44'/0'/1'/0", absoluteKeypath.Encode())

	bytes, err := json.Marshal(absoluteKeypath)
	assert.NoError(t, err)

	var decodedKeypath signing.AbsoluteKeypath
	err = json.Unmarshal(bytes, &decodedKeypath)
	if err != nil {
		panic(err)
	}
	assert.NoError(t, err)
	assert.Equal(t, absoluteKeypath.Encode(), decodedKeypath.Encode())
}
