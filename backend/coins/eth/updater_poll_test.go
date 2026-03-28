// SPDX-License-Identifier: Apache-2.0

package eth

import (
	"github.com/stretchr/testify/require"
	"sync/atomic"
	"testing"
	"time"
)

func TestPollBalancesCoalescesStartupAndManualTriggers(t *testing.T) {
	previousPollInterval := pollInterval
	// Test flow:
	// - Setup: disable timer-triggered refreshes so only startup + manual triggers are in play.
	// - Logic: block the first (startup) global update, enqueue more global triggers while it is blocked,
	//   then release it.
	// - Expectation: we should get exactly one extra global run after the first one finishes
	//   (coalescing), not one run per trigger.
	pollInterval = time.Hour
	defer func() {
		pollInterval = previousPollInterval
	}()

	accountUpdates := make(chan *Account, 1)
	firstGlobalStarted := make(chan struct{})
	releaseFirstGlobal := make(chan struct{})
	pollDone := make(chan struct{})

	var globalCalls int32
	updater := NewUpdater(accountUpdates, nil, nil, func() error {
		call := atomic.AddInt32(&globalCalls, 1)
		if call == 1 {
			// Keep the first run in-flight so we can simulate concurrent incoming signals.
			close(firstGlobalStarted)
			<-releaseFirstGlobal
		}
		return nil
	})

	go func() {
		defer close(pollDone)
		updater.PollBalances()
	}()

	<-firstGlobalStarted

	accountUpdates <- nil
	updater.EnqueueUpdateForAllAccounts()
	updater.EnqueueUpdateForAllAccounts()
	updater.EnqueueUpdateForAllAccounts()
	close(releaseFirstGlobal)

	require.Eventually(t, func() bool {
		return atomic.LoadInt32(&globalCalls) == 2
	}, time.Second, 10*time.Millisecond, "expected startup run + one coalesced follow-up global run")
	// Let the loop settle and verify there is no hidden third run.
	time.Sleep(30 * time.Millisecond)
	require.Equal(t, int32(2), atomic.LoadInt32(&globalCalls), "global update count should remain stable after coalescing")

	updater.Close()
	require.Eventually(t, func() bool {
		select {
		case <-pollDone:
			return true
		default:
			return false
		}
	}, time.Second, 10*time.Millisecond, "PollBalances should exit after updater.Close()")
}

func TestPollBalancesDoesNotRunOverlappingGlobalUpdates(t *testing.T) {
	previousPollInterval := pollInterval
	// Test flow:
	// - Setup: make poll ticks frequent.
	// - Logic: make each global update slow enough that new ticks arrive before it finishes.
	// - Expectation: updates are serialized (max in-flight stays at 1), even under timer pressure.
	pollInterval = 15 * time.Millisecond
	defer func() {
		pollInterval = previousPollInterval
	}()

	pollDone := make(chan struct{})
	var inflight int32
	var maxInflight int32
	var globalCalls int32

	updater := NewUpdater(nil, nil, nil, func() error {
		currentInflight := atomic.AddInt32(&inflight, 1)
		for {
			max := atomic.LoadInt32(&maxInflight)
			if currentInflight <= max || atomic.CompareAndSwapInt32(&maxInflight, max, currentInflight) {
				break
			}
		}
		atomic.AddInt32(&globalCalls, 1)
		// Slower than pollInterval so the scheduler is constantly tempted to overlap runs.
		time.Sleep(45 * time.Millisecond)
		atomic.AddInt32(&inflight, -1)
		return nil
	})

	go func() {
		defer close(pollDone)
		updater.PollBalances()
	}()

	require.Eventually(t, func() bool {
		return atomic.LoadInt32(&globalCalls) >= 2
	}, time.Second, 10*time.Millisecond, "expected repeated timer pressure to trigger multiple serialized global runs")

	updater.Close()
	require.Eventually(t, func() bool {
		select {
		case <-pollDone:
			return true
		default:
			return false
		}
	}, time.Second, 10*time.Millisecond, "PollBalances should exit after updater.Close()")

	require.Eventually(t, func() bool {
		return atomic.LoadInt32(&inflight) == 0
	}, time.Second, 10*time.Millisecond, "all in-flight update callbacks should complete before the test ends")
	require.Equal(t, int32(1), atomic.LoadInt32(&maxInflight), "global updates must not overlap")
}
