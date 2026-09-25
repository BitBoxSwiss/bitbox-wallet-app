// SPDX-License-Identifier: Apache-2.0

package firmware

// Status represents the device status.
type Status string

const (
	// StatusConnected is the first status, right after the device is connected. We automatically
	// move to StatusUnpaired (directly on firmware >=9.28.0, or after unlocking on older firmware).
	// After pairing, firmware >=9.28.0 returns to StatusConnected while the device is being unlocked.
	StatusConnected Status = "connected"

	// StatusUnpaired means the pairing has not been confirmed yet. After the pairing screen has
	// been confirmed, we move to StatusUninitialized or StatusInitialized depending on the device
	// status.
	StatusUnpaired Status = "unpaired"

	// StatusPairingFailed is when the pairing code was rejected on the app or on the device.
	StatusPairingFailed Status = "pairingFailed"

	// StatusUninitialized is the uninitialized device. Use SetPassword() to proceed to
	// StatusSeeded.
	StatusUninitialized Status = "uninitialized"

	// StatusSeeded is after SetPassword(), before CreateBack() during initialization of the
	// device. Use CreateBackup() to move to StatusInitialized.
	StatusSeeded Status = "seeded"

	// StatusInitialized means the device is seeded and the backup was created, and the device is
	// unlocked. The keystore is ready to use.
	StatusInitialized Status = "initialized"

	// StatusRequireFirmwareUpgrade means that the a firmware upgrade is required before being able
	// to proceed to StatusLoggedIn or StatusSeeded (firmware version too old).
	StatusRequireFirmwareUpgrade Status = "require_firmware_upgrade"

	// StatusRequireAppUpgrade means that the an app upgrade is required (firmware version too new).
	StatusRequireAppUpgrade Status = "require_app_upgrade"
)
