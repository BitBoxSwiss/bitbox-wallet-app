// SPDX-License-Identifier: Apache-2.0

package synchronizer

import (
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/locker"
	"github.com/sirupsen/logrus"
)

// Synchronizer keeps track of a reference counter. It is useful to keep track of outstanding tasks
// that run in goroutines.
type Synchronizer struct {
	requestsCounter int32
	onSyncFinished  func()
	wait            chan struct{}
	waitLock        locker.Locker
	log             *logrus.Entry
}

// NewSynchronizer creates a new Synchronizer. onSyncFinished is called when the counter is last
// decremented.
func NewSynchronizer(onSyncFinished func(), log *logrus.Entry) *Synchronizer {
	synchronizer := &Synchronizer{
		requestsCounter: 0,
		onSyncFinished:  onSyncFinished,
		wait:            nil,
		log:             log.WithField("group", "synchronizer"),
	}
	return synchronizer
}

// IncRequestsCounter increments the counter, and returns a function to decrement it which must be
// called after the task has finished.
func (synchronizer *Synchronizer) IncRequestsCounter() func() {
	defer synchronizer.waitLock.Lock()()
	synchronizer.requestsCounter++
	if synchronizer.requestsCounter == 1 {
		synchronizer.wait = make(chan struct{})
	}
	return synchronizer.decRequestsCounter
}

func (synchronizer *Synchronizer) decRequestsCounter() {
	defer synchronizer.waitLock.Lock()()
	synchronizer.requestsCounter--
	if synchronizer.requestsCounter == 0 {
		synchronizer.onSyncFinished()
		// Everyone waiting will be notified by this.
		close(synchronizer.wait)
		synchronizer.wait = nil
	} else if synchronizer.requestsCounter < 0 {
		panic("request counter cannot be negative")
	}
}
