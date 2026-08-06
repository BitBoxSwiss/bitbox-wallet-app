// SPDX-License-Identifier: Apache-2.0

package eth

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestEVMChainCapabilities(t *testing.T) {
	expectedChainIDs := []uint64{
		1,
		10,
		56,
		100,
		137,
		146,
		999,
		8453,
		42161,
		11155111,
	}

	require.Len(t, evmChainCapabilities, len(expectedChainIDs))
	for _, chainID := range expectedChainIDs {
		capabilities, ok := evmChainCapabilities[chainID]
		require.Truef(t, ok, "chain %d is not registered", chainID)
		require.Truef(
			t,
			capabilities.SupportsType2Transactions,
			"chain %d does not support type-2 transactions",
			chainID,
		)
	}
}
