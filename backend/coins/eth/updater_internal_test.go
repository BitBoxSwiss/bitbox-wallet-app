// SPDX-License-Identifier: Apache-2.0

package eth

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestActiveAccountLease(t *testing.T) {
	now := time.Unix(1000, 0)
	updater := NewUpdater(nil, nil, nil, nil)
	updater.timeNow = func() time.Time { return now }

	account := &Account{}
	updater.SetAccountActivity(account, true)
	require.Equal(t, []*Account{account}, updater.activeAccounts())

	now = now.Add(activeProbeLeaseDuration + time.Second)
	require.Empty(t, updater.activeAccounts())

	updater.SetAccountActivity(account, true)
	updater.SetAccountActivity(account, false)
	require.Empty(t, updater.activeAccounts())
}
