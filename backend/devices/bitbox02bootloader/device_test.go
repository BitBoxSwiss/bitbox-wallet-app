// SPDX-License-Identifier: Apache-2.0

package bitbox02bootloader

import (
	"encoding/binary"
	"errors"
	"testing"

	"github.com/BitBoxSwiss/bitbox02-api-go/api/common"
	"github.com/BitBoxSwiss/bitbox02-api-go/util/semver"
	"github.com/stretchr/testify/require"
)

type communicationMock struct {
	sendFrame func(msg string) error
	query     func([]byte) ([]byte, error)
	close     func()
}

func (communication *communicationMock) SendFrame(msg string) error {
	return communication.sendFrame(msg)
}

func (communication *communicationMock) Query(msg []byte) ([]byte, error) {
	return communication.query(msg)
}

func (communication *communicationMock) Close() {
	communication.close()
}

func TestBootloader(t *testing.T) {
	communication := communicationMock{
		query: func(msg []byte) ([]byte, error) {
			switch msg[0] {
			case byte('h'):
				hashesResponse := []byte("h\x00\x92\xb6\x23\x1a\x13\x8c\xca\xf2\xd2\x1b\x63\xc2\x0a\x0c\x4b\x12\x97\x8c\x9d\x26\x8b\xf5\x61\x74\x4a\x95\xf5\x9f\x22\xcd\xf0\xce\x0e\xd3\x47\xc8\x4e\x91\x1e\xe7\x72\x3c\xf3\xe0\x89\x91\x5a\x0b\xfa\x4b\x4c\x69\xe0\xb1\x71\xdf\xb2\xa3\x8a\xea\x86\xea\x74\xe7")
				return hashesResponse, nil
			default:
				return nil, errors.New("unexpected query")
			}
		},
	}
	device := NewDevice(
		"deviceID",
		semver.NewSemVer(1, 0, 1),
		common.ProductBitBox02Multi,
		&communication,
	)

	t.Run("", func(t *testing.T) {
		toLittleEndian := func(v uint32) []byte {
			result := make([]byte, 4)
			binary.LittleEndian.PutUint32(result, v)
			return result
		}

		communication.query = func(msg []byte) ([]byte, error) {
			require.Equal(t, byte('v'), msg[0])

			// Version response
			firmwareVersion := toLittleEndian(36)
			signingPubkeysVersion := toLittleEndian(2)
			return []byte("v\x00" + string(firmwareVersion) + string(signingPubkeysVersion)), nil
		}

		bootRequired, err := device.firmwareBootRequired()
		require.NoError(t, err)
		require.True(t, bootRequired)

		communication.query = func(msg []byte) ([]byte, error) {
			require.Equal(t, byte('v'), msg[0])

			// Version response
			firmwareVersion := toLittleEndian(37)
			signingPubkeysVersion := toLittleEndian(2)
			return []byte("v\x00" + string(firmwareVersion) + string(signingPubkeysVersion)), nil
		}

		bootRequired, err = device.firmwareBootRequired()
		require.NoError(t, err)
		require.False(t, bootRequired)
	})
}
