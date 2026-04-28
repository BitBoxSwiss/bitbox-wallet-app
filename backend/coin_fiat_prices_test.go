// SPDX-License-Identifier: Apache-2.0

package backend

import (
	"encoding/json"
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc"
	coinpkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/rates"
	"github.com/stretchr/testify/require"
)

func TestCoinFiatPricesJSONAndBtcSatMode(t *testing.T) {
	b := newBackend(t, testnetDisabled, regtestDisabled)
	b.ratesUpdater.Stop()
	b.ratesUpdater = rates.MockRateUpdater()
	defer b.Close()

	btcCoin, err := b.Coin(coinpkg.CodeBTC)
	require.NoError(t, err)
	btcCoin.(*btc.Coin).SetFormatUnit(coinpkg.BtcUnitSats)

	prices := b.CoinFiatPrices(btcCoin)
	require.Equal(t, "21.00", prices["USD"])

	jsonBytes, err := json.Marshal(prices)
	require.NoError(t, err)
	require.JSONEq(t, `{
		"CHF": "19.00",
		"EUR": "18.00",
		"USD": "21.00"
	}`, string(jsonBytes))
}
