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

	// StatusRequireUpgrade means that the a firmware upgrade is required before being able to
	// proceed to StatusLoggedIn or StatusSeeded.
	StatusRequireUpgrade = "require_upgrade"
)
