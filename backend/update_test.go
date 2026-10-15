// SPDX-License-Identifier: Apache-2.0

package backend

import (
	"context"
	"errors"
	"net/url"
	"testing"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/versioninfo"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/observable"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/observable/action"
	"github.com/stretchr/testify/require"
)

func TestUpdateCheckerRun(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	type call struct {
		count int
		query url.Values
	}
	calls := make(chan call, 2)
	releaseSecondCheck := make(chan struct{})
	callCount := 0
	checker := &updateChecker{
		check: func(_ context.Context, query url.Values) (*UpdateFile, error) {
			callCount++
			calls <- call{count: callCount, query: query}
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

	waitForCall := func() call {
		select {
		case call := <-calls:
			return call
		case <-time.After(time.Second):
			require.FailNow(t, "timed out waiting for update check")
			return call{}
		}
	}
	firstCall := waitForCall()
	require.Equal(t, 1, firstCall.count)
	require.Equal(t, "c=0", firstCall.query.Encode())
	secondCall := waitForCall()
	require.Equal(t, 2, secondCall.count)
	require.Equal(t, "c=1", secondCall.query.Encode())
	cancel()
	close(releaseSecondCheck)
	<-done
	require.Equal(t, 2, callCount)
}

func TestUpdateCheckInterval(t *testing.T) {
	require.Equal(t, time.Hour, updateCheckInterval)
}

func TestUpdateCheckerCheckAndSet(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		events := make(chan observable.Event, 1)
		update := &UpdateFile{Description: "update available"}
		checker := &updateChecker{
			check: func(context.Context, url.Values) (*UpdateFile, error) {
				return update, nil
			},
		}
		checker.Observe(func(event observable.Event) {
			events <- event
		})

		checker.checkAndSet(context.Background(), nil)

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
			check: func(context.Context, url.Values) (*UpdateFile, error) {
				return nil, nil
			},
			latest:   &UpdateFile{Description: "old update"},
			revision: 4,
		}
		checker.Observe(func(event observable.Event) {
			events <- event
		})

		checker.checkAndSet(context.Background(), nil)

		state := checker.get()
		require.Equal(t, uint64(5), state.Revision)
		require.Nil(t, state.Update)
		require.Equal(t, state, (<-events).Object)
	})

	t.Run("error retains cached update", func(t *testing.T) {
		update := &UpdateFile{Description: "cached update"}
		events := make(chan observable.Event, 1)
		checker := &updateChecker{
			check: func(context.Context, url.Values) (*UpdateFile, error) {
				return nil, errors.New("offline")
			},
			latest:   update,
			revision: 4,
		}
		checker.Observe(func(event observable.Event) {
			events <- event
		})

		checker.checkAndSet(context.Background(), nil)

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

func TestCheckUpdate(t *testing.T) {
	var query url.Values
	update := &UpdateFile{Description: "update available"}
	backend := &Backend{
		updateChecker: &updateChecker{
			check: func(_ context.Context, checkQuery url.Values) (*UpdateFile, error) {
				query = checkQuery
				return update, nil
			},
		},
	}

	state := backend.CheckUpdate(context.Background())

	require.Equal(t, "about=1", query.Encode())
	require.Equal(t, uint64(1), state.Revision)
	require.Same(t, update, state.Update)
}

func TestNewUpdateRequestSetsUserAgent(t *testing.T) {
	backend := &Backend{environment: environment{}}

	query := url.Values{}
	query.Set("c", "0")
	request, err := newUpdateRequest(context.Background(), backend.userAgent(), query)

	require.NoError(t, err)
	require.Equal(t, updateFileURL+"?c=0", request.URL.String())
	require.Equal(t, "BitBoxApp/"+versioninfo.Version.String()+" (linux)", request.Header.Get("User-Agent"))
}
