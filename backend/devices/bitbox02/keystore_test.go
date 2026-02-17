// SPDX-License-Identifier: Apache-2.0

package bitbox02

import (
	"testing"

	coinpkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/stretchr/testify/require"
)

func TestCanSignMessage(t *testing.T) {
	ks := &keystore{}

	require.True(t, ks.CanSignMessage(coinpkg.CodeBTC))
	require.True(t, ks.CanSignMessage(coinpkg.CodeTBTC))
	require.False(t, ks.CanSignMessage(coinpkg.CodeLTC))
	require.False(t, ks.CanSignMessage(coinpkg.CodeTLTC))
	require.True(t, ks.CanSignMessage(coinpkg.CodeETH))
	require.True(t, ks.CanSignMessage(coinpkg.CodeRBTC))
}
