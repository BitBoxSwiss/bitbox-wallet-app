// Copyright 2018-2019 Shift Cryptosecurity AG
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

package firmware

import "fmt"

// Event instances are sent to the onEvent callback.
type Event string

const (
	// EventChannelHashChanged is fired when the return values of ChannelHash() change.
	EventChannelHashChanged Event = "channelHashChanged"

	// EventStatusChanged is fired when the status changes. Check the status using Status().
	EventStatusChanged Event = "statusChanged"

	// EventAttestationCheckDone is fired when the the attestation signature check is completed. In
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
