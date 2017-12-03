package synchronizer

import (
	"sync/atomic"
)

// Synchronizer keeps track of a reference counter. It is useful to keep track of outstanding tasks
// that run in goroutines.
type Synchronizer struct {
	requestsCounter int32
	onSyncStarted   func()
	onSyncFinished  func()
}

// NewSynchronizer creates a new Synchronizer. onSyncStarted is called when the counter is first
// incremented. onSyncFinished is called when the counter is last decremented.
func NewSynchronizer(onSyncStarted func(), onSyncFinished func()) *Synchronizer {
	synchronizer := &Synchronizer{
		requestsCounter: 0,
		onSyncStarted:   onSyncStarted,
		onSyncFinished:  onSyncFinished,
	}
	return synchronizer
}

// IncRequestsCounter increments the counter, and returns a function to decrement it which must be
// called after the task has finished.
func (synchronizer *Synchronizer) IncRequestsCounter() func() {
	counter := atomic.AddInt32(&synchronizer.requestsCounter, 1)
	if counter == 1 {
		synchronizer.onSyncStarted()
	}
	return synchronizer.decRequestsCounter
}

func (synchronizer *Synchronizer) decRequestsCounter() {
	counter := atomic.AddInt32(&synchronizer.requestsCounter, -1)
	if counter == 0 {
		synchronizer.onSyncFinished()
	} else if counter < 0 {
		panic("request counter cannot be negative")
	}
}
