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

import "github.com/shiftdevices/godbb/backend/devices/device"

// TODO: improve error handling and change event data into a JSON object, and split BitBox events
// from generic device events
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

	// EventSignProgress is fired when starting to sign a new batch of hashes.
	EventSignProgress device.Event = "signProgress"
)
