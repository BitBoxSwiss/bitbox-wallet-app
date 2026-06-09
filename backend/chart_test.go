// SPDX-License-Identifier: Apache-2.0

package backend

import (
	"math/big"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestChartPerformanceNeedsPositiveNetInvestment(t *testing.T) {
	require.Equal(t, 0.0, chartPerformance(100, 0))
	require.Equal(t, 0.0, chartPerformance(100, -50))
	require.Equal(t, 1.0, chartPerformance(200, 100))
}

func TestCurrentTotalChartEntryKeepsHistoricalPerformance(t *testing.T) {
	entry := currentTotalChartEntry(
		time.Unix(200, 0),
		big.NewRat(150, 1),
		"USD",
		[]ChartEntry{{
			Time:               100,
			Value:              100,
			Performance:        0.25,
			NetInvestmentValue: 80,
		}},
	)

	require.Equal(t, int64(200), entry.Time)
	require.Equal(t, 150.0, entry.Value)
	require.Equal(t, 0.25, entry.Performance)
	require.Equal(t, 80.0, entry.NetInvestmentValue)
	require.Equal(t, "150.00", entry.FormattedValue)
}

func TestCurrentTotalChartEntryDefaultsWithoutHistory(t *testing.T) {
	entry := currentTotalChartEntry(time.Unix(200, 0), big.NewRat(150, 1), "USD", nil)

	require.Equal(t, 0.0, entry.Performance)
	require.Equal(t, 0.0, entry.NetInvestmentValue)
}
