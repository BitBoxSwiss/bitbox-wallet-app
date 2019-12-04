// Copyright 2019 Shift Devices AG
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

package bitboxbasestatus

// Status represents the BitBoxBase status.
type Status string

const (
	// StatusConnected ist the first status, right after the bitboxbase is connected. We automatically
	// move to StatusUnpaired
	StatusConnected Status = "connected"

	// StatusUnpaired means the pairing has not been confirmed yet. After the pairing screen has
	// been confirmed, we move to StatusBitcoinPre.
	StatusUnpaired Status = "unpaired"

	// StatusPairingFailed is when the pairing code was rejected on the app or on the BitBoxBase.
	StatusPairingFailed Status = "pairingFailed"

	// StatusPasswordNotSet is after status unpaired, if the Base has not been initialized before.
	StatusPasswordNotSet Status = "passwordNotSet"

	// StatusBitcoinPre is after status unpaired, if the Base has not been initialized before.
	StatusBitcoinPre Status = "bitcoinPre"

	// StatusLocked is before status initialized and after unpairs, passwordNotSet or bitcoinPre
	StatusLocked Status = "locked"

	// StatusInitialized means the BitBoxBase has verfied the pairing
	StatusInitialized Status = "initialized"

	// StatusDisconnected means that the Base is online, reachable, and registered with the App backend,
	// but not connected to the App
	StatusDisconnected Status = "disconnected"

	// StatusOffline means the Base is registered with the App backend, but the device is offline and not
	// attempting to reconnect (e.g., after a manual shutdown)
	StatusOffline Status = "offline"

	// StatusReconnecting means the Base is registered with the App backend, the device is offline or restarting
	// and the App is actively trying to reconnect (e.g., after a reboot or an update)
	StatusReconnecting Status = "reconnecting"
)

// Event represents state change events
type Event string

const (
	// EventStatusChange should be emitted to the frontend if the status transitions from one to another of
	// above defined status strings.
	EventStatusChange Event = "statusChanged"

	// EventChannelHashChange should be emitted whenever the noise channel hash changes.
	EventChannelHashChange Event = "channelHashChanged"

	// EventServiceInfoChanged should be emitted whenever the rpcClient receives a 'service info changed' notification
	EventServiceInfoChanged Event = "serviceInfoChanged"

	// EventUserAuthenticated emits an event when a user successfully authenticates with the Base
	// so that the frontend knows it can now fetch BaseInfo
	EventUserAuthenticated Event = "userAuthenticated"

	// EventBaseUpdateProgressChange is emitted whenever the rpcClient gets a BaseUpdateProgress changed notification
	EventBaseUpdateProgressChange Event = "baseUpdateProgressChanged"

	// EventUpdateAvailable is emitted whenever there is a new update available for the Base
	EventUpdateAvailable Event = "updateAvailable"

	// EventConnectionLost is emitted whenever the websocket connection is lost to update the app status
	EventConnectionLost Event = "connectionLost"
)
