// SPDX-License-Identifier: Apache-2.0

package observable

import "github.com/BitBoxSwiss/bitbox-wallet-app/util/locker"

// Implementation can be embedded in implementations that are observable.
type Implementation struct {
	counter       int
	observers     map[int]func(Event)
	observersLock locker.Locker
}

// Observe implements observable.Observe.
func (implementation *Implementation) Observe(observer func(Event)) func() {
	defer implementation.observersLock.Lock()()
	if implementation.observers == nil {
		implementation.observers = make(map[int]func(Event))
	}
	// We need a variable for the returned function.
	counter := implementation.counter
	implementation.observers[counter] = observer
	implementation.counter = counter + 1
	return func() {
		defer implementation.observersLock.Lock()()
		delete(implementation.observers, counter)
	}
}

// Notify notifies the registered observers about the given event.
// This method should only be called from the implementation itself.
func (implementation *Implementation) Notify(event Event) {
	defer implementation.observersLock.RLock()()
	for _, observer := range implementation.observers {
		observer(event)
	}
}
