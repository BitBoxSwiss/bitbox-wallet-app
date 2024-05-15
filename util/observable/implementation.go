// Copyright 2018 Shift Devices AG
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
