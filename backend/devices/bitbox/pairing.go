package bitbox

import (
	"time"

	"github.com/shiftdevices/godbb/backend/devices/bitbox/relay"
)

// finishPairing finishes the pairing after the channel has been displayed as a QR code.
func (device *Device) finishPairing(channel *relay.Channel) {
	if err := channel.WaitForScanningSuccess(time.Minute); err != nil {
		device.log.WithField("error", err).Warning("Failed to wait for the scanning success.")
		device.fireEvent(EventPairingTimedout, nil)
		return
	}
	device.fireEvent(EventPairingStarted, nil)
	mobileECDHPKhash, err := channel.WaitForMobilePublicKeyHash(2 * time.Minute)
	if err != nil {
		device.log.WithField("error", err).Warning("Failed to wait for the mobile's public key hash.")
		device.fireEvent(EventPairingTimedout, nil)
		return
	}
	bitboxECDHPKhash, err := device.ECDHPKhash(mobileECDHPKhash)
	if err != nil {
		device.log.WithField("error", err).Error("Failed to get the hash of the ECDH public key " +
			"from the BitBox.")
		device.fireEvent(EventPairingAborted, nil)
		return
	}
	if channel.SendHashPubKey(bitboxECDHPKhash) != nil {
		device.log.WithField("error", err).Error("Failed to send the hash of the ECDH public key " +
			"to the server.")
		device.fireEvent(EventPairingError, nil)
		return
	}
	mobileECDHPK, err := channel.WaitForMobilePublicKey(2 * time.Minute)
	if err != nil {
		device.log.WithField("error", err).Error("Failed to wait for the mobile's public key.")
		device.fireEvent(EventPairingTimedout, nil)
		return
	}
	bitboxECDHPK, err := device.ECDHPK(mobileECDHPK)
	if err != nil {
		device.log.WithField("error", err).Error("Failed to get the ECDH public key" +
			"from the BitBox.")
		device.fireEvent(EventPairingError, nil)
		return
	}
	if channel.SendPubKey(bitboxECDHPK) != nil {
		device.log.WithField("error", err).Error("Failed to send the ECDH public key" +
			"to the server.")
		device.fireEvent(EventPairingError, nil)
		return
	}
	device.log.Debug("Waiting for challenge command")
	challenge, err := channel.WaitForCommand(2 * time.Minute)
	for err == nil && challenge == "challenge" {
		device.log.Debug("Forwarded challenge cmd to device")
		errDevice := device.ECDHchallenge()
		if errDevice != nil {
			device.log.WithField("error", errDevice).Error("Failed to forward challenge request to device.")
			device.fireEvent(EventPairingError, nil)
			return
		}
		device.log.Debug("Waiting for challenge command")
		challenge, err = channel.WaitForCommand(2 * time.Minute)
	}
	if err != nil {
		device.log.WithField("error", err).Error("Failed to get challenge request from mobile.")
		device.fireEvent(EventPairingTimedout, nil)
		return
	}
	device.log.Debug("Finished pairing")
	if challenge == "finish" {
		if err := channel.StoreToConfigFile(); err != nil {
			device.log.WithField("error", err).Error("Failed to store the channel config file.")
			device.fireEvent(EventPairingError, nil)
			return
		}
		device.channel = channel
		device.ListenForMobile()
		device.fireEvent("pairingTrue", nil)
		device.fireEvent(EventPairingSuccess, nil)
	} else {
		device.fireEvent(EventPairingAborted, nil)
	}
}
