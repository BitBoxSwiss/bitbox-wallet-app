// SPDX-License-Identifier: Apache-2.0

package bluetooth

import (
	"encoding/json"
	"fmt"

	"github.com/BitBoxSwiss/bitbox-wallet-app/util/locker"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/observable"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/observable/action"
	"github.com/sirupsen/logrus"
)

// ConnectionState represents the a peripheral's connection state.
type ConnectionState string

const (
	// ConnectionStateDiscovered means the peripheral is discovered.
	ConnectionStateDiscovered ConnectionState = "discovered"
	// ConnectionStateConnecting means a connection & pairing attempt is in progress.
	ConnectionStateConnecting ConnectionState = "connecting"
	// ConnectionStateConnected means successfully connected and paired.
	ConnectionStateConnected ConnectionState = "connected"
	// ConnectionStateError means there was a connection error, see ConnectionError.
	ConnectionStateError ConnectionState = "error"
)

// UnmarshalJSON verifies that only a valid state string can be deserialized.
func (cs *ConnectionState) UnmarshalJSON(data []byte) error {
	var s string
	if err := json.Unmarshal(data, &s); err != nil {
		return err
	}
	switch ConnectionState(s) {
	case ConnectionStateDiscovered,
		ConnectionStateConnecting,
		ConnectionStateConnected,
		ConnectionStateError:
		*cs = ConnectionState(s)
		return nil
	default:
		return fmt.Errorf("invalid ConnectionState: %q", s)
	}
}

// Peripheral is a bluetooth peripheral.
type Peripheral struct {
	Identifier string `json:"identifier"`
	Name       string `json:"name"`
	// ConnectionState shows the current connection phase
	ConnectionState ConnectionState `json:"connectionState"`
	ConnectionError *string         `json:"connectionError,omitempty"`
}

// State contains everything needed to render bluetooth peripherals and other data in the frontend.
type State struct {
	// BluetoothAvailable is false if bluetooth is powered off or otherwise unavailable.
	BluetoothAvailable bool `json:"bluetoothAvailable"`
	// BluetoothUnauthorized is true if the app does not have permission to use Bluetooth.
	BluetoothUnauthorized bool `json:"bluetoothUnauthorized"`
	// Scanning is true if we are currently scanning for peripherals.
	Scanning    bool          `json:"scanning"`
	Peripherals []*Peripheral `json:"peripherals"`
}

// Bluetooth manages a list of peripherals.
type Bluetooth struct {
	observable.Implementation

	state     *State
	stateLock locker.Locker

	log *logrus.Entry
}

// New creates a new instance of Bluetooth.
func New(log *logrus.Entry) *Bluetooth {
	b := &Bluetooth{
		state: &State{
			Peripherals: []*Peripheral{},
		},
		log: log,
	}
	return b
}

// SetState sets the current list of discovered peripherals and other state data.
func (b *Bluetooth) SetState(state *State) {
	defer b.stateLock.Lock()()
	b.log.WithField("state", state).Info("bluetooth setstate")
	b.state = state
	b.Notify(observable.Event{
		Subject: "bluetooth/state",
		Action:  action.Replace,
		Object:  state,
	})
}

// State returns the current list of discovered peripherals and other bluetooth state data.
func (b *Bluetooth) State() *State {
	defer b.stateLock.RLock()()
	return b.state
}
