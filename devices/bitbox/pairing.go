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
	// Hide the QR code in the frontend and display an explanation about the blinking.
	mobileECDHPK, err := device.channel.WaitForMobilePublicKey(2 * time.Minute)
	if err != nil {
		device.log.WithField("error", err).Warning("Failed to wait for the mobile's public key.")
		return
	}
	verifypass, err := device.VerifyPass(mobileECDHPK)
	if err != nil {
		device.log.WithField("error", err).Error("Failed to get the verifypass from the BitBox.")
		return
	}
	if err = device.channel.SendVerifyPass(verifypass); err != nil {
		device.log.WithField("error", err).Error("Failed to send the verifypass to the server.")
		return
	}
	// Hide the explanation in the frontend.
}
