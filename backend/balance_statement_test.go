// SPDX-License-Identifier: Apache-2.0

package backend

import (
	"testing"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	accountsmock "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/mocks"
	coinpkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/stretchr/testify/require"
)

func TestBalanceAtSnapshotDate(t *testing.T) {
	date1 := time.Date(2025, 1, 1, 10, 0, 0, 0, time.UTC)
	date2 := time.Date(2025, 1, 2, 10, 0, 0, 0, time.UTC)

	account := &accountsmock.InterfaceMock{
		TransactionsFunc: func() (accounts.OrderedTransactions, error) {
			return accounts.OrderedTransactions{
				{
					Height:    2,
					Timestamp: &date2,
					Balance:   coinpkg.NewAmountFromInt64(200),
				},
				{
					Height:    1,
					Timestamp: &date1,
					Balance:   coinpkg.NewAmountFromInt64(100),
				},
			}, nil
		},
	}

	balance, err := balanceAtSnapshotDate(account, time.Date(2025, 1, 1, 23, 59, 59, 0, time.UTC))
	require.NoError(t, err)
	require.Equal(t, coinpkg.NewAmountFromInt64(100), balance)
}

func TestBalanceAtSnapshotDateMissingConfirmedTimestamp(t *testing.T) {
	account := &accountsmock.InterfaceMock{
		TransactionsFunc: func() (accounts.OrderedTransactions, error) {
			return accounts.OrderedTransactions{
				{
					Height:  1,
					Balance: coinpkg.NewAmountFromInt64(100),
				},
			}, nil
		},
	}

	_, err := balanceAtSnapshotDate(account, time.Now())
	require.ErrorContains(t, err, "timestamp")
}

func TestExportBalanceStatementRejectsFutureDate(t *testing.T) {
	b := newBackend(t, testnetDisabled, regtestDisabled)
	defer b.Close()

	err := b.ExportBalanceStatement(nil, time.Now().AddDate(0, 0, 1))
	require.ErrorContains(t, err, "future")
}

func TestCreateBalanceStatementPDF(t *testing.T) {
	pdf, err := createBalanceStatementPDF(
		[]statementRow{
			{
				coinName:  "Bitcoin",
				amount:    "1.23456789",
				unit:      "BTC",
				fiatValue: "100'000.00",
			},
		},
		"CHF",
		"100'000.00",
		time.Date(2025, 12, 31, 0, 0, 0, 0, time.UTC),
		false,
		false,
	)
	require.NoError(t, err)
	require.NotEmpty(t, pdf)
	require.Contains(t, string(pdf), "%PDF-1.4")
	require.Contains(t, string(pdf), "Balance of assets as of ")
	require.Contains(t, string(pdf), "31.12.2025")
	require.Contains(t, string(pdf), "Bitcoin")
	require.Contains(t, string(pdf), "Disclaimer: This is an auto-generated report.")
}

func TestSVGPathToPDFOps(t *testing.T) {
	// A 10x10 square starting at (10, 20) with all supported commands. Placed
	// at (100, 800): SVG y grows down, PDF y grows up.
	ops, err := svgPathToPDFOps("M10 20H20V30L10 30C10 25 10 25 10 20Z", 100, 800)
	require.NoError(t, err)
	require.Equal(t,
		"110.00 780.00 m 120.00 780.00 l 120.00 770.00 l 110.00 770.00 l "+
			"110.00 775.00 110.00 775.00 110.00 780.00 c h",
		ops)

	// The BitBox logo path must convert without error.
	logoOps, err := svgPathToPDFOps(bitboxLogoPath, 0, 0)
	require.NoError(t, err)
	require.NotEmpty(t, logoOps)

	_, err = svgPathToPDFOps("Q1 2", 0, 0)
	require.Error(t, err)

	// Coordinates after Z are invalid; must error instead of looping.
	_, err = svgPathToPDFOps("M0 0 L1 1 Z 1 2", 0, 0)
	require.Error(t, err)
}

func TestPDFTextWidth(t *testing.T) {
	// Space is 278/1000 wide in both Helvetica variants.
	require.InDelta(t, 2.78, pdfTextWidth(" ", 10, pdfFontRegular), 0.001)
	// 'A' is 667/1000 regular and 722/1000 bold.
	require.InDelta(t, 6.67, pdfTextWidth("A", 10, pdfFontRegular), 0.001)
	require.InDelta(t, 7.22, pdfTextWidth("A", 10, pdfFontBold), 0.001)
	// Non-ASCII characters are measured as '?' (556/1000), mirroring pdfEscape.
	require.InDelta(t, 5.56, pdfTextWidth("ä", 10, pdfFontRegular), 0.001)
}
