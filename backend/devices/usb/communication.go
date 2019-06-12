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

package usb

import (
	"bytes"
	"crypto/sha512"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"io"
	"runtime"
	"sync"
	"unicode"

	"github.com/btcsuite/btcd/chaincfg/chainhash"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/devices/bitbox"
	"github.com/digitalbitbox/bitbox-wallet-app/util/crypto"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
	"github.com/digitalbitbox/bitbox-wallet-app/util/logging"
	"github.com/sirupsen/logrus"
)

const (
	hwwCID = 0xff000000
)

func newBuffer() *bytes.Buffer {
	// This needs to be allocated exactly like this (not with nil or new(bytes.Buffer) etc), so that
	// the memory address of the actual bytes does not change.
	// See https://github.com/golang/go/issues/14210#issuecomment-370468469
	return bytes.NewBuffer([]byte{})
}

// Communication encodes JSON messages to/from a bitbox. The serialized messages are sent/received
// as USB packets, following the ISO 7816-4 standard.
type Communication struct {
	device             io.ReadWriteCloser
	mutex              sync.Mutex
	log                *logrus.Entry
	usbWriteReportSize int
	usbReadReportSize  int
	usbCMD             byte
	hmac               bool
}

// CommunicationErr is returned if there was an error with the device IO.
type CommunicationErr error

// NewCommunication creates a new Communication.
func NewCommunication(
	device io.ReadWriteCloser,
	usbWriteReportSize,
	usbReadReportSize int,
	usbCMD byte,
	hmac bool) *Communication {
	return &Communication{
		device:             device,
		mutex:              sync.Mutex{},
		log:                logging.Get().WithGroup("usb"),
		usbWriteReportSize: usbWriteReportSize,
		usbReadReportSize:  usbReadReportSize,
		usbCMD:             usbCMD,
		hmac:               hmac,
	}
}

// Close closes the underlying device.
func (communication *Communication) Close() {
	if err := communication.device.Close(); err != nil {
		communication.log.WithError(err).Panic(err)
		panic(err)
	}
}

// SendFrame sends one usb message.
func (communication *Communication) SendFrame(msg string) error {
	communication.mutex.Lock()
	defer communication.mutex.Unlock()
	return communication.sendFrame(msg)
}

func (communication *Communication) sendFrame(msg string) error {
	dataLen := len(msg)
	if dataLen == 0 {
		return nil
	}
	send := func(header []byte, readFrom *bytes.Buffer) error {
		buf := newBuffer()
		buf.Write(header)
		buf.Write(readFrom.Next(communication.usbWriteReportSize - buf.Len()))
		for buf.Len() < communication.usbWriteReportSize {
			buf.WriteByte(0xee)
		}
		x := buf.Bytes() // needs to be in a var: https://github.com/golang/go/issues/14210#issuecomment-346402945
		_, err := communication.device.Write(x)
		return errp.WithMessage(errp.WithStack(err), "Failed to send message")
	}
	readBuffer := bytes.NewBuffer([]byte(msg))
	// init frame
	header := newBuffer()
	if err := binary.Write(header, binary.BigEndian, uint32(hwwCID)); err != nil {
		return errp.WithStack(err)
	}
	if err := binary.Write(header, binary.BigEndian, communication.usbCMD); err != nil {
		return errp.WithStack(err)
	}
	if err := binary.Write(header, binary.BigEndian, uint16(dataLen&0xFFFF)); err != nil {
		return errp.WithStack(err)
	}
	if err := send(header.Bytes(), readBuffer); err != nil {
		return err
	}
	for seq := 0; readBuffer.Len() > 0; seq++ {
		// cont frame
		header = newBuffer()
		if err := binary.Write(header, binary.BigEndian, uint32(hwwCID)); err != nil {
			return errp.WithStack(err)
		}
		if err := binary.Write(header, binary.BigEndian, uint8(seq)); err != nil {
			return errp.WithStack(err)
		}
		if err := send(header.Bytes(), readBuffer); err != nil {
			return err
		}
	}
	return nil
}

// ReadFrame reads one usb message.
func (communication *Communication) ReadFrame() ([]byte, error) {
	communication.mutex.Lock()
	defer communication.mutex.Unlock()
	return communication.readFrame()
}

func (communication *Communication) readFrame() ([]byte, error) {
	read := make([]byte, communication.usbReadReportSize)
	readLen, err := communication.device.Read(read)
	if err != nil {
		return nil, errp.WithStack(err)
	}
	if readLen < 7 {
		return nil, errp.New("expected minimum read length of 7")
	}
	if read[0] != 0xff || read[1] != 0 || read[2] != 0 || read[3] != 0 {
		return nil, errp.Newf("USB command ID mismatch %d %d %d %d", read[0], read[1], read[2], read[3])
	}
	if read[4] != communication.usbCMD {
		return nil, errp.Newf("USB command frame mismatch (%d, expected %d)", read[4], communication.usbCMD)
	}
	data := newBuffer()
	dataLen := int(read[5])*256 + int(read[6])
	data.Write(read[7:readLen])
	idx := len(read) - 7
	for idx < dataLen {
		readLen, err = communication.device.Read(read)
		if err != nil {
			return nil, errp.WithStack(err)
		}
		if readLen < 5 {
			return nil, errp.New("expected minimum read length of 7")
		}
		data.Write(read[5:readLen])
		idx += readLen - 5
	}
	return data.Bytes()[:dataLen], nil
}

// SendBootloader sends a message in the format the bootloader expects and fetches the response.
func (communication *Communication) SendBootloader(msg []byte) ([]byte, error) {
	communication.mutex.Lock()
	defer communication.mutex.Unlock()
	const (
		// the bootloader expects 4098 bytes as one message.
		sendLen = 4098
		// the bootloader sends 256 bytes as a response.
		readLen = 256
	)
	if len(msg) > sendLen {
		communication.log.WithFields(logrus.Fields{"message-length": len(msg),
			"max-send-length": sendLen}).Panic("Message too long")
		panic("message too long")
	}

	paddedMsg := newBuffer()
	paddedMsg.Write(msg)
	paddedMsg.Write(bytes.Repeat([]byte{0}, sendLen-len(msg)))
	// reset so we can read from it.
	paddedMsg = bytes.NewBuffer(paddedMsg.Bytes())

	written := 0
	for written < sendLen {
		chunk := paddedMsg.Next(communication.usbWriteReportSize)
		chunkLen := len(chunk)
		if runtime.GOOS != "windows" {
			// packets have a 0 byte report ID in front. The karalabe hid library adds it
			// automatically for windows, and not for unix, as there, it is stripped by the signal11
			// hid library.  Since we are padding with zeroes, we have to add it (to be stripped by
			// signal11), as otherwise, it would strip our 0 byte that is just padding.
			chunk = append([]byte{0}, chunk...)
		}
		_, err := communication.device.Write(chunk)
		if err != nil {
			return nil, errp.WithStack(err)
		}
		written += chunkLen
	}

	read := newBuffer()
	for read.Len() < readLen {
		currentRead := make([]byte, communication.usbReadReportSize)
		readLen, err := communication.device.Read(currentRead)
		if err != nil {
			return nil, errp.WithStack(err)
		}
		read.Write(currentRead[:readLen])
	}
	return bytes.TrimRight(read.Bytes(), "\x00\t\r\n"), nil
}

func hideValues(cmd map[string]interface{}) {
	for k, v := range cmd {
		value, ok := v.(map[string]interface{})
		if ok {
			hideValues(value)
		} else {
			cmd[k] = "****"
		}
	}
}

func logCensoredCmd(log *logrus.Entry, msg string, receiving bool) error {
	if logging.Get().Level >= logrus.DebugLevel {
		cmd := map[string]interface{}{}
		if err := json.Unmarshal([]byte(msg), &cmd); err != nil {
			return errp.New("Failed to unmarshal message")
		}
		hideValues(cmd)
		censoredMsg, err := json.Marshal(cmd)
		if err != nil {
			log.WithError(err).Error("Failed to censor message")
		} else {
			direction := "Sending"
			if receiving {
				direction = "Receiving"
			}
			log.WithField("msg", string(censoredMsg)).Infof("%s message", direction)
		}
	}
	return nil
}

// SendPlain sends an unecrypted message. The response is json-deserialized into a map.
func (communication *Communication) SendPlain(msg string) (map[string]interface{}, error) {
	if err := logCensoredCmd(communication.log, msg, false); err != nil {
		communication.log.WithField("msg", msg).Debug("Sending (encrypted) command")
	}
	communication.mutex.Lock()
	defer communication.mutex.Unlock()
	if err := communication.sendFrame(msg); err != nil {
		return nil, CommunicationErr(err)
	}
	reply, err := communication.readFrame()
	if err != nil {
		return nil, CommunicationErr(err)
	}
	reply = bytes.TrimRightFunc(reply, func(r rune) bool { return unicode.IsSpace(r) || r == 0 })
	err = logCensoredCmd(communication.log, string(reply), true)
	if err != nil {
		return nil, errp.WithContext(err, errp.Context{"reply": string(reply)})
	}
	jsonResult := map[string]interface{}{}
	if err := json.Unmarshal(reply, &jsonResult); err != nil {
		return nil, errp.Wrap(err, "Failed to unmarshal reply")
	}
	if err := maybeDBBErr(jsonResult); err != nil {
		return nil, err
	}
	return jsonResult, nil
}

func maybeDBBErr(jsonResult map[string]interface{}) error {
	if errMap, ok := jsonResult["error"].(map[string]interface{}); ok {
		errMsg, ok := errMap["message"].(string)
		if !ok {
			return errp.WithContext(errp.New("Unexpected reply"), errp.Context{"reply": errMap})
		}
		errCode, ok := errMap["code"].(float64)
		if !ok {
			return errp.WithContext(errp.New("Unexpected reply"), errp.Context{"reply": errMap})
		}
		return bitbox.NewError(errMsg, errCode)
	}
	return nil
}

// SendEncrypt sends an encrypted message. The response is json-deserialized into a map. If the
// response contains an error field, it is returned as a DBBErr.
func (communication *Communication) SendEncrypt(msg, password string) (map[string]interface{}, error) {
	if err := logCensoredCmd(communication.log, msg, false); err != nil {
		return nil, errp.WithMessage(err, "Invalid JSON passed. Continuing anyway")
	}
	secret := chainhash.DoubleHashB([]byte(password))
	h := sha512.Sum512(secret)
	encKey, authKey := h[:32], h[32:]
	var cipherText []byte
	if communication.hmac {
		var err error
		cipherText, err = crypto.EncryptThenMAC([]byte(msg), encKey, authKey)
		if err != nil {
			return nil, errp.WithMessage(err, "Failed to encrypt command")
		}
	} else {
		var err error
		cipherText, err = crypto.Encrypt([]byte(msg), secret)
		if err != nil {
			return nil, errp.WithMessage(err, "Failed to encrypt command")
		}
	}
	jsonResult, err := communication.SendPlain(base64.StdEncoding.EncodeToString(cipherText))
	if err != nil {
		return nil, errp.WithMessage(err, "Failed to send cipher text")
	}
	if cipherText, ok := jsonResult["ciphertext"].(string); ok {
		decodedMsg, err := base64.StdEncoding.DecodeString(cipherText)
		if err != nil {
			return nil, errp.WithMessage(err, "Failed to decode reply")
		}
		var plainText []byte
		if communication.hmac {
			var err error
			plainText, err = crypto.MACThenDecrypt(decodedMsg, encKey, authKey)
			if err != nil {
				return nil, errp.WithMessage(err, "Failed to decrypt reply")
			}
		} else {
			var err error
			plainText, err = crypto.Decrypt(decodedMsg, secret)
			if err != nil {
				return nil, errp.WithMessage(err, "Failed to decrypt reply")
			}
		}
		err = logCensoredCmd(communication.log, string(plainText), true)
		if err != nil {
			return nil, errp.WithContext(err, errp.Context{"reply": string(plainText)})
		}
		jsonResult = map[string]interface{}{}
		if err := json.Unmarshal(plainText, &jsonResult); err != nil {
			return nil, errp.Wrap(err, "Failed to unmarshal reply")
		}
	}
	if err := maybeDBBErr(jsonResult); err != nil {
		return nil, err
	}
	return jsonResult, nil
}
