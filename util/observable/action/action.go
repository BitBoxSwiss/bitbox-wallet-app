package action

// Action describes how the subject of an event is altered by the object.
type Action string

const (
	// Replace replaces the current value of the subject with the object.
	Replace Action = "replace"

	// Prepend prepends the object to the list of values of the subject.
	Prepend Action = "prepend"

	// Append appends the object to the list of values of the subject.
	Append Action = "append"

	// Remove removes the object from the list of values of the subject.
	Remove Action = "remove"

	// Reload tells the listener to reload the state of the subject.
	Reload Action = "reload"
)
