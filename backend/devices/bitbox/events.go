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
