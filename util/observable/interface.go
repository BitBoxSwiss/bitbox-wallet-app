package observable

// Interface can be embedded in interfaces that should be observable.
type Interface interface {
	// RegisterEventListener registers the given event listener.
	// It returns true if the given listener has not already been registered and false otherwise.
	RegisterEventListener(Listener) bool

	// DeregisterEventListener deregisters the given event listener.
	// It returns true if the given listener has been registered and false otherwise.
	DeregisterEventListener(Listener) bool
}
