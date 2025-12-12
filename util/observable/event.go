// SPDX-License-Identifier: Apache-2.0

package observable

import "github.com/BitBoxSwiss/bitbox-wallet-app/util/observable/action"

// Event is passed to the listeners of an observable type.
type Event struct {
	// Subject identifies what changed.
	// By convention, it corresponds to the corresponding GET endpoint of the REST API.
	Subject string `json:"subject"`

	// Action describes how the change has to be applied.
	Action action.Action `json:"action"`

	// Object contains the data that changed.
	Object interface{} `json:"object"`
}
