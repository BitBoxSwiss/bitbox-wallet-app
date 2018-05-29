package bitbox

import (
	"time"
)

// finishPairing finishes the pairing after the channel has been displayed as a QR code.
func finishPairing(device *Device) {
	if err := device.channel.WaitForScanningSuccess(time.Minute); err != nil {
		device.log.WithField("error", err).Warning("Failed to wait for the scanning success.")
		return
	}
	// Hide the QR code in the frontend and display an explanation to follow the instructions
	// on the mobile app.
	mobileECDHPKhash, err := device.channel.WaitForMobilePublicKeyHash(2 * time.Minute)
	if err != nil {
		device.log.WithField("error", err).Warning("Failed to wait for the mobile's public key hash.")
		return
	}
	bitboxECDHPKhash, err := device.ECDHPKhash(mobileECDHPKhash)
	if err != nil {
		device.log.WithField("error", err).Error("Failed to get the hash of the ECDH public key " +
			"from the BitBox.")
		return
	}
	if device.channel.SendHashPubKey(bitboxECDHPKhash) != nil {
		device.log.WithField("error", err).Error("Failed to send the hash of the ECDH public key " +
			"to the server.")
		return
	}
	mobileECDHPK, err := device.channel.WaitForMobilePublicKey(2 * time.Minute)
	if err != nil {
		device.log.WithField("error", err).Warning("Failed to wait for the mobile's public key.")
		return
	}
	bitboxECDHPK, err := device.ECDHPK(mobileECDHPK)
	if err != nil {
		device.log.WithField("error", err).Error("Failed to get the ECDH public key" +
			"from the BitBox.")
		return
	}
	if device.channel.SendPubKey(bitboxECDHPK) != nil {
		device.log.WithField("error", err).Warning("Failed to wait for the mobile's public key.")
		return
	}
	device.log.Debug("Waiting for challenge command")
	challenge, err := device.channel.WaitForCommand(2 * time.Minute)
	for err == nil && challenge == "challenge" {
		device.log.Debug("Forwarded challenge cmd to device")
		err = device.ECDHchallenge()
		if err != nil {
			break
		}
		device.log.Debug("Waiting for challenge command")
		challenge, err = device.channel.WaitForCommand(2 * time.Minute)
	}
	if err != nil {
		device.log.WithField("error", err).Error("Failed to get challenge request from mobile.")
		return
	}
	device.log.Debug("Finished pairing")
	// Hide the explanation in the frontend.
}
