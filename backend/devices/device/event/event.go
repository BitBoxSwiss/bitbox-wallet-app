// SPDX-License-Identifier: Apache-2.0

package event

// Event instances are sent to the onEvent callback.
type Event string

const (
	// EventKeystoreAvailable is fired when the device's keystore becomes available (e.g. after
	// unlocking it).
	EventKeystoreAvailable Event = "keystoreAvailable"
	// EventKeystoreGone is fired when the device's keystore becomes unavailable, e.g. after a
	// reset. NOTE: It is not fired when the keystore is replaced. In that case, only
	// EventKeystoreAvailable is fired.
	EventKeystoreGone Event = "keystoreGone"
)
