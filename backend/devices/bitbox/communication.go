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
	"crypto/sha512"
	"encoding/base64"
	"encoding/json"
	"io"
	"unicode"

	"github.com/btcsuite/btcd/chaincfg/chainhash"
	"github.com/digitalbitbox/bitbox-wallet-app/util/crypto"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
	"github.com/digitalbitbox/bitbox-wallet-app/util/logging"
	"github.com/digitalbitbox/bitbox02-api-go/communication/u2fhid"
	"github.com/digitalbitbox/bitbox02-api-go/util/semver"
	"github.com/sirupsen/logrus"
)

const bitboxCMD = 0x80 + 0x40 + 0x01

// Communication implements CommunicationInterface.
type Communication struct {
	communication *u2fhid.Communication
	version       *semver.SemVer
	log           *logrus.Entry
}

// NewCommunication creates a new Communication instance.
func NewCommunication(
	device io.ReadWriteCloser,
	version *semver.SemVer,
	log *logrus.Entry,
) *Communication {
	return &Communication{
		communication: u2fhid.NewCommunication(device, bitboxCMD),
		version:       version,
		log:           log,
	}
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
		return NewError(errMsg, errCode)
	}
	return nil
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
	reply, err := communication.communication.Query([]byte(msg))
	if err != nil {
		return nil, err
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

func (dbb *Device) sendPlain(key, val string) (map[string]interface{}, error) {
	jsonText, err := json.Marshal(map[string]string{key: val})
	if err != nil {
		return nil, err
	}
	return dbb.communication.SendPlain(string(jsonText))
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

	hmac := communication.version.AtLeast(semver.NewSemVer(5, 0, 0))

	if hmac {
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
		if hmac {
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

// SendBootloader sends a message in the format the bootloader expects and fetches the response.
func (communication *Communication) SendBootloader(msg []byte) ([]byte, error) {
	const (
		// the bootloader expects 4098 bytes as one message.
		sendLen = 4098
		// the bootloader sends 256 bytes as a response.
		readLen = 256
	)

	usbWriteReportSize := 64
	usbReadReportSize := 64
	if !communication.version.AtLeast(semver.NewSemVer(3, 0, 0)) {
		// Bootloader 3.0.0 changed to composite USB. Since then, the report lengths are 65/65,
		// not 4099/256 (including report ID).  See dev->output_report_length at
		// https://github.com/signal11/hidapi/blob/a6a622ffb680c55da0de787ff93b80280498330f/windows/hid.c#L626
		usbWriteReportSize = 4098
		usbReadReportSize = 256
	}

	if len(msg) > sendLen {
		communication.log.WithFields(logrus.Fields{"message-length": len(msg),
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
		_, err := communication.communication.Write(chunk)
		if err != nil {
			return nil, errp.WithStack(err)
		}
		written += chunkLen
	}

	read := bytes.NewBuffer([]byte{})
	for read.Len() < readLen {
		currentRead := make([]byte, usbReadReportSize)
		readLen, err := communication.communication.Read(currentRead)
		if err != nil {
			return nil, errp.WithStack(err)
		}
		read.Write(currentRead[:readLen])
	}
	return bytes.TrimRight(read.Bytes(), "\x00\t\r\n"), nil
}

// Close implements CommunicationInterface.
func (communication *Communication) Close() {
	communication.communication.Close()
}
