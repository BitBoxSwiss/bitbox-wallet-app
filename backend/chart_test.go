// SPDX-License-Identifier: Apache-2.0

package backend

import (
	"testing"

	coinpkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/config"
	"github.com/stretchr/testify/require"
)

func TestChartCoinCodesIncludesBitcoinForLightning(t *testing.T) {
	b := newBackend(t, testnetDisabled, regtestDisabled)
	defer b.Close()

	require.NoError(t, b.lightning.SetAccount(&config.LightningAccountConfig{
		Seed:            "test mnemonic",
		RootFingerprint: []byte{0xde, 0xad, 0xbe, 0xef},
		Code:            "v0-deadbeef-ln-0",
		Number:          0,
	}))

	require.Equal(t, []string{string(coinpkg.CodeBTC)}, b.chartCoinCodes())
}
