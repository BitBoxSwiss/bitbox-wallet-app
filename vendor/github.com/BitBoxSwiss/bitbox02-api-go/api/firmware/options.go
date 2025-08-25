// Copyright 2025 Shift Crypto AG
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

type deviceOptions struct {
	// If true, the host does not require noise pairing confirmation before communicating over the
	// encrypted noise channel.
	optionalNoisePairingConfirmation bool
}

// DeviceOption provides functional options.
type DeviceOption func(*deviceOptions)

// WithOptionalNoisePairingConfirmation allows the host to communicate over the encrypted noise
// channel without requiring a pairing confirmation on the BitBox.
//
// SECURITY NOTE: this enables a MITM in the noise channel to go undetected. Use only if the noise
// channel is wrapped in another secure transport layer, e.g. a paired Bluetooth connection.
func WithOptionalNoisePairingConfirmation(optional bool) DeviceOption {
	return func(o *deviceOptions) {
		o.optionalNoisePairingConfirmation = optional
	}
}
