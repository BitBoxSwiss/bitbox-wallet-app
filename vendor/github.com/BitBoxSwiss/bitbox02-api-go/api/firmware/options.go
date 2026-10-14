// SPDX-License-Identifier: Apache-2.0

package firmware

import "context"

type deviceOptions struct {
	// If true, the host does not require noise pairing confirmation before communicating over the
	// encrypted noise channel.
	optionalNoisePairingConfirmation bool
	passphrase                       PassphraseConfig
}

// PassphraseConfig lets an application offer passphrase entry on the host during unlock.
// The callbacks run on the goroutine performing unlock and must not call device APIs.
type PassphraseConfig struct {
	// OnHostPassphraseAvailable shows or hides the app's host-entry control. A non-nil callable
	// requests device approval when invoked; nil withdraws the control. The callable is safe to
	// call from another goroutine, performs no I/O, and cannot affect subsequent entry attempts.
	// This notification must return promptly. If omitted, host entry is requested automatically
	// once per unlock when EnterMnemonicPassphrase is set.
	OnHostPassphraseAvailable func(requestHostEntry func())
	// EnterMnemonicPassphrase is called only after device approval. Return a passphrase (including
	// an empty string) to submit, or nil to cancel and resume device entry. Stop waiting when ctx
	// is canceled by Close. GUI applications must marshal their UI work to the UI thread.
	EnterMnemonicPassphrase func(ctx context.Context) (*string, error)
}

// WithPassphraseConfig enables host passphrase input on firmware 9.28.0 and later.
// Device entry is used when EnterMnemonicPassphrase is nil, and on older firmware.
func WithPassphraseConfig(config PassphraseConfig) DeviceOption {
	return func(o *deviceOptions) {
		o.passphrase = config
	}
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
