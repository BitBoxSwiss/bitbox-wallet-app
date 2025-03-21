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

// WaitSynchronized blocks until all pending synchronization tasks are finished.
func (synchronizer *Synchronizer) WaitSynchronized() {
	unlock := synchronizer.waitLock.RLock()
	n := synchronizer.requestsCounter
	wait := synchronizer.wait
	unlock()
	if n == 0 {
		return
	}
	<-wait
}
