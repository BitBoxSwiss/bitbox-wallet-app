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

package relay

import (
	"encoding/json"
	"time"

	"github.com/digitalbitbox/bitbox-wallet-app/util/locker"

	"github.com/btcsuite/btcutil/base58"
	"github.com/digitalbitbox/bitbox-wallet-app/util/logging"
	"github.com/digitalbitbox/bitbox-wallet-app/util/random"
	"github.com/sirupsen/logrus"

	"github.com/digitalbitbox/bitbox-wallet-app/util/config"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
)

const (
	// configFileName stores the name of the config file that contains the pairing information.
	configFileName = "channel.json"
)

// Channel implements an encrypted communication channel between the desktop and the paired mobile.
type Channel struct {
	// ChannelID is the identifier which uniquely identifies the channel between the parties.
	ChannelID string `json:"id"`

	// EncryptionKey is used to encrypt the communication between the desktop and the mobile.
	EncryptionKey []byte `json:"key"`

	// AuthenticationKey is used to authenticate messages between the desktop and the mobile.
	AuthenticationKey []byte `json:"mac"`

	// messageBuffer buffers the messages that were not expected by the caller of waitForValue.
	messageBuffer [][]byte

	// messageBufferLock guards the message buffer.
	messageBufferLock locker.Locker

	log *logrus.Entry
}

// NewChannel returns a new channel with the given channel ID, encryption and authentication key.
func NewChannel(channelID string, encryptionKey []byte, authenticationKey []byte) *Channel {
	return &Channel{
		ChannelID:         channelID,
		EncryptionKey:     encryptionKey,
		AuthenticationKey: authenticationKey,
		log:               logging.Get().WithGroup("channel"),
	}
}

// NewChannelWithRandomKey returns a new channel with a random encryption key and identifier.
func NewChannelWithRandomKey() *Channel {
	channelID := random.BytesOrPanic(32)
	encryptionKey := random.BytesOrPanic(32)
	authenticationKey := random.BytesOrPanic(32)

	// The channel identifier may not contain '=' and thus it cannot be encoded with base64.
	return NewChannel(base58.Encode(channelID), encryptionKey, authenticationKey)
}

// NewChannelFromConfigFile returns a new channel with the channel identifier and encryption key
// from the config file or nil if the config file does not exist.
func NewChannelFromConfigFile() *Channel {
	configFile := config.NewFile(configFileName)
	if configFile.Exists() {
		var configuration configuration
		if err := configFile.ReadJSON(&configuration); err != nil {
			return nil
		}
		return configuration.channel()
	}
	return nil
}

// StoreToConfigFile stores the channel to the config file.
func (channel *Channel) StoreToConfigFile() error {
	configuration := newConfiguration(channel)
	configFile := config.NewFile(configFileName)
	return configFile.WriteJSON(configuration)
}

// RemoveConfigFile removes the config file.
func (channel *Channel) RemoveConfigFile() error {
	return config.NewFile(configFileName).Remove()
}

// relayServer returns the configured relay server.
// The server is hardcoded for now but can be loaded from the settings in the future.
func relayServer() Server {
	return DefaultServer
}

// getValueFromMessage returns the value of the field in the message and true, if found, or
// an empty string and false, if not found.
func (channel *Channel) getValueFromMessage(message []byte, name string) (string, bool) {
	var object map[string]string
	err := json.Unmarshal(message, &object)
	var value, present = object[name]
	if err != nil || !present {
		return "", false
	}
	return value, true
}

// waitForValue waits for the given duration for the value with the given name from the mobile.
// Returns an error if no value with the given name has been received in the given duration.
func (channel *Channel) waitForValue(duration time.Duration, name string) (string, error) {
	deadline := time.Now().Add(duration)
	for {
		unlock := channel.messageBufferLock.Lock()
		var message []byte
		var value string
		var found bool
		indexIntoBuffer := -1
		for i, bufferedMsg := range channel.messageBuffer {
			value, found = channel.getValueFromMessage(bufferedMsg, name)
			indexIntoBuffer = i
			if found {
				channel.log.Debugf("Processed buffered message %s and found value: %s", string(message), value)
				break
			}
		}
		if found {
			if indexIntoBuffer < len(channel.messageBuffer) {
				channel.messageBuffer = append(channel.messageBuffer[:indexIntoBuffer], channel.messageBuffer[indexIntoBuffer+1:]...)
			} else {
				channel.messageBuffer = channel.messageBuffer[:indexIntoBuffer]
			}
			channel.log.Debugf("Removing message %s from buffer: %v", string(message), len(channel.messageBuffer))
			unlock()
		} else {
			unlock()
			message, err := PullOldestMessage(relayServer(), channel)
			if err != nil {
				return "", err
			}
			if message == nil {
				if time.Now().Before(deadline) {
					continue
				}
				return "", errp.New("Did not receive a response from the mobile in the given duration.")
			}
			value, found = channel.getValueFromMessage(message, name)
			if !found {
				unlock := channel.messageBufferLock.Lock()
				channel.messageBuffer = append(channel.messageBuffer, message)
				channel.log.Debugf("Added message %s to buffer: %v", string(message), len(channel.messageBuffer))
				unlock()
				continue
			}
		}
		return value, nil
	}
}

// WaitForScanningSuccess waits for the given duration for the scanning success from the mobile.
// Returns nil if the scanning success was retrieved from the relay server and an error otherwise.
func (channel *Channel) WaitForScanningSuccess(duration time.Duration) error {
	value, err := channel.waitForValue(duration, "id")
	if err != nil {
		return err
	} else if value != "success" {
		return errp.New("Scanning unsuccessful")
	}
	return nil
}

// WaitForMobilePublicKeyHash waits for the given duration for the public key hash from the mobile.
// Returns an error if no public key hash has been received from the server in the given duration.
func (channel *Channel) WaitForMobilePublicKeyHash(duration time.Duration) (string, error) {
	return channel.waitForValue(duration, "hash_ecdh_pubkey")
}

// WaitForMobilePublicKey waits for the given duration for the ECDH public key from the mobile.
// Returns an error if no ECDH public key has been received from the server in the given duration.
func (channel *Channel) WaitForMobilePublicKey(duration time.Duration) (string, error) {
	return channel.waitForValue(duration, "ecdh_pubkey")
}

// WaitForCommand waits for the given duration for an ECDH command from mobile.
// Returns the command or an error if no command has been received in the given duration.
func (channel *Channel) WaitForCommand(duration time.Duration) (string, error) {
	channel.log.Debug("WaitForCommand")
	return channel.waitForValue(duration, "ecdh")
}

// SendHashPubKey sends the hash of the public key from the BitBox to the mobile to finish pairing.
func (channel *Channel) SendHashPubKey(verifyPass interface{}) error {
	return PushMessage(relayServer(), channel, map[string]interface{}{
		"ecdh": verifyPass,
	})
}

// SendPubKey sends the ECDH public key from the BitBox to the paired mobile to finish pairing.
func (channel *Channel) SendPubKey(verifyPass interface{}) error {
	return PushMessage(relayServer(), channel, map[string]interface{}{
		"ecdh": verifyPass,
	})
}

// SendPairingTest sends the encrypted test string from the BitBox to the paired mobile.
func (channel *Channel) SendPairingTest(tfaTestString string) error {
	return PushMessage(relayServer(), channel, map[string]string{
		"tfa": tfaTestString,
	})
}

// action describes the JSON object for actions like ping, pong and clear.
type action struct {
	Action string `json:"action"`
}

// SendPing sends a 'ping' to the paired mobile to which it automatically responds with 'pong'.
func (channel *Channel) SendPing() error {
	return PushMessage(relayServer(), channel, &action{"ping"})
}

// WaitForPong waits for the given duration for the 'pong' from the mobile after sending 'ping'.
// Returns nil if the pong was retrieved from the relay server and an error otherwise.
func (channel *Channel) WaitForPong(duration time.Duration) error {
	value, err := channel.waitForValue(duration, "action")
	if err != nil {
		return err
	} else if value != "pong" {
		return errp.New("Unexpected response for ping")
	}
	return nil
}

// SendClear clears the screen of the paired mobile.
func (channel *Channel) SendClear() error {
	return PushMessage(relayServer(), channel, &action{"clear"})
}

// SendXpubEcho sends the encrypted xpub echo from the BitBox to the paired mobile.
func (channel *Channel) SendXpubEcho(xpubEcho string, typ string) error {
	return PushMessage(relayServer(), channel, map[string]string{
		"echo": xpubEcho,
		"type": typ,
	})
}

// SendSigningEcho sends the encrypted signing echo from the BitBox to the paired mobile.
func (channel *Channel) SendSigningEcho(
	signingEcho string,
	coin string,
	scriptType string,
	transaction string,
) error {
	return PushMessage(relayServer(), channel, map[string]string{
		"echo":               signingEcho,
		"coin":               coin,
		"inputAndChangeType": scriptType,
		"tx":                 transaction,
	})
}

// WaitForSigningPin waits for the given duration for the 2FA signing PIN from the mobile.
// Returns an error if no 2FA signing PIN was available on the relay server in the given duration.
// Otherwise, the returned value is either the PIN (on confirmation) or "abort" (on cancel).
func (channel *Channel) WaitForSigningPin(duration time.Duration) (string, error) {
	return channel.waitForValue(duration, "pin")
}

// SendRandomNumberEcho sends the encrypted random number echo from the BitBox to the paired mobile.
func (channel *Channel) SendRandomNumberEcho(randomNumberEcho string) error {
	return PushMessage(relayServer(), channel, map[string]string{
		"echo": randomNumberEcho,
	})
}

// WaitForRandomNumberClear waits for the given duration for a random number clear from the mobile.
// Returns nil if a random number clear was retrieved from the relay server and an error otherwise.
func (channel *Channel) WaitForRandomNumberClear(duration time.Duration) error {
	value, err := channel.waitForValue(duration, "random")
	if err != nil {
		return err
	} else if value != "clear" {
		return errp.New("Unexpected response for random")
	}
	return nil
}
