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

package bitbox02

// Status represents the device status.
type Status string

const (
	// StatusUnpaired is the first status. After the pairing screen has been confirmed, we move to
	// StatusUninitialized or StatusInitialized depending on the device status.
	StatusUnpaired Status = "unpaired"

	// StatusPairingFailed is when the pairing code was rejected on the app or on the device.
	StatusPairingFailed Status = "pairingFailed"

	// StatusUninitialized is the uninitialized device. Use SetPassword() to proceed to
	// StatusSeeded.
	StatusUninitialized Status = "uninitialized"

	// StatusSeeded is after SetPassword(), before CreateBack() during initialization of the
	// device. Use CreateBackup() to move to StatusUnlocked.
	StatusSeeded Status = "seeded"

	// StatusInitialized means the device is seeded and the backup was created. Use Unlock() to move
	// to StatusUnlocked.
	StatusInitialized Status = "initialized"

	// StatusUnlocked means device authentication was successful, and the keystore is ready to use.
	StatusUnlocked Status = "unlocked"
)
