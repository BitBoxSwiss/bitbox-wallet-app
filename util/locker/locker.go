// SPDX-License-Identifier: Apache-2.0

package locker

import "sync"

// Locker wraps a RWMutex with a nicer api.
type Locker struct {
	mutex sync.RWMutex
}

// Lock wraps RWMutex.Lock, returning a function to unlock. Usage: `defer locker.Lock()()`.
func (locker *Locker) Lock() func() {
	locker.mutex.Lock()
	return locker.mutex.Unlock
}

// RLock wraps RWMutex.RLock, returning a function to unlock. Usage: `defer locker.RLock()()`.
func (locker *Locker) RLock() func() {
	locker.mutex.RLock()
	return locker.mutex.RUnlock
}
