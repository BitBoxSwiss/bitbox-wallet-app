// Copyright 2019 Shift Devices AG
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

//Package updater manages the connection with the bitboxbase, establishing a websocket listener and sending events when receiving packets.
package updater

import (
	"crypto/rand"
	"encoding/base32"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"regexp"

	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
	"github.com/digitalbitbox/bitbox-wallet-app/util/logging"
	"github.com/digitalbitbox/bitbox-wallet-app/util/observable"
	"github.com/digitalbitbox/bitbox-wallet-app/util/observable/action"
	"github.com/flynn/noise"

	"github.com/gorilla/websocket"
	"github.com/sirupsen/logrus"
)

const (
	opICanHasHandShaek          = "h"
	opICanHasPairinVerificashun = "v"
	responseSuccess             = "\x00"
	responseNeedsPairing        = "\x01"
)

// MiddlewareInfo holds some sample information from the BitBox Base
type MiddlewareInfo struct {
	Blocks         int64   `json:"blocks"`
	Difficulty     float64 `json:"difficulty"`
	LightningAlias string  `json:"lightningAlias"`
}

// Updater implements observable blockchainInfo.
type Updater struct {
	observable.Implementation
	middlewareInfo      *MiddlewareInfo
	log                 *logrus.Entry
	running             bool
	address             string
	bitboxBaseConfigDir string

	bitboxBaseNoiseStaticPubkey   []byte
	channelHash                   string
	channelHashAppVerified        bool
	channelHashBitBoxBaseVerified bool
	sendCipher, receiveCipher     *noise.CipherState
}

// MiddlewareInfo returns the last received blockchain information packet from the middleware
func (updater *Updater) MiddlewareInfo() interface{} {
	//TODO(TheCharlatan): Use a properly validated type instead of a generic interface
	return updater.middlewareInfo
}

// NewUpdater returns a new bitboxbase updater.
func NewUpdater(address string, bitboxBaseConfigDir string) *Updater {
	updater := &Updater{
		log:                 logging.Get().WithGroup("bitboxbase"),
		address:             address,
		middlewareInfo:      &MiddlewareInfo{},
		bitboxBaseConfigDir: bitboxBaseConfigDir,
	}
	return updater
}

// Connect starts the websocket go routine, first checking if the middleware is reachable,
// then establishing a websocket connection, then authenticating and encrypting all further traffic with noise.
func (updater *Updater) Connect(address string, bitboxBaseID string) error {
	response, err := http.Get("http://" + address + "/")
	if err != nil {
		updater.log.Println("No response from middleware", err)
		updater.running = false
		return err
	}

	if response.StatusCode != http.StatusOK {
		updater.log.Println("Received http status code from middleware other than 200")
		updater.running = false
		return err
	}

	bodyBytes, err := ioutil.ReadAll(response.Body)
	if err != nil {
		updater.running = false
		updater.log.Println("Body Bytes not read properly")
		return err
	}
	_, err = regexp.MatchString("OK!", string(bodyBytes))
	if err != nil {
		updater.running = false
		return errp.New("updater: Unexpected Response Body Bytes")
	}
	if err = response.Body.Close(); err != nil {
		return errp.New("updater: Failed to close Get Env response")
	}
	updater.running = true
	updater.log.Printf("connecting to base websocket")
	client, _, err := websocket.DefaultDialer.Dial("ws://"+updater.address+"/ws", nil)
	if err != nil {
		return errp.New("updater: failed to create new websocket client")
	}
	if err = updater.initializeNoise(client, bitboxBaseID); err != nil {
		return err
	}

	go listenWebsocket(client, updater, bitboxBaseID)
	return nil
}

// initializeNoise sets up a new noise connection. First a fresh keypair is generated if none is locally found.
// Afterwards a XX handshake is performed. This is a three part handshake required to authenticate both parties.
// The resulting pairing code is then displayed to the user to check if it matches what is displayed on the other party's device.
func (updater *Updater) initializeNoise(client *websocket.Conn, bitboxBaseID string) error {
	cipherSuite := noise.NewCipherSuite(noise.DH25519, noise.CipherChaChaPoly, noise.HashSHA256)
	keypair := updater.configGetAppNoiseStaticKeypair()
	if keypair == nil {
		updater.log.Info("noise static keypair created")
		kp, err := cipherSuite.GenerateKeypair(rand.Reader)
		if err != nil {
			return errp.New("unable to generate a new noise keypair for the wallet app communication with the BitBox Base")
		}
		keypair = &kp
		if err := updater.configSetAppNoiseStaticKeypair(keypair); err != nil {
			updater.log.WithError(err).Error("could not store app noise static keypair")
			// Not a critical error, ignore.
		}
	}
	handshake, err := noise.NewHandshakeState(noise.Config{
		CipherSuite:   cipherSuite,
		Random:        rand.Reader,
		Pattern:       noise.HandshakeXX,
		StaticKeypair: *keypair,
		Prologue:      []byte("Noise_XX_25519_ChaChaPoly_SHA256"),
		Initiator:     true,
	})
	if err != nil {
		return errp.New("failed to generate a new noise handshake state for the wallet app communication with the BitBox Base")
	}

	//Ask the BitBox Base to begin the noise 'XX' handshake
	err = client.WriteMessage(1, []byte(opICanHasHandShaek))
	if err != nil {
		return errp.New("unable to write BitBox Base Handshake request to websocket")
	}
	_, responseBytes, err := client.ReadMessage()
	if err != nil {
		return errp.New("unable to read BitBox Base Handshake response from websocket")
	}
	if string(responseBytes) != string(responseSuccess) {
		return errp.New("no ACK received from BitBox Base as response to hanshake request")
	}

	// Do 3 part noise 'XX' handshake.
	msg, _, _, err := handshake.WriteMessage(nil, nil)
	if err != nil {
		return errp.New("noise failed to write the first handshake message")
	}
	err = client.WriteMessage(websocket.BinaryMessage, msg)
	if err != nil {
		return errp.New("the websocket failed writing the first noise handshake message")
	}
	_, responseBytes, err = client.ReadMessage()
	if err != nil {
		return errp.New("the websocket failed reading the second noise handshake message")
	}
	_, _, _, err = handshake.ReadMessage(nil, responseBytes)
	if err != nil {
		return errp.New("noise failed to read the second handshake message")
	}
	msg, updater.receiveCipher, updater.sendCipher, err = handshake.WriteMessage(nil, nil)
	if err != nil {
		return errp.New("noise failed to write the third handshake message")
	}
	err = client.WriteMessage(websocket.BinaryMessage, msg)
	if err != nil {
		return errp.New("the websocket failed writing the third handshake message")
	}

	// Check if the user already authenticated the channel binding hash
	_, responseBytes, err = client.ReadMessage()
	if err != nil {
		return errp.New("the websocket failed writing the pairingVerificationRequiredByBitBoxBase message at the verification stage of the noise handshake")
	}

	updater.bitboxBaseNoiseStaticPubkey = handshake.PeerStatic()
	if len(updater.bitboxBaseNoiseStaticPubkey) != 32 {
		return errp.New("expected 32 byte remote static pubkey")
	}

	pairingVerificationRequiredByApp := !updater.configContainsBitBoxBaseStaticPubkey(
		updater.bitboxBaseNoiseStaticPubkey)
	pairingVerificationRequiredByBase := string(responseBytes) == responseNeedsPairing

	// Do the user verification of the channel binding hash if either the app or base require it
	if pairingVerificationRequiredByBase || pairingVerificationRequiredByApp {
		channelHashBase32 := base32.StdEncoding.EncodeToString(handshake.ChannelBinding())
		updater.channelHash = fmt.Sprintf(
			"%s %s\n%s %s",
			channelHashBase32[:5],
			channelHashBase32[5:10],
			channelHashBase32[10:15],
			channelHashBase32[15:20])
		updater.Notify(observable.Event{
			Subject: fmt.Sprintf("/bitboxbases/%s/pairinghash", bitboxBaseID),
			Action:  action.Replace,
			Object:  updater.channelHash,
		})
		err = client.WriteMessage(websocket.BinaryMessage, []byte(opICanHasPairinVerificashun))
		if err != nil {
			return errp.New("the websocket failed writing the pairingVerificationRequiredByApp message at the verification stage of the noise handshake")
		}

		// Wait for the base to reply with responseSuccess, then proceed
		_, responseBytes, err := client.ReadMessage()
		if err != nil {
			return errp.New("websocket failed reading the pairing response from the BitBox Base")
		}
		updater.channelHashBitBoxBaseVerified = string(responseBytes) == string(responseSuccess)
		if updater.channelHashBitBoxBaseVerified {
			err = updater.configAddBitBoxBaseStaticPubkey(updater.bitboxBaseNoiseStaticPubkey)
			if err != nil {
				updater.log.Error("Pairing Successful, but unable to write bitboxBaseNoiseStaticPubkey to file")
			}
		} else {
			updater.sendCipher = nil
			updater.receiveCipher = nil
			updater.channelHash = ""
			return errp.New("pairing with BitBox Base failed")
		}
	}
	updater.channelHashAppVerified = true
	return nil
}

//GetEnv makes an http GET request to the base and on success returns some environment data from the base such as the electrs port
func (updater *Updater) GetEnv() ([]byte, error) {
	response, err := http.Get("http://" + updater.address + "/getenv")
	if err != nil {
		updater.log.Error("GetEnv http GET request failed, unable to get information from BitBox Base")
		return nil, err
	}
	bodyBytes, err := ioutil.ReadAll(response.Body)
	if err != nil {
		updater.log.Error("GetEnv body bytes not read properly")
		return nil, err
	}
	return bodyBytes, err
}

//Stop provides a setter for the running flag
func (updater *Updater) Stop() {
	updater.running = false
}

func listenWebsocket(client *websocket.Conn, updater *Updater, bitboxBaseID string) {
	for {
		_, message, err := client.ReadMessage()
		if err != nil {
			updater.log.Error("Websocket read failed:", err)
			err = client.Close()
			if err != nil {
				updater.log.Error("Failed to close websocket connection: ", err)
			}
			return
		}
		messageDecrypted, err := updater.receiveCipher.Decrypt(nil, nil, message)
		if err != nil {
			updater.log.Error("Websocket connection could not decrypt incoming packets")
			return
		}

		//TODO(TheCharlatan): Add proper typechecks here before unmarshaling
		err = json.Unmarshal(messageDecrypted, updater.middlewareInfo)
		if err != nil {
			updater.log.Error("Websocket middlewareInfo Unmarshal failed:", err)
			err = client.Close()
			if err != nil {
				updater.log.Error("Failed to close websocket connection: ", err)
			}
			return
		}

		updater.Notify(observable.Event{
			Subject: fmt.Sprintf("/bitboxbases/%s/middlewareinfo", bitboxBaseID),
			Action:  action.Replace,
			Object:  updater.middlewareInfo,
		})
		updater.log.Printf("Received middlewareinfo: %v , from id: %s", updater.middlewareInfo, bitboxBaseID)
		if !updater.running {
			err = client.Close()
			if err != nil {
				updater.log.Error("Failed to close websocket connection: ", err)
			}
			return
		}
	}
}
