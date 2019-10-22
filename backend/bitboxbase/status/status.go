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

// Status represents the BitBox Base status.
type Status string

const (
	// StatusConnected ist the first status, right after the bitboxbase is connected. We automatically
	// move to StatusUnpaired
	StatusConnected Status = "connected"

	// StatusUnpaired means the pairing has not been confirmed yet. After the pairing screen has
	// been confirmed, we move to StatusBitcoinPre.
	StatusUnpaired Status = "unpaired"

	// StatusPairingFailed is when the pairing code was rejected on the app or on the BitBox Base.
	StatusPairingFailed Status = "pairingFailed"

	// StatusBitcoinPre is after status unpaired, if the Base has not been initialized before.
	StatusBitcoinPre Status = "bitcoinPre"

	// StatusInitialized means the BitBox Base has verfied the pairing
	StatusInitialized Status = "initialized"
)

// Event represents state change events
type Event string

const (
	// EventStatusChange should be emitted to the frontend if the status transitions from one to another of
	// above defined status strings.
	EventStatusChange Event = "statusChanged"

	// EventChannelHashChange should be emitted whenever the noise channel hash changes.
	EventChannelHashChange Event = "channelHashChanged"

	// EventSampleInfoChange should be emitted whenever the rpcclient gets a new SampleInfo notification
	EventSampleInfoChange Event = "sampleInfoChanged"

	// EventVerificationProgressChange should be emitted whenever the rpcclient gets a new VerificationProgress notification
	EventVerificationProgressChange Event = "verificationProgressChanged"

	// EventServiceInfoChanged should be emitted whenever the rpcClient receives a 'service info changed' notification
	EventServiceInfoChanged Event = "serviceInfoChanged"
)
