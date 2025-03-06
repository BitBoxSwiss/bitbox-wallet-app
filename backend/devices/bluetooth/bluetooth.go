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

package bluetooth

import (
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/locker"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/observable"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/observable/action"
	"github.com/sirupsen/logrus"
)

// Peripheral is a bluetooth peripheral.
type Peripheral struct {
	Identifier      string  `json:"identifier"`
	Name            string  `json:"name"`
	ConnectionError *string `json:"connectionError,omitempty"`
}

// State contains everything needed to render bluetooth peripherals and other data in the frontend.
type State struct {
	// BluetoothAvailable is false if bluetooth is powered off or otherwise unavailable.
	BluetoothAvailable bool          `json:"bluetoothAvailable"`
	Peripherals        []*Peripheral `json:"peripherals"`
	Connecting         bool          `json:"connecting"`
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
