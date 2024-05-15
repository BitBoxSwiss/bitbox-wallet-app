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
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/devices/bitbox/relay"
)

// finishPairing finalizes the persistence of the pairing configuration, actively listens on the
// mobile channel and fires an event to indicate pairing success or failure.
func (device *Device) finishPairing(channel *relay.Channel) {
	device.mu.Lock()
	if err := channel.StoreToConfigFile(device.channelConfigDir); err != nil {
		device.mu.Unlock() // fireEvent below needs read-lock
		device.log.WithError(err).Error("Failed to store the channel config file.")
		device.fireEvent(EventPairingError, nil)
		return
	}

	truth := true
	if err := device.FeatureSet(&FeatureSet{Pairing: &truth}); err != nil {
		device.mu.Unlock() // fireEvent below needs read-lock
		device.log.WithError(err).Error("Failed activate pairing.")
		device.fireEvent(EventPairingError, nil)
		return
	}
	device.channel = channel
	// Release lock early to let the next calls proceed without being blocked.
	device.mu.Unlock()

	go device.listenForMobile()
	device.fireEvent(EventPairingSuccess, nil)
}

func (device *Device) handlePairingError(err error, message string) {
	switch err.Error() {
	case relay.PullFailedError:
		device.log.Errorf("Failed to pull the mobile's %s.", message)
		device.fireEvent(EventPairingPullMessageFailed, nil)
	case relay.ResponseTimeoutError:
		device.log.Errorf("Failed to wait for the mobile's %s.", message)
		device.fireEvent(EventPairingTimedout, nil)
	default:
	}
}

// processPairing processes the pairing after the channel has been displayed as a QR code.
func (device *Device) processPairing(channel *relay.Channel) {
	status, err := channel.WaitForScanningSuccess(2 * time.Minute)
	if err != nil {
		device.handlePairingError(err, "scanning success message")
		return
	}
	if status != "success" {
		device.log.Error("Scanning unsuccessful")
		device.fireEvent(EventPairingScanningFailed, nil)
	}

	deviceInfo, err := device.DeviceInfo()
	if err != nil {
		device.log.WithError(err).Error("Failed to check if device is locked or not")
		device.fireEvent(EventPairingError, nil)
		return
	}
	if deviceInfo.Lock {
		device.log.Debug("Device is locked. Only establishing connection to mobile app without repairing.")
		device.finishPairing(channel)
		return
	}
	device.fireEvent(EventPairingStarted, nil)
	mobileECDHPKhash, err := channel.WaitForMobilePublicKeyHash(2 * time.Minute)
	if err != nil {
		device.handlePairingError(err, "public key hash")
		return
	}
	bitboxECDHPKhash, err := device.ecdhPKhash(mobileECDHPKhash)
	if err != nil {
		device.log.WithError(err).Error("Failed to get the hash of the ECDH public key " +
			"from the BitBox.")
		device.fireEvent(EventPairingAborted, nil)
		return
	}
	if channel.SendHashPubKey(bitboxECDHPKhash) != nil {
		device.log.WithError(err).Error("Failed to send the hash of the ECDH public key " +
			"to the server.")
		device.fireEvent(EventPairingError, nil)
		return
	}
	mobileECDHPK, err := channel.WaitForMobilePublicKey(2 * time.Minute)
	if err != nil {
		device.handlePairingError(err, "public key")
		return
	}
	bitboxECDHPK, err := device.ecdhPK(mobileECDHPK)
	if err != nil {
		device.log.WithError(err).Error("Failed to get the ECDH public key" +
			"from the BitBox.")
		device.fireEvent(EventPairingError, nil)
		return
	}
	if channel.SendPubKey(bitboxECDHPK) != nil {
		device.log.WithError(err).Error("Failed to send the ECDH public key" +
			"to the server.")
		device.fireEvent(EventPairingError, nil)
		return
	}
	device.log.Debug("Waiting for challenge command")
	challenge, err := channel.WaitForCommand(2 * time.Minute)
	for err == nil && challenge == "challenge" {
		device.log.Debug("Forwarded challenge cmd to device")
		errDevice := device.ecdhChallenge()
		if errDevice != nil {
			device.log.WithError(errDevice).Error("Failed to forward challenge request to device.")
			device.fireEvent(EventPairingError, nil)
			return
		}
		device.log.Debug("Waiting for challenge command")
		challenge, err = channel.WaitForCommand(2 * time.Minute)
	}
	if err != nil {
		device.handlePairingError(err, "challenge request")
		return
	}
	device.log.Debug("Finished pairing")
	if challenge == "finish" {
		device.finishPairing(channel)
	} else {
		device.fireEvent(EventPairingAborted, nil)
	}
}
