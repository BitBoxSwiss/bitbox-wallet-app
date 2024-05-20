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

package firmware

import (
	"crypto/rand"
	"encoding/base32"
	"fmt"

	"github.com/BitBoxSwiss/bitbox02-api-go/api/common"
	"github.com/BitBoxSwiss/bitbox02-api-go/util/errp"
	"github.com/BitBoxSwiss/bitbox02-api-go/util/semver"
	"github.com/flynn/noise"
)

func (device *Device) handshakeQuery(msg []byte) ([]byte, error) {
	if device.version.AtLeast(semver.NewSemVer(7, 0, 0)) {
		// From v7.0.0. the handshake request and response are framed.
		response, err := device.rawQuery(append([]byte(opHerComezTehHandshaek), msg...))
		if err != nil {
			return nil, err
		}
		if len(response) == 0 || string(response[:1]) != responseSuccess {
			return nil, errp.New("handshake query failed")
		}
		return response[1:], nil
	}
	return device.rawQuery(msg)
}

func (device *Device) pair() error {
	cipherSuite := noise.NewCipherSuite(noise.DH25519, noise.CipherChaChaPoly, noise.HashSHA256)
	keypair := device.config.GetAppNoiseStaticKeypair()
	if keypair == nil {
		device.log.Info("noise static keypair created")
		kp, err := cipherSuite.GenerateKeypair(rand.Reader)
		if err != nil {
			panic(err)
		}
		keypair = &kp
		if err := device.config.SetAppNoiseStaticKeypair(keypair); err != nil {
			device.log.Error("could not store app noise static keypair", err)

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
		panic(err)
	}
	responseBytes, err := device.rawQuery([]byte(opICanHasHandShaek))
	if err != nil {
		return err
	}
	if string(responseBytes) != responseSuccess {
		panic(string(responseBytes))
	}
	// do handshake:
	msg, _, _, err := handshake.WriteMessage(nil, nil)
	if err != nil {
		panic(err)
	}
	responseBytes, err = device.handshakeQuery(msg)
	if err != nil {
		return err
	}
	_, _, _, err = handshake.ReadMessage(nil, responseBytes)
	if err != nil {
		panic(err)
	}
	msg, device.sendCipher, device.receiveCipher, err = handshake.WriteMessage(nil, nil)
	if err != nil {
		panic(err)
	}
	responseBytes, err = device.handshakeQuery(msg)
	if err != nil {
		return err
	}

	device.deviceNoiseStaticPubkey = handshake.PeerStatic()
	if len(device.deviceNoiseStaticPubkey) != 32 {
		panic(errp.New("expected 32 byte remote static pubkey"))
	}

	pairingVerificationRequiredByApp := !device.config.ContainsDeviceStaticPubkey(
		device.deviceNoiseStaticPubkey)
	pairingVerificationRequiredByDevice := string(responseBytes) == "\x01"

	if pairingVerificationRequiredByDevice || pairingVerificationRequiredByApp {
		device.log.Info(fmt.Sprintf(
			"pairing required, byDevice=%v, byApp=%v",
			pairingVerificationRequiredByDevice, pairingVerificationRequiredByApp))
		channelHashBase32 := base32.StdEncoding.EncodeToString(handshake.ChannelBinding())
		device.channelHash = fmt.Sprintf(
			"%s %s\n%s %s",
			channelHashBase32[:5],
			channelHashBase32[5:10],
			channelHashBase32[10:15],
			channelHashBase32[15:20])
		device.fireEvent(EventChannelHashChanged)
		device.changeStatus(StatusUnpaired)

		response, err := device.rawQuery([]byte(opICanHasPairinVerificashun))
		if err != nil {
			return err
		}
		device.channelHashDeviceVerified = string(response) == responseSuccess
		if device.channelHashDeviceVerified {
			device.fireEvent(EventChannelHashChanged)
		} else {
			device.sendCipher = nil
			device.receiveCipher = nil
			device.channelHash = ""
			device.changeStatus(StatusPairingFailed)
		}

	} else {
		device.channelHashDeviceVerified = true
		device.ChannelHashVerify(true)
	}
	return nil
}

// ChannelHash returns the hashed handshake channel binding.
func (device *Device) ChannelHash() (string, bool) {
	return device.channelHash, device.channelHashDeviceVerified
}

// ChannelHashVerify verifies the ChannelHash.
func (device *Device) ChannelHashVerify(ok bool) {
	device.log.Info(fmt.Sprintf("channelHashVerify: %v", ok))
	if ok && !device.channelHashDeviceVerified {
		return
	}
	device.channelHashAppVerified = ok
	if ok {
		// No critical error, we will just need to re-confirm the pairing next time.
		_ = device.config.AddDeviceStaticPubkey(device.deviceNoiseStaticPubkey)
		requireUpgrade := false
		switch *device.product {
		case common.ProductBitBox02Multi:
			requireUpgrade = !device.version.AtLeast(lowestSupportedFirmwareVersion)
		case common.ProductBitBox02BTCOnly:
			requireUpgrade = !device.version.AtLeast(lowestSupportedFirmwareVersionBTCOnly)
		default:
			device.log.Error(fmt.Sprintf("unrecognized product: %s", *device.product), nil)
		}
		if requireUpgrade {
			device.changeStatus(StatusRequireFirmwareUpgrade)
			return
		}

		info, err := device.DeviceInfo()
		if err != nil {
			device.log.Error("could not get device info", err)
			return
		}
		if info.Initialized {
			device.changeStatus(StatusInitialized)
		} else {
			device.changeStatus(StatusUninitialized)
		}
	} else {
		device.changeStatus(StatusPairingFailed)
	}
}
