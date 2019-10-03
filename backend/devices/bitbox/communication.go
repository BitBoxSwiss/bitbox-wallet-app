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
	"unicode"

	"github.com/btcsuite/btcd/chaincfg/chainhash"
	"github.com/digitalbitbox/bitbox-wallet-app/util/crypto"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
	"github.com/digitalbitbox/bitbox-wallet-app/util/logging"
	"github.com/digitalbitbox/bitbox-wallet-app/util/semver"
	"github.com/sirupsen/logrus"
)

// CommunicationErr is returned if there was an error with the device IO.
type CommunicationErr error

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

// sendPlain sends an unecrypted message. The response is json-deserialized into a map.
func (dbb *Device) sendPlainMsg(msg string) (map[string]interface{}, error) {
	if err := logCensoredCmd(dbb.log, msg, false); err != nil {
		dbb.log.WithField("msg", msg).Debug("Sending (encrypted) command")
	}
	dbb.communicationMutex.Lock()
	defer dbb.communicationMutex.Unlock()
	if err := dbb.communication.SendFrame(msg); err != nil {
		return nil, CommunicationErr(err)
	}
	reply, err := dbb.communication.ReadFrame()
	if err != nil {
		return nil, CommunicationErr(err)
	}
	reply = bytes.TrimRightFunc(reply, func(r rune) bool { return unicode.IsSpace(r) || r == 0 })
	err = logCensoredCmd(dbb.log, string(reply), true)
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
	return dbb.sendPlainMsg(string(jsonText))
}

// sendEncrypt sends an encrypted message. The response is json-deserialized into a map. If the
// response contains an error field, it is returned as a DBBErr.
func (dbb *Device) sendEncrypt(msg, password string) (map[string]interface{}, error) {
	if err := logCensoredCmd(dbb.log, msg, false); err != nil {
		return nil, errp.WithMessage(err, "Invalid JSON passed. Continuing anyway")
	}
	secret := chainhash.DoubleHashB([]byte(password))
	h := sha512.Sum512(secret)
	encKey, authKey := h[:32], h[32:]
	var cipherText []byte

	hmac := dbb.version.AtLeast(semver.NewSemVer(5, 0, 0))

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
	jsonResult, err := dbb.sendPlainMsg(base64.StdEncoding.EncodeToString(cipherText))
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
		err = logCensoredCmd(dbb.log, string(plainText), true)
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
