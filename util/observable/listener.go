package observable

// Listener can be registered at an observable type to be notified about events.
// The reason why a listener is defined as a function pointer is that it can also be deregistered.
type Listener *func(*Event)
