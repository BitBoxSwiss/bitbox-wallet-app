package synchronizer

import (
	"sync/atomic"
)

type Synchronizer struct {
	requestsCounter int32
	onSyncStarted   func()
	onSyncFinished  func()
}

func NewSynchronizer(onSyncStarted func(), onSyncFinished func()) *Synchronizer {
	synchronizer := &Synchronizer{
		requestsCounter: 0,
		onSyncStarted:   onSyncStarted,
		onSyncFinished:  onSyncFinished,
	}
	return synchronizer
}

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
