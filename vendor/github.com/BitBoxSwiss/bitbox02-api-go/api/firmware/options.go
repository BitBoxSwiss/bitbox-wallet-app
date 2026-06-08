// SPDX-License-Identifier: Apache-2.0

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
