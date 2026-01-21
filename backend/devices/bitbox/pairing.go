// SPDX-License-Identifier: Apache-2.0

package bitbox

import (
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/devices/bitbox/relay"
)

// finishPairing finalizes the persistence of the pairing configuration, actively listens on the
// mobile channel and fires an event to indicate pairing success or failure.
func (dbb *Device) finishPairing(channel *relay.Channel) {
	dbb.mu.Lock()
	if err := channel.StoreToConfigFile(dbb.channelConfigDir); err != nil {
		dbb.mu.Unlock() // fireEvent below needs read-lock
		dbb.log.WithError(err).Error("Failed to store the channel config file.")
		dbb.fireEvent(EventPairingError)
		return
	}

	truth := true
	if err := dbb.FeatureSet(&FeatureSet{Pairing: &truth}); err != nil {
		dbb.mu.Unlock() // fireEvent below needs read-lock
		dbb.log.WithError(err).Error("Failed activate pairing.")
		dbb.fireEvent(EventPairingError)
		return
	}
	dbb.channel = channel
	// Release lock early to let the next calls proceed without being blocked.
	dbb.mu.Unlock()

	go dbb.listenForMobile()
	dbb.fireEvent(EventPairingSuccess)
}

func (dbb *Device) handlePairingError(err error, message string) {
	switch err.Error() {
	case relay.PullFailedError:
		dbb.log.Errorf("Failed to pull the mobile's %s.", message)
		dbb.fireEvent(EventPairingPullMessageFailed)
	case relay.ResponseTimeoutError:
		dbb.log.Errorf("Failed to wait for the mobile's %s.", message)
		dbb.fireEvent(EventPairingTimedout)
	default:
	}
}

// processPairing processes the pairing after the channel has been displayed as a QR code.
func (dbb *Device) processPairing(channel *relay.Channel) {
	status, err := channel.WaitForScanningSuccess(2 * time.Minute)
	if err != nil {
		dbb.handlePairingError(err, "scanning success message")
		return
	}
	if status != "success" {
		dbb.log.Error("Scanning unsuccessful")
		dbb.fireEvent(EventPairingScanningFailed)
	}

	deviceInfo, err := dbb.DeviceInfo()
	if err != nil {
		dbb.log.WithError(err).Error("Failed to check if device is locked or not")
		dbb.fireEvent(EventPairingError)
		return
	}
	if deviceInfo.Lock {
		dbb.log.Debug("Device is locked. Only establishing connection to mobile app without repairing.")
		dbb.finishPairing(channel)
		return
	}
	dbb.fireEvent(EventPairingStarted)
	mobileECDHPKhash, err := channel.WaitForMobilePublicKeyHash(2 * time.Minute)
	if err != nil {
		dbb.handlePairingError(err, "public key hash")
		return
	}
	bitboxECDHPKhash, err := dbb.ecdhPKhash(mobileECDHPKhash)
	if err != nil {
		dbb.log.WithError(err).Error("Failed to get the hash of the ECDH public key " +
			"from the BitBox.")
		dbb.fireEvent(EventPairingAborted)
		return
	}
	if err := channel.SendHashPubKey(bitboxECDHPKhash); err != nil {
		dbb.log.WithError(err).Error("Failed to send the hash of the ECDH public key " +
			"to the server.")
		dbb.fireEvent(EventPairingError)
		return
	}
	mobileECDHPK, err := channel.WaitForMobilePublicKey(2 * time.Minute)
	if err != nil {
		dbb.handlePairingError(err, "public key")
		return
	}
	bitboxECDHPK, err := dbb.ecdhPK(mobileECDHPK)
	if err != nil {
		dbb.log.WithError(err).Error("Failed to get the ECDH public key" +
			"from the BitBox.")
		dbb.fireEvent(EventPairingError)
		return
	}
	if err := channel.SendPubKey(bitboxECDHPK); err != nil {
		dbb.log.WithError(err).Error("Failed to send the ECDH public key" +
			"to the server.")
		dbb.fireEvent(EventPairingError)
		return
	}
	dbb.log.Debug("Waiting for challenge command")
	challenge, err := channel.WaitForCommand(2 * time.Minute)
	for err == nil && challenge == "challenge" {
		dbb.log.Debug("Forwarded challenge cmd to device")
		errDevice := dbb.ecdhChallenge()
		if errDevice != nil {
			dbb.log.WithError(errDevice).Error("Failed to forward challenge request to device.")
			dbb.fireEvent(EventPairingError)
			return
		}
		dbb.log.Debug("Waiting for challenge command")
		challenge, err = channel.WaitForCommand(2 * time.Minute)
	}
	if err != nil {
		dbb.handlePairingError(err, "challenge request")
		return
	}
	dbb.log.Debug("Finished pairing")
	if challenge == "finish" {
		dbb.finishPairing(channel)
	} else {
		dbb.fireEvent(EventPairingAborted)
	}
}
