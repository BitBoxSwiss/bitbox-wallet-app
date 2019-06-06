// Copyright 2018 Shift Devices AG
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

// Package bitbox02bootloader contains the API to the physical device.
package bitbox02bootloader

import (
	"bytes"
	"crypto/sha256"
	"encoding/binary"
	"io"
	"math"
	"sync"
	"time"

	"github.com/digitalbitbox/bitbox-wallet-app/backend/devices/device"
	devicepkg "github.com/digitalbitbox/bitbox-wallet-app/backend/devices/device"
	keystoreInterface "github.com/digitalbitbox/bitbox-wallet-app/backend/keystore"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/signing"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
	"github.com/digitalbitbox/bitbox-wallet-app/util/logging"
	"github.com/digitalbitbox/bitbox-wallet-app/util/semver"
	"github.com/sirupsen/logrus"
)

const (
	chunkSize       = 8 * 512
	maxFirmwareSize = 884736
	// max number of chunks that can be written when flashing the firmware
	firmwareChunks = maxFirmwareSize / chunkSize

	numRootKeys    = 5
	numSigningKeys = 5

	sigDataMagic          uint32 = 0x653f362b
	magicLen                     = 4
	versionLen                   = 4
	signingPubkeysDataLen        = versionLen + numSigningKeys*64 + numRootKeys*64
	firmwareDataLen              = versionLen + numSigningKeys*64
	sigDataLen                   = signingPubkeysDataLen + firmwareDataLen
)

// ProductName is the name of the BitBox02 bootloader product.
const ProductName = "bitbox02-bootloader"

// Communication contains functions needed to communicate with the device.
type Communication interface {
	SendFrame(string) error
	ReadFrame() ([]byte, error)
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

// EventStatusChanged is fired when the status changes. Check the status using Status().
const EventStatusChanged device.Event = "statusChanged"

func toByte(b bool) byte {
	if b {
		return 1
	}
	return 0
}

// Device provides the API to communicate with the BitBox02 bootloader.
type Device struct {
	deviceID      string
	communication Communication
	status        *Status

	mu      sync.RWMutex
	onEvent func(devicepkg.Event, interface{})
	log     *logrus.Entry
}

// NewDevice creates a new instance of Device.
func NewDevice(
	deviceID string,
	version *semver.SemVer,
	communication Communication,
) *Device {
	log := logging.Get().WithGroup("device").WithField("deviceID", deviceID)
	log.Info("Plugged in device")
	return &Device{
		deviceID:      deviceID,
		communication: communication,
		status:        &Status{},
		log:           log.WithField("deviceID", deviceID).WithField("productName", ProductName),
	}
}

// Init implements device.Device.
func (device *Device) Init(testing bool) {
}

// ProductName implements device.Device.
func (device *Device) ProductName() string {
	return ProductName
}

// Identifier implements device.Device.
func (device *Device) Identifier() string {
	return device.deviceID
}

// KeystoreForConfiguration implements device.Device.
func (device *Device) KeystoreForConfiguration(configuration *signing.Configuration, cosignerIndex int) keystoreInterface.Keystore {
	panic("not supported")
}

// SetOnEvent implements device.Device.
func (device *Device) SetOnEvent(onEvent func(devicepkg.Event, interface{})) {
	device.mu.Lock()
	defer device.mu.Unlock()
	device.onEvent = onEvent
}

func (device *Device) fireEvent() {
	device.mu.RLock()
	f := device.onEvent
	device.mu.RUnlock()
	if f != nil {
		f(EventStatusChanged, nil)
	}
}

// Close implements device.Device.
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
	if err := device.communication.SendFrame(buf.String()); err != nil {
		return nil, err
	}
	reply, err := device.communication.ReadFrame()
	if err != nil {
		return nil, err
	}
	if reply[0] != byte(cmd) || len(reply) < 2 || reply[1] != 0 {
		return nil, errp.WithContext(errp.New("Unexpected reply"), errp.Context{
			"reply": reply,
		})
	}
	return reply[2:], nil
}

// Versions queries the device for the firmware and signing pubkeys version.
func (device *Device) Versions() (uint32, uint32, error) {
	response, err := device.query('v', nil)
	if err != nil {
		return 0, 0, err
	}
	firmwareVersion := binary.LittleEndian.Uint32(response[:4])
	signingPubkeysVersion := binary.LittleEndian.Uint32(response[4:8])
	return firmwareVersion, signingPubkeysVersion, err
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
		return errp.New("chunk must max 4kB")
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
	if progressCallback != nil {
		progressCallback(0)
	}
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
		if progressCallback != nil {
			progressCallback(float64(chunkNum) / float64(totalChunks))
		}
	}
	return nil
}

func (device *Device) flashSignedFirmware(firmware []byte, progressCallback func(float64)) error {
	if len(firmware) <= magicLen+sigDataLen {
		return errp.New("firmware too small")
	}
	magic, firmware := firmware[:magicLen], firmware[magicLen:]
	sigData, firmware := firmware[:sigDataLen], firmware[sigDataLen:]
	if binary.BigEndian.Uint32(magic) != sigDataMagic {
		return errp.New("invalid signing pubkeys data magic")
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
func (device *Device) UpgradeFirmware() error {
	if device.status.Upgrading {
		return errp.New("already in progress")
	}
	device.log.Info("upgrading firmware")
	device.fireEvent()
	onProgress := func(progress float64) {
		device.status.Upgrading = true
		device.status.Progress = progress
		device.fireEvent()
	}
	err := device.flashSignedFirmware(bundledFirmware(), onProgress)
	if err != nil {
		device.status.Upgrading = false
		device.status.ErrMsg = err.Error()
		device.fireEvent()
		return err
	}
	device.status.Progress = 0
	device.status.UpgradeSuccessful = true
	device.fireEvent()
	for seconds := 5; seconds > 0; seconds-- {
		device.status.RebootSeconds = seconds
		device.fireEvent()
		time.Sleep(time.Second)
	}
	return device.Reboot()
}

// Erased returns true if the the device contains no firmware.
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
