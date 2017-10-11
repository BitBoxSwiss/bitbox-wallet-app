package synchronizer

import (
	"sync"
	"sync/atomic"
)

type Synchronizer struct {
	requestsCounter int32
	onSyncStarted   func()
	onSyncFinished  func()
	lock            sync.RWMutex
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
	if synchronizer.requestsCounter == 0 {
		synchronizer.onSyncStarted()
	}
	atomic.AddInt32(&synchronizer.requestsCounter, 1)
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
