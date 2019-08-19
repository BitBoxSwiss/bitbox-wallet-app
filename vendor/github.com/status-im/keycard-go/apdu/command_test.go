package apdu

import (
	"testing"

	"github.com/status-im/keycard-go/hexutils"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewCommand(t *testing.T) {
	var cla uint8 = 0x80
	var ins uint8 = 0x50
	var p1 uint8 = 1
	var p2 uint8 = 2
	data := hexutils.HexToBytes("84762336c5187fe8")

	cmd := NewCommand(cla, ins, p1, p2, data)

	expected := "80 50 01 02 08 84 76 23 36 C5 18 7F E8"
	result, err := cmd.Serialize()
	assert.NoError(t, err)
	assert.Equal(t, expected, hexutils.BytesToHexWithSpaces(result))

	cmd.SetLe(uint8(0x77))
	expected = "80 50 01 02 08 84 76 23 36 C5 18 7F E8 77"
	result, err = cmd.Serialize()
	assert.NoError(t, err)
	assert.Equal(t, expected, hexutils.BytesToHexWithSpaces(result))
}

func TestParseCommand(t *testing.T) {
	raw := hexutils.HexToBytes("0102030402050607")
	cmd, err := ParseCommand(raw)
	require.Nil(t, err)
	assert.Equal(t, uint8(0x01), cmd.Cla)
	assert.Equal(t, uint8(0x02), cmd.Ins)
	assert.Equal(t, uint8(0x03), cmd.P1)
	assert.Equal(t, uint8(0x04), cmd.P2)
	assert.Equal(t, []byte{0x05, 0x06}, cmd.Data)
	assert.True(t, cmd.requiresLe)
	assert.Equal(t, uint8(0x07), cmd.le)
}
