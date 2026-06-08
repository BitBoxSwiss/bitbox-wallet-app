// SPDX-License-Identifier: Apache-2.0

package bitbox

// Status represents the device status.
type Status string

const (
	// StatusBootloader means that the device is in bootloader mode, and the bootloader API can be
	// used.
	StatusBootloader Status = "bootloader"

	// StatusUninitialized is the uninitialized device, i.e. unseeded and no password set.
	// Use SetPassword() to proceed to StatusLoggedIn.
	StatusUninitialized Status = "uninitialized"

	// StatusInitialized means the password was set and the device was seeded. Use Login() to
	// proceed to StatusSeeded.
	StatusInitialized Status = "initialized"

	// StatusLoggedIn means device authentication was successful, but the device is not yet
	// seeded. Use CreateWallet() or RestoreBackup() to seed and proceed to StatusSeeded.
	StatusLoggedIn Status = "logged_in"

	// StatusSeeded means we are authenticated, and the device is seeded. We are ready to use
	// XPub(), Sign() etc.
	StatusSeeded Status = "seeded"

	// StatusRequireFirmwareUpgrade means that the a firmware upgrade is required before being able
	// to proceed to StatusLoggedIn or StatusSeeded (firmware version too old).
	StatusRequireFirmwareUpgrade Status = "require_firmware_upgrade"

	// StatusRequireAppUpgrade means that the an app upgrade is required (firmware version too new).
	StatusRequireAppUpgrade Status = "require_app_upgrade"
)
