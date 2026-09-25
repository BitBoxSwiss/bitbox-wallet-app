// SPDX-License-Identifier: Apache-2.0

package sleep

import "sync"

type inhibitor struct {
	mu         sync.Mutex
	references uint
	prevent    func()
	allow      func()
}

func (i *inhibitor) acquire() {
	i.mu.Lock()
	defer i.mu.Unlock()
	if i.references == 0 {
		i.prevent()
	}
	i.references++
}

func (i *inhibitor) release() {
	i.mu.Lock()
	defer i.mu.Unlock()
	if i.references == 0 {
		return
	}
	i.references--
	if i.references == 0 {
		i.allow()
	}
}

var shared = inhibitor{prevent: preventSleep, allow: allowSleep}

// Prevent prevents macOS from going to sleep. Must be paired with Allow().
// Calls may be nested or overlap across goroutines; sleep is allowed only after the last Allow().
// It has no effect on non macOS platforms or when nosleep is configured.
func Prevent() {
	shared.acquire()
}

// Allow releases one request to prevent sleep. Calls without a matching Prevent have no effect.
func Allow() {
	shared.release()
}
