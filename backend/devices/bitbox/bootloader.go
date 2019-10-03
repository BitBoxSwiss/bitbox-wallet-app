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

package bitbox

import (
	"bytes"
	"encoding/hex"
	"io"
	"log"
	"math"
	"runtime"

	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
	"github.com/digitalbitbox/bitbox-wallet-app/util/semver"
	"github.com/sirupsen/logrus"
)

const (
	bootloaderMaxChunkSize = 8 * 512
	signaturesSize         = 64 * 7 // 7 signatures à 64 bytes
)

// BootloaderStatus has all the info to handle the bootloader mode.
type BootloaderStatus struct {
	Upgrading         bool    `json:"upgrading"`
	Progress          float64 `json:"progress"`
	UpgradeSuccessful bool    `json:"upgradeSuccessful"`
	ErrMsg            string  `json:"errMsg"`
}

// sendBootloader sends a message in the format the bootloader expects and fetches the response.
func (dbb *Device) sendBootloader(msg []byte) ([]byte, error) {
	if dbb.bootloaderStatus == nil {
		return nil, errp.New("device is not in bootloader mode")
	}
	dbb.communicationMutex.Lock()
	defer dbb.communicationMutex.Unlock()
	const (
		// the bootloader expects 4098 bytes as one message.
		sendLen = 4098
		// the bootloader sends 256 bytes as a response.
		readLen = 256
	)

	usbWriteReportSize := 64
	usbReadReportSize := 64
	if !dbb.version.AtLeast(semver.NewSemVer(3, 0, 0)) {
		// Bootloader 3.0.0 changed to composite USB. Since then, the report lengths are 65/65,
		// not 4099/256 (including report ID).  See dev->output_report_length at
		// https://github.com/signal11/hidapi/blob/a6a622ffb680c55da0de787ff93b80280498330f/windows/hid.c#L626
		usbWriteReportSize = 4098
		usbReadReportSize = 256
	}

	if len(msg) > sendLen {
		dbb.log.WithFields(logrus.Fields{"message-length": len(msg),
			"max-send-length": sendLen}).Panic("Message too long")
		panic("message too long")
	}

	paddedMsg := bytes.NewBuffer([]byte{})
	paddedMsg.Write(msg)
	paddedMsg.Write(bytes.Repeat([]byte{0}, sendLen-len(msg)))
	// reset so we can read from it.
	paddedMsg = bytes.NewBuffer(paddedMsg.Bytes())

	written := 0
	for written < sendLen {
		chunk := paddedMsg.Next(usbWriteReportSize)
		chunkLen := len(chunk)
		if runtime.GOOS != "windows" {
			// packets have a 0 byte report ID in front. The karalabe hid library adds it
			// automatically for windows, and not for unix, as there, it is stripped by the signal11
			// hid library.  Since we are padding with zeroes, we have to add it (to be stripped by
			// signal11), as otherwise, it would strip our 0 byte that is just padding.
			chunk = append([]byte{0}, chunk...)
		}
		_, err := dbb.communication.Write(chunk)
		if err != nil {
			return nil, errp.WithStack(err)
		}
		written += chunkLen
	}

	read := bytes.NewBuffer([]byte{})
	for read.Len() < readLen {
		currentRead := make([]byte, usbReadReportSize)
		readLen, err := dbb.communication.Read(currentRead)
		if err != nil {
			return nil, errp.WithStack(err)
		}
		read.Write(currentRead[:readLen])
	}
	return bytes.TrimRight(read.Bytes(), "\x00\t\r\n"), nil
}

// BootloaderStatus returns the progress of a firmware upgrade. Returns an error if the device is
// not in bootloader mode.
func (dbb *Device) BootloaderStatus() (*BootloaderStatus, error) {
	if dbb.bootloaderStatus == nil {
		return nil, errp.New("device is not in bootloader mode")
	}
	return dbb.bootloaderStatus, nil
}

func (dbb *Device) bootloaderSendCmd(cmd rune, data []byte) error {
	var buf bytes.Buffer
	buf.WriteRune(cmd)
	buf.Write(data)
	reply, err := dbb.sendBootloader(buf.Bytes())
	if err != nil {
		return err
	}
	if reply[0] != byte(cmd) || (len(reply) > 1 && rune(reply[1]) != '0') {
		return errp.WithContext(errp.New("Unexpected reply"), errp.Context{
			"reply": reply,
		})
	}
	return nil
}

func (dbb *Device) bootloaderSendChunk(chunkNum byte, data []byte) error {
	if len(data) > bootloaderMaxChunkSize {
		dbb.log.Panic("Invalid length")
		panic("invalid length")
	}
	var buf bytes.Buffer
	buf.WriteByte(chunkNum)
	buf.Write(data)
	buf.Write(bytes.Repeat([]byte{0xFF}, bootloaderMaxChunkSize-len(data)))
	err := dbb.bootloaderSendCmd('w', buf.Bytes())
	return err
}

func (dbb *Device) bootloaderSendSigs(sigs []byte) error {
	if len(sigs) != signaturesSize {
		dbb.log.Panic("need 7 sigs à 64 bytes")
		panic("need 7 sigs à 64 bytes")
	}
	var buf bytes.Buffer
	buf.WriteRune('0')
	buf.WriteString(hex.EncodeToString(sigs))
	err := dbb.bootloaderSendCmd('s', buf.Bytes())
	return err
}

func (dbb *Device) bootloaderSendBin(bin []byte) error {
	buf := bytes.NewBuffer(bin)
	totalChunks := int(math.Ceil(float64(buf.Len()) / float64(bootloaderMaxChunkSize)))
	chunkNum := byte(0)
	for {
		chunk := make([]byte, bootloaderMaxChunkSize)
		readLen, err := buf.Read(chunk)
		if readLen == 0 || err == io.EOF {
			break
		}
		if err != nil {
			return err
		}
		if err := dbb.bootloaderSendChunk(chunkNum, chunk[:readLen]); err != nil {
			return err
		}
		chunkNum++

		dbb.bootloaderStatus.Progress = float64(chunkNum) / float64(totalChunks)
		dbb.fireEvent(EventBootloaderStatusChanged, nil)
		log.Printf("firmware upgrade progress: %f\n", dbb.bootloaderStatus.Progress)
		if chunkNum == 0 {
			return errp.New("firmware file too big")
		}
	}
	return nil
}

// BootloaderUpgradeFirmware uploads a signed bitbox firmware release to the device. Returns an
// error if the device is not in bootloader mode.
// See https://github.com/digitalbitbox/mcu/releases
func (dbb *Device) BootloaderUpgradeFirmware(signedFirmware []byte) error {
	if dbb.bootloaderStatus == nil {
		return errp.New("device is not in bootloader mode")
	}
	if dbb.bootloaderStatus.Upgrading {
		return errp.New("already in progress")
	}

	dbb.bootloaderStatus.Progress = 0
	dbb.bootloaderStatus.Upgrading = true
	dbb.fireEvent(EventBootloaderStatusChanged, nil)
	err := func() error {
		// Erase the firmware (required).
		if err := dbb.bootloaderSendCmd('e', nil); err != nil {
			return err
		}
		sigs, firmware := signedFirmware[:signaturesSize], signedFirmware[signaturesSize:]
		if err := dbb.bootloaderSendBin(firmware); err != nil {
			return err
		}
		if err := dbb.bootloaderSendSigs(sigs); err != nil {
			return errp.New("firmware did not pass the signature verification")
		}
		return nil
	}()
	if err != nil {
		dbb.bootloaderStatus.Upgrading = false
		dbb.bootloaderStatus.ErrMsg = err.Error()
		dbb.fireEvent(EventBootloaderStatusChanged, nil)
		return err
	}
	dbb.bootloaderStatus.Progress = 0
	dbb.bootloaderStatus.UpgradeSuccessful = true
	dbb.fireEvent(EventBootloaderStatusChanged, nil)
	return nil
}
