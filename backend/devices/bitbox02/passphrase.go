// SPDX-License-Identifier: Apache-2.0

package bitbox02

import (
	"context"
	"strings"

	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/observable"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/observable/action"
	"github.com/google/uuid"
)

// Keep in sync with MAX_PASSPHRASE_LEN and SPECIAL in firmware hww/api/unlock.rs.
const maxPassphraseLength = 149
const passphraseSpecialChars = " !\"#$%&'()*+,-./:;<=>?^[\\]@_{|}"

const (
	errPassphraseTooLong      errp.ErrorCode = "tooLong"
	errPassphraseInvalidChars errp.ErrorCode = "invalidChars"
)

const (
	passphraseDevice      = "device"
	passphraseHostConsent = "host-consent"
	passphraseHost        = "host"
	passphraseConfirm     = "confirm"
	// Keep the passphrase screen visible without a link or dialog while the library
	// advances after host entry is withdrawn or canceled.
	passphraseWaiting = "waiting"
)

// PassphraseState contains UI state only, never the passphrase itself.
type PassphraseState struct {
	// ID ties clicks and submissions to this prompt so stale actions cannot affect a later
	// prompt, including after reconnecting.
	ID    string `json:"id"`
	Phase string `json:"phase"`
	// Revision increases with each state update. The frontend uses it to ignore outdated
	// HTTP responses and notifications so they cannot overwrite newer UI state.
	Revision uint64 `json:"revision"`
}

// PassphraseState returns the current unlock prompt. An empty phase means it is not active.
func (device *Device) PassphraseState() PassphraseState {
	device.passphraseMu.Lock()
	defer device.passphraseMu.Unlock()
	return device.passphrase
}

func (device *Device) notifyPassphrase(state PassphraseState) {
	device.Notify(observable.Event{Subject: "passphrase", Action: action.Replace, Object: state})
}

func (device *Device) hostPassphraseAvailable(request func()) {
	device.passphraseMu.Lock()
	device.requestHostEntry = request
	if request != nil {
		device.passphrase.ID = uuid.NewString()
		device.passphrase.Phase = passphraseDevice
	} else if device.passphrase.Phase == passphraseDevice {
		device.passphrase.Phase = passphraseWaiting
	}
	device.passphrase.Revision++
	state := device.passphrase
	device.passphraseMu.Unlock()
	device.notifyPassphrase(state)
}

// RequestHostPassphrase queues device approval. The ID rejects clicks from an earlier prompt,
// including requests still in flight when a device reconnects with the same device identifier.
func (device *Device) RequestHostPassphrase(id string) bool {
	device.passphraseMu.Lock()
	if id != device.passphrase.ID || device.passphrase.Phase != passphraseDevice || device.requestHostEntry == nil {
		device.passphraseMu.Unlock()
		return false
	}
	request := device.requestHostEntry
	device.requestHostEntry = nil
	device.passphrase.Phase = passphraseHostConsent
	device.passphrase.Revision++
	state := device.passphrase
	device.passphraseMu.Unlock()
	device.notifyPassphrase(state)
	request()
	return true
}

func (device *Device) passphraseEntered() {
	device.passphraseMu.Lock()
	if device.passphrase.Phase == "" || device.passphrase.Phase == passphraseConfirm {
		device.passphraseMu.Unlock()
		return
	}
	// Device entry can finish just as the host requests consent. In that case the
	// device proceeds to passphrase confirmation instead of asking for host entry.
	device.passphrase.Phase = passphraseConfirm
	device.requestHostEntry = nil
	device.passphrase.Revision++
	state := device.passphrase
	device.passphraseMu.Unlock()
	device.notifyPassphrase(state)
}

func (device *Device) enterMnemonicPassphrase(ctx context.Context) (*string, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	input := make(chan *string, 1)
	device.passphraseMu.Lock()
	device.hostPassphrase = input
	device.passphrase.ID = uuid.NewString()
	device.passphrase.Phase = passphraseHost
	device.passphrase.Revision++
	state := device.passphrase
	device.passphraseMu.Unlock()
	device.notifyPassphrase(state)

	select {
	case passphrase := <-input:
		return passphrase, nil
	case <-ctx.Done():
		device.clearPassphrase()
		return nil, ctx.Err()
	}
}

// SubmitHostPassphrase supplies the current dialog's input. nil cancels host entry; a pointer
// to an empty string submits the empty passphrase. Never trim or normalize the user's input.
// Invalid input leaves the prompt active so the user can correct it or cancel.
func (device *Device) SubmitHostPassphrase(id string, passphrase *string) error {
	device.passphraseMu.Lock()
	if id != device.passphrase.ID || device.passphrase.Phase != passphraseHost || device.hostPassphrase == nil {
		device.passphraseMu.Unlock()
		return errp.New("passphrase prompt is no longer active")
	}
	if passphrase != nil {
		if err := validateHostPassphrase(*passphrase); err != nil {
			device.passphraseMu.Unlock()
			return err
		}
	}
	input := device.hostPassphrase
	device.hostPassphrase = nil
	device.passphrase.Phase = passphraseConfirm
	if passphrase == nil {
		// Cancellation resumes device entry; wait for a fresh availability callback.
		device.passphrase.Phase = passphraseWaiting
	}
	device.passphrase.Revision++
	state := device.passphrase
	device.passphraseMu.Unlock()
	device.notifyPassphrase(state)
	input <- passphrase
	return nil
}

func validateHostPassphrase(passphrase string) error {
	// Validate before passing input to the firmware, including before transport framing limits.
	if len(passphrase) > maxPassphraseLength {
		return errPassphraseTooLong
	}
	for _, c := range passphrase {
		//nolint:staticcheck // QF1001: keep the allowed character ranges readable.
		if !(c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || c >= '0' && c <= '9' ||
			strings.ContainsRune(passphraseSpecialChars, c)) {
			return errPassphraseInvalidChars
		}
	}
	return nil
}

func (device *Device) clearPassphrase() {
	device.passphraseMu.Lock()
	if device.passphrase.Phase == "" {
		device.passphraseMu.Unlock()
		return
	}
	device.passphrase = PassphraseState{Revision: device.passphrase.Revision + 1}
	device.requestHostEntry = nil
	device.hostPassphrase = nil
	state := device.passphrase
	device.passphraseMu.Unlock()
	device.notifyPassphrase(state)
}
