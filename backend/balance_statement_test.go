// SPDX-License-Identifier: Apache-2.0

package backend

import (
	"context"
	"errors"
	"math/big"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	accountsmock "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/mocks"
	accountsTypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/types"
	coinpkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth"
	rpcmock "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/rpcclient/mocks"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/config"
	utilcfg "github.com/BitBoxSwiss/bitbox-wallet-app/util/config"
	"github.com/ethereum/go-ethereum/common"
	"github.com/sirupsen/logrus"
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

func TestExportBalanceStatementETHChainBalance(t *testing.T) {
	snapshotDate := time.Date(2025, 1, 1, 0, 0, 0, 0, time.FixedZone("UTC+1", 3600))
	for _, test := range []struct {
		name           string
		currentBalance int64
		snapshotAmount int64
		currentDay     bool
		lookupError    bool
	}{
		{name: "validator withdrawal without transactions", currentBalance: 1e18, snapshotAmount: 1e18},
		{name: "historical balance spent later", snapshotAmount: 1e18},
		{name: "zero balance"},
		{name: "current day", currentBalance: 1e18, snapshotAmount: 1e18, currentDay: true},
		{name: "lookup failure", lookupError: true},
	} {
		t.Run(test.name, func(t *testing.T) {
			b := newBackend(t, testnetDisabled, regtestDisabled)
			defer b.Close()
			filename := filepath.Join(t.TempDir(), "statement.pdf")
			b.environment = fileExportEnvironment{filename: filename}
			b.makeEthAccount = func(config *accounts.AccountConfig, coin *eth.Coin, log *logrus.Entry) accounts.Interface {
				return eth.NewAccount(config, coin, b.ethOutgoing, log, make(chan struct{}, 1))
			}
			client := &rpcmock.InterfaceMock{
				HistoricalBalanceAtFunc: func(context.Context, common.Address, time.Time) (*big.Int, error) {
					if test.lookupError {
						return nil, errors.New("historical balance unavailable")
					}
					return big.NewInt(test.snapshotAmount), nil
				},
			}
			ethCoin, err := b.Coin(coinpkg.CodeETH)
			require.NoError(t, err)
			ethCoin.(*eth.Coin).TstSetClient(client)
			b.registerKeystore(makeBitBox02Multi())
			const accountCode accountsTypes.Code = "v0-55555555-eth-0"
			view := b.Accounts().lookup(accountCode)
			require.NotNil(t, view)
			account := view.Account.(*eth.Account)
			require.NoError(t, account.Initialize())
			require.NoError(t, account.Update(big.NewInt(test.currentBalance), big.NewInt(100), []*accounts.TransactionData{}, nil))
			transactions, err := account.Transactions()
			require.NoError(t, err)
			require.Empty(t, transactions)
			currentBalance, err := account.Balance()
			require.NoError(t, err)
			require.Equal(t, coinpkg.NewAmountFromInt64(test.currentBalance), currentBalance.Available())
			address, err := account.Address()
			require.NoError(t, err)

			date := snapshotDate
			before := time.Now()
			if test.currentDay {
				date = before
			}
			err = b.ExportBalanceStatement([]accountsTypes.Code{accountCode}, date)
			if test.lookupError {
				require.ErrorContains(t, err, "historical balance unavailable")
				require.NoFileExists(t, filename)
				return
			}
			require.NoError(t, err)
			calls := client.HistoricalBalanceAtCalls()
			require.Len(t, calls, 1)
			require.Equal(t, address.Address, calls[0].Account)
			if test.currentDay {
				require.False(t, calls[0].At.Before(before))
				require.False(t, calls[0].At.After(time.Now()))
			} else {
				require.Equal(t, snapshotDate.AddDate(0, 0, 1).Add(-time.Nanosecond), calls[0].At)
			}
			pdf, err := os.ReadFile(filename)
			require.NoError(t, err)
			if test.snapshotAmount == 0 {
				require.Contains(t, string(pdf), "(0 ETH)")
			} else {
				require.Contains(t, string(pdf), "(1 ETH)")
			}
		})
	}
}

func TestExportBalanceStatementUsesPersistedAccountMetadata(t *testing.T) {
	b := newBackend(t, testnetDisabled, regtestDisabled)
	defer b.Close()
	filename := filepath.Join(t.TempDir(), "statement.pdf")
	b.environment = fileExportEnvironment{filename: filename}
	b.registerKeystore(makeBitBox02BTCOnly())

	const accountCode accountsTypes.Code = "v0-55555555-btc-0"
	view := b.Accounts().lookup(accountCode)
	require.NotNil(t, view)
	timestamp := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	view.Account.(*accountsmock.InterfaceMock).TransactionsFunc = func() (accounts.OrderedTransactions, error) {
		return accounts.OrderedTransactions{
			{Height: 1, Timestamp: &timestamp, Balance: coinpkg.NewAmountFromInt64(123456789)},
		}, nil
	}
	for _, test := range []struct {
		name     string
		inactive bool
		hidden   bool
	}{
		{name: "active"},
		{name: "inactive", inactive: true},
		{name: "hidden", hidden: true},
	} {
		t.Run(test.name, func(t *testing.T) {
			require.NoError(t, b.accountsDB.Update(func(accountsConfig *config.AccountsConfig) error {
				record := accountsConfig.Lookup(accountCode)
				record.Inactive = test.inactive
				record.HiddenBecauseUnused = test.hidden
				return nil
			}))

			err := b.ExportBalanceStatement([]accountsTypes.Code{accountCode}, timestamp)
			if test.inactive || test.hidden {
				require.ErrorContains(t, err, "is not active")
				return
			}
			require.NoError(t, err)
			pdf, err := os.ReadFile(filename)
			require.NoError(t, err)
			require.Contains(t, string(pdf), "Bitcoin")
			require.Contains(t, string(pdf), "1.23456789")
		})
	}
}

func TestExportBalanceStatementRestrictsFilePermissions(t *testing.T) {
	for _, name := range []string{"new", "existing"} {
		t.Run(name, func(t *testing.T) {
			b := newBackend(t, testnetDisabled, regtestDisabled)
			defer b.Close()
			filename := filepath.Join(t.TempDir(), "statement.pdf")
			if name == "existing" {
				require.NoError(t, os.WriteFile(filename, []byte("stale contents"), 0644))
				require.NoError(t, os.Chmod(filename, 0644))
			}
			b.environment = fileExportEnvironment{filename: filename}
			b.registerKeystore(makeBitBox02BTCOnly())
			const accountCode accountsTypes.Code = "v0-55555555-btc-0"
			view := b.Accounts().lookup(accountCode)
			require.NotNil(t, view)
			timestamp := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
			view.Account.(*accountsmock.InterfaceMock).TransactionsFunc = func() (accounts.OrderedTransactions, error) {
				return accounts.OrderedTransactions{
					{Height: 1, Timestamp: &timestamp, Balance: coinpkg.NewAmountFromInt64(123456789)},
				}, nil
			}

			require.NoError(t, b.ExportBalanceStatement([]accountsTypes.Code{accountCode}, timestamp))

			info, err := os.Stat(filename)
			require.NoError(t, err)
			require.Equal(t, utilcfg.PrivateFileMode, info.Mode().Perm())
			pdf, err := os.ReadFile(filename)
			require.NoError(t, err)
			require.Contains(t, string(pdf), "%PDF-1.4")
			require.Contains(t, string(pdf), "1.23456789")
			require.NotContains(t, string(pdf), "stale contents")
		})
	}
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
