// SPDX-License-Identifier: Apache-2.0

package bitbox02bootloader

import (
	"bytes"
	"encoding/binary"
	"encoding/hex"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/BitBoxSwiss/bitbox02-api-go/api/bootloader"
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

func mockBootloaderCommunication(version uint32, firmwareHash []byte) communicationMock {
	return communicationMock{
		query: func(msg []byte) ([]byte, error) {
			switch msg[0] {
			case 'v':
				response := binary.LittleEndian.AppendUint32([]byte{'v', 0}, version)
				return binary.LittleEndian.AppendUint32(response, 4), nil
			case 'h':
				response := make([]byte, 66)
				response[0] = 'h'
				copy(response[2:34], firmwareHash)
				return response, nil
			default:
				return nil, errors.New("unexpected query")
			}
		},
	}
}

// A correctly installed v9.28.0 must not be treated as an interrupted installation.
func TestLatestFirmwareInfo(t *testing.T) {
	for product, versions := range releaseFirmwareHashes {
		for _, broken := range []bool{false, true} {
			t.Run(fmt.Sprintf("%s/broken=%t", product, broken), func(t *testing.T) {
				hash, err := hex.DecodeString(versions[57])
				require.NoError(t, err)
				if broken {
					hash[0] ^= 0xFF
				}
				communication := mockBootloaderCommunication(57, hash)
				device := NewDevice("deviceID", semver.NewSemVer(1, 2, 3), product, &communication)
				info, err := device.Info()
				require.NoError(t, err)
				require.False(t, info.Erased)
				require.Equal(t, broken, info.CanUpgrade)
			})
		}
	}
}

// The app uploads v9.27.2 first, boots it, and resumes with v9.28.0 only on bootloader v1.2.3.
func TestFirmwareUpgradeSequence(t *testing.T) {
	for product := range bundledFirmwares {
		for _, step := range []struct {
			name         string
			version      uint32
			bootloader   *semver.SemVer
			upload       uint32
			autoContinue bool
		}{
			{"from-v9.27.0", 54, semver.NewSemVer(1, 2, 2), 56, false},
			{"boot-intermediate", 56, semver.NewSemVer(1, 2, 2), 0, false},
			{"resume-after-bootloader-upgrade", 56, semver.NewSemVer(1, 2, 3), 57, true},
		} {
			t.Run(string(product)+"/"+step.name, func(t *testing.T) {
				communication := mockBootloaderCommunication(step.version, nil)
				query := communication.query
				var written []byte
				var sigdata []byte
				var chunks int
				communication.query = func(msg []byte) ([]byte, error) {
					switch msg[0] {
					case 'e':
						chunks = int(msg[1])
					case 'w':
						if int(msg[1])*4096 != len(written) {
							return nil, errors.New("unexpected chunk number")
						}
						written = append(written, msg[2:]...)
					case 's':
						sigdata = bytes.Clone(msg[1:])
					default:
						return query(msg)
					}
					return []byte{msg[0], 0}, nil
				}
				rebooted := make(chan string, 1)
				communication.sendFrame = func(msg string) error {
					rebooted <- msg
					return nil
				}
				device := NewDevice("deviceID", step.bootloader, product, &communication)
				require.NoError(t, device.Init(false))
				if !step.autoContinue {
					require.NoError(t, device.UpgradeFirmware())
				}
				select {
				case msg := <-rebooted:
					require.Equal(t, "r", msg)
				case <-time.After(5 * time.Second):
					t.Fatal("upgrade did not reboot")
				}
				if step.upload == 0 {
					require.Zero(t, chunks)
					require.Empty(t, written)
					require.Empty(t, sigdata)
					return
				}
				firmware, err := nextFirmware(product, step.version)
				require.NoError(t, err)
				require.Equal(t, step.upload, firmware.monotonicVersion)
				signed, err := firmware.signedBinary()
				require.NoError(t, err)
				_, expectedSigdata, expectedFirmware, err := bootloader.ParseSignedFirmware(signed)
				require.NoError(t, err)
				require.Equal(t, expectedSigdata, sigdata)
				require.Equal(t, (len(expectedFirmware)+4095)/4096, chunks)
				require.Equal(t, chunks*4096, len(written))
				require.Equal(t, expectedFirmware, written[:len(expectedFirmware)])
				require.Equal(t, bytes.Repeat([]byte{0xFF}, len(written)-len(expectedFirmware)), written[len(expectedFirmware):])
				require.Equal(t, step.upload == 56, device.Status().AdditionalUpgradeFollows)
				require.True(t, device.Status().UpgradeSuccessful)
			})
		}
	}
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
