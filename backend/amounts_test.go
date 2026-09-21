// SPDX-License-Identifier: Apache-2.0

package backend

import (
	"testing"

	coinpkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/config"
	"github.com/stretchr/testify/require"
)

func setBtcUnit(t *testing.T, b *Backend, unit coinpkg.BtcUnit) {
	t.Helper()
	appConfig := b.Config().AppConfig()
	appConfig.Backend.BtcUnit = unit
	require.NoError(t, b.SetAppConfig(appConfig))
}

func TestBtcUnitPreference(t *testing.T) {
	b := newBackend(t, true, false)
	defer b.Close()
	btcCoin, err := b.Coin(coinpkg.CodeBTC)
	require.NoError(t, err)
	tbtcCoin, err := b.Coin(coinpkg.CodeTBTC)
	require.NoError(t, err)
	amount := coinpkg.NewAmountFromInt64(1)

	for _, tc := range []struct {
		unit                        coinpkg.BtcUnit
		amount, btcLabel, tbtcLabel string
	}{
		{coinpkg.BtcUnitSats, "1", "sat", "tsat"},
		{coinpkg.BtcUnitDefault, "0.00000001", "BTC", "TBTC"},
	} {
		setBtcUnit(t, b, tc.unit)
		require.Equal(t, tc.amount, btcCoin.FormatAmount(amount, false))
		require.Equal(t, tc.amount, tbtcCoin.FormatAmount(amount, false))
		require.Equal(t, tc.btcLabel, btcCoin.GetFormatUnit(false))
		require.Equal(t, tc.tbtcLabel, tbtcCoin.GetFormatUnit(false))
		persisted, err := config.NewConfig(b.arguments.AppConfigFilename(), b.arguments.AccountsConfigFilename(), b.arguments.LightningConfigFilename())
		require.NoError(t, err)
		require.Equal(t, tc.unit, persisted.AppConfig().Backend.BtcUnit)
	}
}

func TestParseExternalBTCAmount(t *testing.T) {
	b := newBackend(t, true, false)
	defer b.Close()
	for _, tc := range []struct {
		unit coinpkg.BtcUnit
		want string
	}{
		{coinpkg.BtcUnitDefault, "0.00000002"},
		{coinpkg.BtcUnitSats, "2"},
	} {
		setBtcUnit(t, b, tc.unit)
		amount, err := b.ParseExternalBTCAmount("0.000000015")
		require.NoError(t, err)
		require.Equal(t, tc.want, amount)
	}
	_, err := b.ParseExternalBTCAmount("invalid")
	require.EqualError(t, err, "invalid amount")
}

func TestCurrencyConversions(t *testing.T) {
	b := newBackend(t, true, false)
	defer b.Close()
	for _, unit := range []string{"BTC", "TBTC", "RBTC"} {
		b.ratesUpdater.LatestPrice()[unit] = map[string]float64{"USD": 25000, "BTC": 1, "sat": 1e8, "zero": 0}
	}
	for _, unit := range []string{"LTC", "TLTC"} {
		b.ratesUpdater.LatestPrice()[unit] = map[string]float64{"USD": 250}
	}
	for _, unit := range []string{"ETH", "SEPETH"} {
		b.ratesUpdater.LatestPrice()[unit] = map[string]float64{"USD": 2000}
	}
	b.ratesUpdater.LatestPrice()["USDC"] = map[string]float64{"USD": 1}

	for _, unit := range []coinpkg.BtcUnit{coinpkg.BtcUnitDefault, coinpkg.BtcUnitSats} {
		setBtcUnit(t, b, unit)
		btcAmount, btcZero, btcNegative, btcOneSat := "0.00100000", "0.00000000", "-0.00100000", "0.00000001"
		if unit == coinpkg.BtcUnitSats {
			btcAmount, btcZero, btcNegative, btcOneSat = "100000", "0", "-100000", "1"
		}
		for _, tc := range []struct {
			coinCode                coinpkg.Code
			currency, amount, value string
		}{
			{coinpkg.CodeBTC, "USD", btcAmount, "25.00"},
			{coinpkg.CodeTBTC, "USD", btcAmount, "25.00"},
			{coinpkg.CodeRBTC, "USD", "0.00100000", "25.00"},
			{coinpkg.CodeLTC, "USD", "0.00100000", "0.25"},
			{coinpkg.CodeTLTC, "USD", "0.00100000", "0.25"},
			{coinpkg.CodeETH, "USD", "0.001", "2.00"},
			{coinpkg.CodeSEPETH, "USD", "0.001", "2.00"},
			{"eth-erc20-usdc", "USD", "1.10", "1.10"},
			{coinpkg.CodeBTC, "USD", btcZero, "0.00"},
			{coinpkg.CodeBTC, "USD", btcNegative, "-25.00"},
			{coinpkg.CodeBTC, "BTC", btcAmount, "0.00100000"},
			{coinpkg.CodeBTC, "sat", btcAmount, "100000"},
		} {
			t.Run(string(unit)+"/"+string(tc.coinCode)+"/"+tc.currency+"/"+tc.amount, func(t *testing.T) {
				amount, err := b.ConvertFromCurrency(tc.coinCode, tc.currency, tc.value)
				require.NoError(t, err)
				require.Equal(t, tc.amount, amount)
				value, err := b.ConvertToCurrency(tc.coinCode, tc.currency, tc.amount)
				require.NoError(t, err)
				require.Equal(t, tc.value, value)
			})
		}
		for _, currency := range []string{"missing", "zero"} {
			amount, err := b.ConvertFromCurrency(coinpkg.CodeBTC, currency, "1")
			require.NoError(t, err)
			require.Equal(t, btcZero, amount)
			value, err := b.ConvertToCurrency(coinpkg.CodeBTC, currency, "1")
			require.NoError(t, err)
			require.Equal(t, "0.00", value)
		}
		amount, err := b.ConvertFromCurrency(coinpkg.CodeBTC, "USD", "0.000125")
		require.NoError(t, err)
		require.Equal(t, btcOneSat, amount)
	}
}

func TestBTCSatAmount(t *testing.T) {
	b := newBackend(t, true, false)
	defer b.Close()

	b.ratesUpdater.LatestPrice()["BTC"] = map[string]float64{
		"BTC": 1,
		"sat": 100000000,
		"USD": 25000,
	}

	for _, unit := range []coinpkg.BtcUnit{coinpkg.BtcUnitDefault, coinpkg.BtcUnitSats} {
		setBtcUnit(t, b, unit)

		for _, tt := range []struct {
			name        string
			source      string
			amount      string
			rate        float64
			rateMissing bool
			errContains string
		}{
			{
				name:   "sat",
				source: "sat",
				amount: "200",
				rate:   25000,
			},
			{
				name:   "fiat",
				source: "fiat",
				amount: "0.05",
				rate:   25000,
			},
			{
				name:        "invalid source",
				source:      "invalid",
				amount:      "200",
				rate:        25000,
				errContains: "invalid source",
			},
			{
				name:        "invalid sat amount",
				source:      "sat",
				amount:      "invalid",
				rate:        25000,
				errContains: "invalid amount",
			},
			{
				name:        "negative sat amount",
				source:      "sat",
				amount:      "-1",
				rate:        25000,
				errContains: "amount must be non-negative",
			},
			{
				name:        "invalid fiat amount",
				source:      "fiat",
				amount:      "invalid",
				rate:        25000,
				errContains: "invalid amount",
			},
			{
				name:        "negative fiat amount",
				source:      "fiat",
				amount:      "-0.05",
				rate:        25000,
				errContains: "amount must be non-negative",
			},
			{
				name:        "missing exchange rate",
				source:      "fiat",
				amount:      "0.05",
				rateMissing: true,
				errContains: "exchange rate not available",
			},
			{
				name:        "zero exchange rate",
				source:      "fiat",
				amount:      "0.05",
				rate:        0,
				errContains: "exchange rate not available",
			},
		} {
			t.Run(string(unit)+"/"+tt.name, func(t *testing.T) {
				if tt.rateMissing {
					delete(b.ratesUpdater.LatestPrice()["BTC"], "USD")
				} else {
					b.ratesUpdater.LatestPrice()["BTC"]["USD"] = tt.rate
				}

				amount, err := b.BTCSatAmount(tt.source, tt.amount)
				if tt.errContains != "" {
					require.ErrorContains(t, err, tt.errContains)
					require.Nil(t, amount)
					return
				}

				require.NoError(t, err)
				require.Equal(t, "200", amount.Amount)
				require.Equal(t, "sat", amount.Unit)
				require.Equal(t, "0.05", amount.UnformattedConversions["USD"])
			})
		}
	}
}
