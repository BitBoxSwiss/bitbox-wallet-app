// SPDX-License-Identifier: Apache-2.0

package firmware

import "fmt"

// Event instances are sent to the onEvent callback.
type Event string

const (
	// EventChannelHashChanged is fired when the return values of ChannelHash() change.
	EventChannelHashChanged Event = "channelHashChanged"

	// EventStatusChanged is fired when the status changes. Check the status using Status().
	EventStatusChanged Event = "statusChanged"

	// EventAttestationCheckDone is fired when the attestation signature check is completed. In
	// case of failure, the user should be alerted, before they enter the password.
	EventAttestationCheckDone Event = "attestationCheckDone"
)

// SetOnEvent installs the callback which will be called with various events.
func (device *Device) SetOnEvent(onEvent func(Event, interface{})) {
	device.mu.Lock()
	defer device.mu.Unlock()
	device.onEvent = onEvent
}

// fireEvent calls device.onEvent callback if non-nil.
// It blocks for the entire duration of the call.
// The read-only lock is released before calling device.onEvent.
func (device *Device) fireEvent(event Event) {
	device.mu.RLock()
	f := device.onEvent
	device.mu.RUnlock()
	if f != nil {
		device.log.Info(fmt.Sprintf("fire event: %s", event))
		f(event, nil)
	}
}
