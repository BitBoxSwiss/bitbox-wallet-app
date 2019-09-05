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

package rpcclient

import (
	"crypto/rand"
	"encoding/base32"
	"fmt"

	bitboxbasestatus "github.com/digitalbitbox/bitbox-wallet-app/backend/bitboxbase/status"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
	"github.com/flynn/noise"
	"github.com/gorilla/websocket"
)

// runWebsocket sets up loops for sending/receiving, abstracting away the low level details about
// pings, timeouts, connection closing, etc.
// It takes two channels as arguments, one to send outgoing requests and one to close the connection.
// Incoming messages are passed into the parseMessage function of the rpcClient
//
// Closing msg makes runWebsocket's goroutines quit.
// The goroutines close the client upon exit, due to a send/receive error or when msg is closed.
// runWebsocket never closes msg.

const (
	opICanHasHandShaek          = "h"
	opICanHasPairinVerificashun = "v"
	responseSuccess             = "\x00"
	responseNeedsPairing        = "\x01"
)

func (rpcClient *RPCClient) runWebsocket(client *websocket.Conn, writeChan <-chan []byte) {
	const maxMessageSize = 512

	readLoop := func() {
		defer func() {
			err := rpcClient.client.Close()
			if err != nil {
				rpcClient.log.WithError(err).Error("failed to close rpc client")
			}
			err = client.Close()
			if err != nil {
				rpcClient.log.WithError(err).Error("failed to close websocket client")
			}
			// it might be the case that we are closing the websocket on an already de-regitstered base, so do not check the errors here.
			_ = rpcClient.onUnregister()
			rpcClient.log.Println("Closing websocket read loop")
		}()
		client.SetReadLimit(maxMessageSize)
		for {
			_, msg, err := client.ReadMessage()
			if err != nil {
				if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway) {
					rpcClient.log.WithError(err).Error("Unexpected websocket close")
				}
				break
			}
			messageDecrypted, err := rpcClient.receiveCipher.Decrypt(nil, nil, msg)
			if err != nil {
				rpcClient.log.WithError(err).Error("websocket client could not decrypt incoming packets")
				break
			}
			rpcClient.parseMessage(messageDecrypted)
		}
	}

	writeLoop := func() {
		defer func() {
			err := client.Close()
			if err != nil {
				rpcClient.log.WithError(err).Error("failed to close websocket client")
			}
			rpcClient.log.Info("Closing websocket write loop")
		}()
		for {
			select {
			case <-rpcClient.rpcConnection.CloseChan():
				_ = client.WriteMessage(websocket.CloseMessage, []byte{})
				rpcClient.log.Info("closing websocket connection")
				return
			default:
				select {
				case <-rpcClient.rpcConnection.CloseChan():
					_ = client.WriteMessage(websocket.CloseMessage, []byte{})
					rpcClient.log.Info("closing websocket connection")
					return

				case message, ok := <-writeChan:
					if !ok {
						_ = client.WriteMessage(websocket.CloseMessage, []byte{})
						return
					}
					err := client.WriteMessage(websocket.BinaryMessage, rpcClient.sendCipher.Encrypt(nil, nil, message))
					if err != nil {
						rpcClient.log.WithError(err).Error("websocket could not write message")
					}
				}
			}
		}
	}

	go readLoop()
	go writeLoop()
}

// initializeNoise sets up a new noise connection. First a fresh keypair is generated if none is locally found.
// Afterwards a XX handshake is performed. This is a three part handshake required to authenticate both parties.
// The resulting pairing code is then displayed to the user to check if it matches what is displayed on the other party's device.
func (rpcClient *RPCClient) initializeNoise(client *websocket.Conn) error {
	cipherSuite := noise.NewCipherSuite(noise.DH25519, noise.CipherChaChaPoly, noise.HashSHA256)
	keypair := rpcClient.configGetAppNoiseStaticKeypair()
	if keypair == nil {
		rpcClient.log.Info("noise static keypair created")
		kp, err := cipherSuite.GenerateKeypair(rand.Reader)
		if err != nil {
			return errp.New("unable to generate a new noise keypair for the wallet app communication with the BitBox Base")
		}
		keypair = &kp
		if err := rpcClient.configSetAppNoiseStaticKeypair(keypair); err != nil {
			rpcClient.log.WithError(err).Error("could not store app noise static keypair")
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
	msg, rpcClient.receiveCipher, rpcClient.sendCipher, err = handshake.WriteMessage(nil, nil)
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

	rpcClient.bitboxBaseNoiseStaticPubkey = handshake.PeerStatic()
	if len(rpcClient.bitboxBaseNoiseStaticPubkey) != 32 {
		return errp.New("expected 32 byte remote static pubkey")
	}

	pairingVerificationRequiredByApp := !rpcClient.configContainsBitBoxBaseStaticPubkey(
		rpcClient.bitboxBaseNoiseStaticPubkey)
	pairingVerificationRequiredByBase := string(responseBytes) == responseNeedsPairing

	// Do the user verification of the channel binding hash if either the app or base require it
	if pairingVerificationRequiredByBase || pairingVerificationRequiredByApp {
		channelHashBase32 := base32.StdEncoding.EncodeToString(handshake.ChannelBinding())
		rpcClient.channelHash = fmt.Sprintf(
			"%s %s\n%s %s",
			channelHashBase32[:5],
			channelHashBase32[5:10],
			channelHashBase32[10:15],
			channelHashBase32[15:20])
		rpcClient.onEvent(bitboxbasestatus.EventChannelHashChange)
		rpcClient.onChangeStatus(bitboxbasestatus.StatusUnpaired)

		err = client.WriteMessage(websocket.BinaryMessage, []byte(opICanHasPairinVerificashun))
		if err != nil {
			return errp.New("the websocket failed writing the pairingVerificationRequiredByApp message at the verification stage of the noise handshake")
		}

		// Wait for the base to reply with responseSuccess, then proceed
		_, responseBytes, err := client.ReadMessage()
		if err != nil {
			return errp.New("websocket failed reading the pairing response from the BitBox Base")
		}
		rpcClient.channelHashBitBoxBaseVerified = string(responseBytes) == string(responseSuccess)
		if rpcClient.channelHashBitBoxBaseVerified {
			err = rpcClient.configAddBitBoxBaseStaticPubkey(rpcClient.bitboxBaseNoiseStaticPubkey)
			if err != nil {
				rpcClient.log.Error("Pairing Successful, but unable to write bitboxBaseNoiseStaticPubkey to file")
			}
		} else {
			rpcClient.sendCipher = nil
			rpcClient.receiveCipher = nil
			rpcClient.channelHash = ""
			rpcClient.onChangeStatus(bitboxbasestatus.StatusPairingFailed)
			return errp.New("pairing with BitBox Base failed")
		}
		rpcClient.channelHashAppVerified = true
		rpcClient.onChangeStatus(bitboxbasestatus.StatusBitcoinPre)
	} else {
		err = client.WriteMessage(websocket.BinaryMessage, []byte(responseSuccess))
		if err != nil {
			return errp.New("the websocket failed writing the success message at the verification stage of the noise handshake")
		}
		rpcClient.channelHashAppVerified = true
		rpcClient.onChangeStatus(bitboxbasestatus.StatusInitialized)
	}

	return nil
}
