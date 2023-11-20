// Copyright 2018-2019 Shift Cryptosecurity AG
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

// Package bootloader contains the API to the physical device.
package bootloader

import (
	"bytes"
	"crypto/sha256"
	"encoding/binary"
	"io"
	"math"
	"time"

	"github.com/digitalbitbox/bitbox02-api-go/api/common"
	"github.com/digitalbitbox/bitbox02-api-go/util/errp"
	"github.com/digitalbitbox/bitbox02-api-go/util/semver"
)

const (
	chunkSize       = 8 * 512
	maxFirmwareSize = 884736
	// max number of chunks that can be written when flashing the firmware.
	firmwareChunks = maxFirmwareSize / chunkSize

	numRootKeys    = 3
	numSigningKeys = 3

	magicLen              = 4
	versionLen            = 4
	signingPubkeysDataLen = versionLen + numSigningKeys*64 + numRootKeys*64
	firmwareDataLen       = versionLen + numSigningKeys*64
	sigDataLen            = signingPubkeysDataLen + firmwareDataLen
)

var sigDataMagic = map[common.Product]uint32{
	common.ProductBitBox02Multi:   0x653f362b,
	common.ProductBitBox02BTCOnly: 0x11233B0B,
}

// Communication contains functions needed to communicate with the device.
type Communication interface {
	SendFrame(string) error
	Query([]byte) ([]byte, error)
	Close()
}

// Status has all the info to handle the bootloader mode.
type Status struct {
	Upgrading         bool    `json:"upgrading"`
	Progress          float64 `json:"progress"`
	UpgradeSuccessful bool    `json:"upgradeSuccessful"`
	ErrMsg            string  `json:"errMsg"`
	RebootSeconds     int     `json:"rebootSeconds"`
}

func toByte(b bool) byte {
	if b {
		return 1
	}
	return 0
}

// Device provides the API to communicate with the BitBox02 bootloader.
type Device struct {
	communication   Communication
	product         common.Product
	status          *Status
	onStatusChanged func(*Status)
	sleep           func(time.Duration)
}

// NewDevice creates a new instance of Device.
func NewDevice(
	version *semver.SemVer,
	product common.Product,
	communication Communication,
	onStatusChanged func(*Status),
) *Device {
	return &Device{
		communication:   communication,
		product:         product,
		status:          &Status{},
		onStatusChanged: onStatusChanged,
		sleep:           time.Sleep,
	}
}

// Product returns the bootloader product.
func (device *Device) Product() common.Product {
	return device.product
}

// Close closes the communication.
func (device *Device) Close() {
	device.communication.Close()
}

// Status returns the progress of a firmware upgrade.
func (device *Device) Status() *Status {
	return device.status
}

func (device *Device) query(cmd rune, data []byte) ([]byte, error) {
	var buf bytes.Buffer
	buf.WriteRune(cmd)
	buf.Write(data)
	reply, err := device.communication.Query(buf.Bytes())
	if err != nil {
		return nil, err
	}
	if len(reply) == 0 {
		return nil, errp.Newf("Unexpected reply: %v", reply)
	}
	if reply[0] != byte(cmd) || len(reply) < 2 || reply[1] != 0 {
		return nil, errp.Newf("Unexpected reply: %v", reply)
	}
	return reply[2:], nil
}

// Versions queries the device for the firmware and signing pubkeys version.
func (device *Device) Versions() (uint32, uint32, error) {
	response, err := device.query('v', nil)
	if err != nil {
		return 0, 0, err
	}
	if len(response) < 8 {
		return 0, 0, errp.Newf("Unexpected reply: %v", response)
	}
	firmwareVersion := binary.LittleEndian.Uint32(response[:4])
	signingPubkeysVersion := binary.LittleEndian.Uint32(response[4:8])
	return firmwareVersion, signingPubkeysVersion, nil
}

// GetHashes queries the device for the firmware and signing keydata hashes.
// If the display flags are true, the hashes are also shown on the device screen.
func (device *Device) GetHashes(displayFirmwareHash, displaySigningKeydataHash bool) (
	[]byte, []byte, error) {
	response, err := device.query('h',
		[]byte{toByte(displayFirmwareHash), toByte(displaySigningKeydataHash)})
	if err != nil {
		return nil, nil, err
	}
	if len(response) != 64 {
		return nil, nil, errp.New("unexpected response")
	}
	firmwareHash := response[:32]
	signingKeyDatahash := response[32:64]
	return firmwareHash, signingKeyDatahash, nil
}

// ShowFirmwareHashEnabled returns whether the bootloader will automatically show the firmware
// hash on boot.
func (device *Device) ShowFirmwareHashEnabled() (bool, error) {
	response, err := device.query('H', []byte{0xFF})
	if err != nil {
		return false, err
	}
	return response[0] == 1, nil
}

// SetShowFirmwareHashEnabled returns whether the bootloader will automatically show the firmware
// hash on boot.
func (device *Device) SetShowFirmwareHashEnabled(enabled bool) error {
	_, err := device.query('H', []byte{toByte(enabled)})
	return err
}

// Reboot reboots the device.
func (device *Device) Reboot() error {
	return device.communication.SendFrame("r")
}

// ScreenRotate rotates the device screen.
func (device *Device) ScreenRotate() error {
	_, err := device.query('f', nil)
	return err
}

func (device *Device) erase(firmwareNumChunks uint8) error {
	_, err := device.query('e', []byte{firmwareNumChunks})
	return err
}

func (device *Device) writeChunk(chunkNum uint8, chunk []byte) error {
	if len(chunk) > chunkSize {
		panic("chunk must max 4kB")
	}
	var buf bytes.Buffer
	buf.WriteByte(chunkNum)
	buf.Write(chunk)
	buf.Write(bytes.Repeat([]byte{0xFF}, chunkSize-len(chunk)))
	_, err := device.query('w', buf.Bytes())
	return err
}

func (device *Device) flashUnsignedFirmware(firmware []byte, progressCallback func(float64)) error {
	if len(firmware) > firmwareChunks*chunkSize {
		return errp.New("firmware too big")
	}
	progressCallback(0)
	buf := bytes.NewBuffer(firmware)
	totalChunks := uint8(math.Ceil(float64(buf.Len()) / float64(chunkSize)))
	if err := device.erase(totalChunks); err != nil {
		return err
	}
	chunkNum := byte(0)
	for {
		chunk := make([]byte, chunkSize)
		readLen, err := buf.Read(chunk)
		if readLen == 0 || err == io.EOF {
			break
		}
		if err != nil {
			return err
		}
		if err := device.writeChunk(chunkNum, chunk[:readLen]); err != nil {
			return err
		}
		chunkNum++
		progressCallback(float64(chunkNum) / float64(totalChunks))
	}
	return nil
}

// parseSignedFirmware parses a signed firmware file and returns (sigdata, firmware). Errors if the
// format is invalid, or the firmware magic does not match the expected magic according to the
// device product.
func (device *Device) parseSignedFirmware(firmware []byte) ([]byte, []byte, error) {
	if len(firmware) <= magicLen+sigDataLen {
		return nil, nil, errp.New("firmware too small")
	}
	magic, firmware := firmware[:magicLen], firmware[magicLen:]
	sigData, firmware := firmware[:sigDataLen], firmware[sigDataLen:]

	expectedMagic, ok := sigDataMagic[device.product]
	if !ok {
		return nil, nil, errp.New("unrecognized product")
	}
	if binary.BigEndian.Uint32(magic) != expectedMagic {
		return nil, nil, errp.New("invalid signing pubkeys data magic")
	}
	return sigData, firmware, nil
}

// SignedFirmwareVersion returns the monotonic firmware version contained in the signed firmware
// format.
func (device *Device) SignedFirmwareVersion(firmware []byte) (uint32, error) {
	sigData, _, err := device.parseSignedFirmware(firmware)
	if err != nil {
		return 0, err
	}
	return binary.LittleEndian.Uint32(sigData[signingPubkeysDataLen:][:4]), nil

}

func (device *Device) flashSignedFirmware(firmware []byte, progressCallback func(float64)) error {
	sigData, firmware, err := device.parseSignedFirmware(firmware)
	if err != nil {
		return err
	}
	if err := device.flashUnsignedFirmware(firmware, progressCallback); err != nil {
		return err
	}
	// write sig data
	if _, err := device.query('s', sigData); err != nil {
		return err
	}
	return nil
}

// UpgradeFirmware uploads a signed bitbox02 firmware release to the device.
func (device *Device) UpgradeFirmware(firmware []byte) error {
	if device.status.Upgrading {
		return errp.New("already in progress")
	}
	device.onStatusChanged(device.status)
	onProgress := func(progress float64) {
		device.status.Upgrading = true
		device.status.Progress = progress
		device.onStatusChanged(device.status)
	}
	err := device.flashSignedFirmware(firmware, onProgress)
	if err != nil {
		device.status.Upgrading = false
		device.status.ErrMsg = err.Error()
		device.onStatusChanged(device.status)
		return err
	}
	device.status.Progress = 0
	device.status.UpgradeSuccessful = true
	device.onStatusChanged(device.status)
	for seconds := 5; seconds > 0; seconds-- {
		device.status.RebootSeconds = seconds
		device.onStatusChanged(device.status)
		device.sleep(time.Second)
	}
	return device.Reboot()
}

// Erased returns true if the device contains no firmware.
func (device *Device) Erased() (bool, error) {
	// We check by comparing the device reported firmware hash. If erased, the firmware is all
	// '\xFF'.

	firmwareVersion, _, err := device.Versions()
	if err != nil {
		return false, err
	}
	firmwareVersionLE := make([]byte, 4)
	binary.LittleEndian.PutUint32(firmwareVersionLE, firmwareVersion)

	emptyFirmware := bytes.Repeat([]byte{0xFF}, maxFirmwareSize)

	doubleHash := func(b []byte) []byte {
		first := sha256.Sum256(b)
		second := sha256.Sum256(first[:])
		return second[:]
	}
	emptyFirmwareHash := doubleHash(append(firmwareVersionLE, emptyFirmware...))
	firmwareHash, _, err := device.GetHashes(false, false)
	if err != nil {
		return false, err
	}
	return bytes.Equal(firmwareHash, emptyFirmwareHash), nil
}
