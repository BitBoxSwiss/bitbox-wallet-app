// SPDX-License-Identifier: Apache-2.0

package handlers

import (
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/util/observable"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/observable/action"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/require"
)

func newSnapshotTestHandlers() *Handlers {
	handlers := &Handlers{
		backendEvents: make(chan interface{}, 10),
		eventQueue:    make(chan queuedEvent, 10),
		snapshots:     map[string]func() interface{}{},
		log:           logrus.NewEntry(logrus.New()),
	}
	go handlers.processEvents()
	return handlers
}

func TestInitialSnapshotAndEventsAreOrdered(t *testing.T) {
	handlers := newSnapshotTestHandlers()
	started := make(chan struct{})
	release := make(chan struct{})
	handlers.registerSnapshot("state", func() interface{} {
		close(started)
		<-release
		return "initial"
	})

	result := make(chan bool)
	go func() {
		result <- handlers.pushSnapshot("state")
	}()
	<-started
	handlers.pushEvent(observable.Event{
		Subject: "state",
		Action:  action.Replace,
		Object:  "updated",
	})
	close(release)

	require.True(t, <-result)
	require.Equal(t, observable.Event{
		Subject: "state",
		Action:  action.Replace,
		Object:  "initial",
	}, <-handlers.backendEvents)
	require.Equal(t, observable.Event{
		Subject: "state",
		Action:  action.Replace,
		Object:  "updated",
	}, <-handlers.backendEvents)
}

func TestReloadEventIsReplacedWithSnapshot(t *testing.T) {
	handlers := newSnapshotTestHandlers()
	handlers.registerSnapshot("state", func() interface{} { return "current" })

	handlers.pushEvent(observable.Event{
		Subject: "state",
		Action:  action.Reload,
	})

	require.Equal(t, observable.Event{
		Subject: "state",
		Action:  action.Replace,
		Object:  "current",
	}, <-handlers.backendEvents)
}

func TestUnknownSnapshot(t *testing.T) {
	handlers := newSnapshotTestHandlers()
	require.False(t, handlers.pushSnapshot("unknown"))
}
