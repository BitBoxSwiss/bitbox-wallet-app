package apdu

import (
	"bytes"
	"testing"

	"github.com/status-im/keycard-go/hexutils"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestFindTag(t *testing.T) {
	var (
		tagData []byte
		err     error
	)

	data := hexutils.HexToBytes("C1 02 BB CC C2 04 C3 02 11 22 C3 02 88 99")

	tagData, err = FindTag(data, Tag{0xC1})
	assert.NoError(t, err)
	assert.Equal(t, "BB CC", hexutils.BytesToHexWithSpaces(tagData))

	tagData, err = FindTag(data, Tag{0xC2})
	assert.NoError(t, err)
	assert.Equal(t, "C3 02 11 22", hexutils.BytesToHexWithSpaces(tagData))

	tagData, err = FindTag(data, Tag{0xC3})
	assert.NoError(t, err)
	assert.Equal(t, "88 99", hexutils.BytesToHexWithSpaces(tagData))

	tagData, err = FindTag(data, Tag{0xC2}, Tag{0xC3})
	assert.NoError(t, err)
	assert.Equal(t, "11 22", hexutils.BytesToHexWithSpaces(tagData))

	// tag not found
	data = hexutils.HexToBytes("C1 00")
	_, err = FindTag(data, Tag{0xC2})
	assert.Equal(t, &ErrTagNotFound{Tag{0xC2}}, err)

	// sub-tag not found
	data = hexutils.HexToBytes("C1 02 C2 00")
	_, err = FindTag(data, Tag{0xC1}, Tag{0xC3})
	assert.Equal(t, &ErrTagNotFound{Tag{0xC3}}, err)
}

func TestParseLength(t *testing.T) {
	scenarios := []struct {
		data           []byte
		expectedLength uint32
		err            error
	}{
		{
			data:           []byte{0x01, 0xAA},
			expectedLength: 1,
			err:            nil,
		},
		{
			data:           []byte{0x7F, 0xAA},
			expectedLength: 127,
			err:            nil,
		},
		{
			data:           []byte{0x81, 0x80, 0xAA},
			expectedLength: 128,
			err:            nil,
		},
		{
			data:           []byte{0x82, 0x80, 0x80, 0xAA},
			expectedLength: 32896,
			err:            nil,
		},
		{
			data:           []byte{0x83, 0x80, 0x80, 0x80, 0xAA},
			expectedLength: 8421504,
			err:            nil,
		},
		{
			data:           []byte{0x80, 0xAA},
			expectedLength: 0,
			err:            ErrUnsupportedLenth80,
		},
		{
			data:           []byte{0x84, 0xAA},
			expectedLength: 0,
			err:            ErrLengthTooBig,
		},
	}

	for _, s := range scenarios {
		buf := bytes.NewBuffer(s.data)
		length, _, err := parseLength(buf)
		if s.err == nil {
			assert.NoError(t, err)
			assert.Equal(t, s.expectedLength, length)
		} else {
			assert.Equal(t, s.err, err)
		}
	}
}

func TestFindTagN(t *testing.T) {
	data := hexutils.HexToBytes("0A 01 A1 0A 01 A2")

	tagData, err := FindTagN(data, 0, Tag{0x0A})
	assert.NoError(t, err)
	assert.Equal(t, "A1", hexutils.BytesToHexWithSpaces(tagData))

	tagData, err = FindTagN(data, 1, Tag{0x0A})
	assert.NoError(t, err)
	assert.Equal(t, "A2", hexutils.BytesToHexWithSpaces(tagData))
}

func TestParseTag(t *testing.T) {
	scenarios := []struct {
		rawTag      []byte
		expectedTag Tag
	}{
		{
			rawTag:      []byte{0x01, 0x02},
			expectedTag: Tag{0x01},
		},
		{
			rawTag:      []byte{0x9F, 0x70, 0x01},
			expectedTag: Tag{0x9f, 0x70},
		},
	}

	for _, s := range scenarios {
		buf := bytes.NewBuffer(s.rawTag)
		tag, _, err := parseTag(buf)
		require.Nil(t, err)
		assert.Equal(t, s.expectedTag, tag)
	}
}
