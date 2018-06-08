package observable

// Implementation can be embedded in implementations that should be observable.
type Implementation struct {
	listeners map[Listener]bool
}

func (implementation *Implementation) ensureMapExists() {
	if implementation.listeners == nil {
		implementation.listeners = make(map[Listener]bool)
	}
}

// RegisterEventListener implements observable.Interface.
func (implementation *Implementation) RegisterEventListener(listener Listener) bool {
	implementation.ensureMapExists()
	_, registered := implementation.listeners[listener]
	if !registered {
		implementation.listeners[listener] = true
	}
	return !registered
}

// DeregisterEventListener implements observable.Interface.
func (implementation *Implementation) DeregisterEventListener(listener Listener) bool {
	implementation.ensureMapExists()
	_, registered := implementation.listeners[listener]
	if registered {
		delete(implementation.listeners, listener)
	}
	return registered
}

// NotifyListeners notifies the registered listeners about the given event.
// This method should only be called from the implementation itself.
func (implementation *Implementation) NotifyListeners(event *Event) {
	implementation.ensureMapExists()
	for listener := range implementation.listeners {
		(*listener)(event)
	}
}
