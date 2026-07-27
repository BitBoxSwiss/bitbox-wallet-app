// SPDX-License-Identifier: Apache-2.0

package backend

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/versioninfo"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/observable"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/observable/action"
	"github.com/stretchr/testify/require"
)

func TestUpdateCheckerRun(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	calls := make(chan int, 2)
	releaseSecondCheck := make(chan struct{})
	callCount := 0
	checker := &updateChecker{
		check: func(context.Context) (*UpdateFile, error) {
			callCount++
			calls <- callCount
			if callCount == 2 {
				<-releaseSecondCheck
			}
			return nil, nil
		},
	}
	done := make(chan struct{})
	go func() {
		checker.run(ctx, time.Millisecond)
		close(done)
	}()

	waitForCall := func() int {
		select {
		case call := <-calls:
			return call
		case <-time.After(time.Second):
			require.FailNow(t, "timed out waiting for update check")
			return 0
		}
	}
	require.Equal(t, 1, waitForCall())
	require.Equal(t, 2, waitForCall())
	cancel()
	close(releaseSecondCheck)
	<-done
	require.Equal(t, 2, callCount)
}

func TestUpdateCheckerCheckAndSet(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		events := make(chan observable.Event, 1)
		update := &UpdateFile{Description: "update available"}
		checker := &updateChecker{
			check: func(context.Context) (*UpdateFile, error) {
				return update, nil
			},
		}
		checker.Observe(func(event observable.Event) {
			events <- event
		})

		checker.checkAndSet(context.Background())

		state := checker.get()
		require.Equal(t, uint64(1), state.Revision)
		require.Same(t, update, state.Update)
		event := <-events
		require.Equal(t, "update", event.Subject)
		require.Equal(t, action.Replace, event.Action)
		require.Equal(t, state, event.Object)
	})

	t.Run("no update clears cached update", func(t *testing.T) {
		events := make(chan observable.Event, 1)
		checker := &updateChecker{
			check: func(context.Context) (*UpdateFile, error) {
				return nil, nil
			},
			latest:   &UpdateFile{Description: "old update"},
			revision: 4,
		}
		checker.Observe(func(event observable.Event) {
			events <- event
		})

		checker.checkAndSet(context.Background())

		state := checker.get()
		require.Equal(t, uint64(5), state.Revision)
		require.Nil(t, state.Update)
		require.Equal(t, state, (<-events).Object)
	})

	t.Run("error retains cached update", func(t *testing.T) {
		update := &UpdateFile{Description: "cached update"}
		events := make(chan observable.Event, 1)
		checker := &updateChecker{
			check: func(context.Context) (*UpdateFile, error) {
				return nil, errors.New("offline")
			},
			latest:   update,
			revision: 4,
		}
		checker.Observe(func(event observable.Event) {
			events <- event
		})

		checker.checkAndSet(context.Background())

		state := checker.get()
		require.Equal(t, uint64(4), state.Revision)
		require.Same(t, update, state.Update)
		select {
		case event := <-events:
			t.Fatalf("unexpected event: %+v", event)
		default:
		}
	})
}

func TestNewUpdateRequestSetsUserAgent(t *testing.T) {
	backend := &Backend{environment: environment{}}

	request, err := newUpdateRequest(context.Background(), backend.userAgent())

	require.NoError(t, err)
	require.Equal(t, updateFileURL, request.URL.String())
	require.Equal(t, "BitBoxApp/"+versioninfo.Version.String()+" (linux)", request.Header.Get("User-Agent"))
}
