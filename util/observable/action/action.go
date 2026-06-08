// SPDX-License-Identifier: Apache-2.0

package action

// Action describes how the subject of an event is altered by the object.
type Action string

const (
	// Replace replaces the current value of the subject with the object.
	Replace Action = "replace"

	// Reload tells the listener to reload the state of the subject.
	Reload Action = "reload"
)
