// SPDX-License-Identifier: Apache-2.0

package backend

import (
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/config"
	"github.com/stretchr/testify/require"
)

func accountsSnapshot(t *testing.T, backend *Backend) config.AccountsConfig {
	t.Helper()
	accountsConfig, err := backend.accountsDB.Snapshot()
	require.NoError(t, err)
	return accountsConfig
}
