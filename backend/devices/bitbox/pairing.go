package bitbox

import (
	"time"

	"github.com/shiftdevices/godbb/backend/devices/device"
)

// TODO: improve error handling and change event data into a JSON object.
const (
	// EventPairingStarted is fired when the pairing started.
	EventPairingStarted device.Event = "pairingStarted"

	// EventPairingTimedout is fired when the pairing timed out.
	EventPairingTimedout device.Event = "pairingTimedout"

	// EventPairingAborted is fired when the pairing aborted.
	EventPairingAborted device.Event = "pairingAborted"

	// EventPairingError is fired when an error happened during the pairing.
	EventPairingError device.Event = "pairingError"

	// EventPairingSuccess is fired when the pairing successfully finished.
	EventPairingSuccess device.Event = "pairingSuccess"
)

// finishPairing finishes the pairing after the channel has been displayed as a QR code.
func finishPairing(device *Device) {
	if err := device.channel.WaitForScanningSuccess(time.Minute); err != nil {
		device.log.WithField("error", err).Warning("Failed to wait for the scanning success.")
		device.fireEvent(EventPairingTimedout)
		return
	}
	device.fireEvent(EventPairingStarted)
	mobileECDHPKhash, err := device.channel.WaitForMobilePublicKeyHash(2 * time.Minute)
	if err != nil {
		device.log.WithField("error", err).Warning("Failed to wait for the mobile's public key hash.")
		device.fireEvent(EventPairingTimedout)
		return
	}
	bitboxECDHPKhash, err := device.ECDHPKhash(mobileECDHPKhash)
	if err != nil {
		device.log.WithField("error", err).Error("Failed to get the hash of the ECDH public key " +
			"from the BitBox.")
		device.fireEvent(EventPairingAborted)
		return
	}
	if device.channel.SendHashPubKey(bitboxECDHPKhash) != nil {
		device.log.WithField("error", err).Error("Failed to send the hash of the ECDH public key " +
			"to the server.")
		device.fireEvent(EventPairingError)
		return
	}
	mobileECDHPK, err := device.channel.WaitForMobilePublicKey(2 * time.Minute)
	if err != nil {
		device.log.WithField("error", err).Error("Failed to wait for the mobile's public key.")
		device.fireEvent(EventPairingTimedout)
		return
	}
	bitboxECDHPK, err := device.ECDHPK(mobileECDHPK)
	if err != nil {
		device.log.WithField("error", err).Error("Failed to get the ECDH public key" +
			"from the BitBox.")
		device.fireEvent(EventPairingError)
		return
	}
	if device.channel.SendPubKey(bitboxECDHPK) != nil {
		device.log.WithField("error", err).Error("Failed to send the ECDH public key" +
			"to the server.")
		device.fireEvent(EventPairingError)
		return
	}
	device.log.Debug("Waiting for challenge command")
	var errDevice error
	challenge, err := device.channel.WaitForCommand(2 * time.Minute)
	for err == nil && challenge == "challenge" {
		device.log.Debug("Forwarded challenge cmd to device")
		errDevice := device.ECDHchallenge()
		if errDevice != nil {
			device.log.WithField("error", errDevice).Error("Failed to forward challenge request to device.")
			device.fireEvent(EventPairingError)
			return
		}
		device.log.Debug("Waiting for challenge command")
		challenge, err = device.channel.WaitForCommand(2 * time.Minute)
	}
	if err != nil {
		device.log.WithField("error", err).Error("Failed to get challenge request from mobile.")
		device.fireEvent(EventPairingTimedout)
		return
	}
	device.log.Debug("Finished pairing")
	if challenge == "finish" {
		device.fireEvent(EventPairingSuccess)
	} else {
		device.fireEvent(EventPairingAborted)
	}
}
