// SPDX-License-Identifier: Apache-2.0

package backend

import (
	"context"
	"errors"
	"fmt"
	"math/big"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	accountsmock "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/mocks"
	accountsTypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/types"
	coinpkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/erc20"
	rpcmock "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/rpcclient/mocks"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/config"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/rates"
	utilcfg "github.com/BitBoxSwiss/bitbox-wallet-app/util/config"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
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

// Sepolia selections, including mixed selections, must fail before any account
// initialization or PDF creation because the provider cannot return historical balances.
func TestExportBalanceStatementRejectsSepolia(t *testing.T) {
	for _, test := range []struct {
		name         string
		accountCodes []accountsTypes.Code
	}{
		{"Sepolia only", []accountsTypes.Code{"v0-55555555-sepeth-0"}},
		{"mixed accounts", []accountsTypes.Code{"v0-55555555-tbtc-0", "v0-55555555-sepeth-0"}},
	} {
		t.Run(test.name, func(t *testing.T) {
			b := newBackend(t, testnetEnabled, regtestDisabled)
			defer b.Close()
			filename := filepath.Join(t.TempDir(), "statement.pdf")
			b.environment = fileExportEnvironment{filename: filename}
			b.registerKeystore(makeBitBox02Multi())
			for _, accountCode := range test.accountCodes {
				view := b.Accounts().lookup(accountCode)
				require.NotNil(t, view)
				view.Account.(*accountsmock.InterfaceMock).InitializeFunc = func() error {
					return errors.New("unsupported selections must fail before account initialization")
				}
			}

			err := b.ExportBalanceStatement(test.accountCodes, time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC))
			require.ErrorIs(t, err, errp.ErrorCode("sepoliaBalanceStatementUnsupported"))
			require.NoFileExists(t, filename)
		})
	}
}

// Native ETH snapshots use on-chain historical balances, including withdrawals
// absent from transaction history, and pass no token contract to the provider.
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
				HistoricalBalanceAtFunc: func(context.Context, common.Address, time.Time, *erc20.Token) (*big.Int, error) {
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
			require.Nil(t, calls[0].Erc20Token)
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

// Token snapshots use exact on-chain balances even when transfer history is
// incomplete or omits issuer burns; provider failures must not fall back to history.
func TestExportBalanceStatementERC20ChainBalance(t *testing.T) {
	snapshotDate := time.Date(2025, 1, 1, 0, 0, 0, 0, time.FixedZone("UTC+1", 3600))
	beforeSnapshot := snapshotDate.Add(12 * time.Hour)
	afterSnapshot := snapshotDate.AddDate(0, 0, 1).Add(12 * time.Hour)
	for _, test := range []struct {
		name             string
		tokenCode        coinpkg.Code
		currentBalance   int64
		snapshotAmount   int64
		transferType     accounts.TxType
		transferAmount   int64
		transferAfter    bool
		beforeDeployment bool
		currentDay       bool
		lookupError      bool
		pdfAmount        string
	}{
		{
			name: "older deposits absent from transfer history", currentBalance: 90_000_000,
			snapshotAmount: 90_000_000, transferType: accounts.TxTypeSend, transferAmount: 10_000_000,
			pdfAmount: "90 USDT",
		},
		{
			name: "snapshot predates fetched transfers", currentBalance: 50_000_000,
			snapshotAmount: 75_000_000, transferType: accounts.TxTypeSend, transferAmount: 25_000_000,
			transferAfter: true, pdfAmount: "75 USDT",
		},
		{
			name: "no transfers and six decimal precision", currentBalance: 100_000_001,
			snapshotAmount: 100_000_001, pdfAmount: "100.000001 USDT",
		},
		{
			name: "issuer destroyed funds", transferType: accounts.TxTypeReceive,
			transferAmount: 100_000_000, pdfAmount: "0 USDT",
		},
		{
			name: "snapshot before token deployment", currentBalance: 100_000_000,
			transferType: accounts.TxTypeReceive, transferAmount: 100_000_000,
			beforeDeployment: true, pdfAmount: "0 USDT",
		},
		{
			name: "current day", currentBalance: 123_456_789, snapshotAmount: 123_456_789,
			currentDay: true, pdfAmount: "123.456789 USDT",
		},
		{
			name: "lookup failure with available history", currentBalance: 100_000_000,
			transferType: accounts.TxTypeReceive, transferAmount: 100_000_000, lookupError: true,
		},
		{
			name: "eighteen decimal precision", tokenCode: "eth-erc20-bat",
			snapshotAmount: 1_234_567_890_123_456_789, pdfAmount: "1.234567890123456789 BAT",
		},
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
				HistoricalBalanceAtFunc: func(context.Context, common.Address, time.Time, *erc20.Token) (*big.Int, error) {
					if test.lookupError {
						return nil, errors.New("historical token balance unavailable")
					}
					return big.NewInt(test.snapshotAmount), nil
				},
			}
			tokenCode := test.tokenCode
			if tokenCode == "" {
				tokenCode = "eth-erc20-usdt"
			}
			tokenCoin, err := b.Coin(tokenCode)
			require.NoError(t, err)
			tokenCoin.(*eth.Coin).TstSetClient(client)
			b.registerKeystore(makeBitBox02Multi())
			const parentCode accountsTypes.Code = "v0-55555555-eth-0"
			require.NoError(t, b.SetTokenActive(parentCode, string(tokenCode), true))
			accountCode := Erc20AccountCode(parentCode, string(tokenCode))
			view := b.Accounts().lookup(accountCode)
			require.NotNil(t, view)
			account := view.Account.(*eth.Account)
			transactions := []*accounts.TransactionData{}
			if test.transferType != "" {
				timestamp := beforeSnapshot
				if test.transferAfter {
					timestamp = afterSnapshot
				}
				transactions = append(transactions, &accounts.TransactionData{
					Height: 1, Timestamp: &timestamp, Type: test.transferType,
					Status: accounts.TxStatusComplete, Amount: coinpkg.NewAmountFromInt64(test.transferAmount),
					IsErc20: true, FeeIsDifferentUnit: true, TxID: "token-transfer", InternalID: "token-transfer",
				})
			}
			require.NoError(t, account.Update(big.NewInt(test.currentBalance), big.NewInt(100), transactions, nil))
			currentBalance, err := account.Balance()
			require.NoError(t, err)
			require.Equal(t, coinpkg.NewAmountFromInt64(test.currentBalance), currentBalance.Available())
			address, err := account.Address()
			require.NoError(t, err)

			date := snapshotDate
			before := time.Now()
			if test.currentDay {
				date = before
			} else if test.beforeDeployment {
				date = time.Date(2017, 11, 1, 0, 0, 0, 0, time.UTC)
			}
			err = b.ExportBalanceStatement([]accountsTypes.Code{accountCode}, date)
			calls := client.HistoricalBalanceAtCalls()
			require.Len(t, calls, 1)
			require.Equal(t, address.Address, calls[0].Account)
			require.NotNil(t, calls[0].Erc20Token)
			require.Equal(t, erc20TokenByCode(tokenCode).token.ContractAddress(), calls[0].Erc20Token.ContractAddress())
			if test.currentDay {
				require.False(t, calls[0].At.Before(before))
				require.False(t, calls[0].At.After(time.Now()))
			} else {
				require.Equal(t, date.AddDate(0, 0, 1).Add(-time.Nanosecond), calls[0].At)
			}
			if test.lookupError {
				require.ErrorContains(t, err, "historical token balance unavailable")
				require.NoFileExists(t, filename)
				return
			}
			require.NoError(t, err)
			pdf, err := os.ReadFile(filename)
			require.NoError(t, err)
			require.Contains(t, string(pdf), "("+test.pdfAmount+")")
		})
	}
}

// A mixed native/token export queries each account at the same end-of-day
// snapshot and forwards the token contract only for the ERC20 balance.
func TestExportBalanceStatementETHAndERC20Snapshot(t *testing.T) {
	b := newBackend(t, testnetDisabled, regtestDisabled)
	defer b.Close()
	filename := filepath.Join(t.TempDir(), "statement.pdf")
	b.environment = fileExportEnvironment{filename: filename}
	b.makeEthAccount = func(config *accounts.AccountConfig, coin *eth.Coin, log *logrus.Entry) accounts.Interface {
		return eth.NewAccount(config, coin, b.ethOutgoing, log, make(chan struct{}, 1))
	}
	client := &rpcmock.InterfaceMock{
		HistoricalBalanceAtFunc: func(_ context.Context, _ common.Address, _ time.Time, token *erc20.Token) (*big.Int, error) {
			if token == nil {
				return big.NewInt(1e18), nil
			}
			return big.NewInt(100_000_000), nil
		},
	}
	for _, coinCode := range []coinpkg.Code{coinpkg.CodeETH, "eth-erc20-usdt"} {
		coin, err := b.Coin(coinCode)
		require.NoError(t, err)
		coin.(*eth.Coin).TstSetClient(client)
	}
	b.registerKeystore(makeBitBox02Multi())
	const parentCode accountsTypes.Code = "v0-55555555-eth-0"
	require.NoError(t, b.SetTokenActive(parentCode, "eth-erc20-usdt", true))
	snapshotDate := time.Date(2025, 1, 1, 0, 0, 0, 0, time.FixedZone("UTC+1", 3600))
	require.NoError(t, b.ExportBalanceStatement(
		[]accountsTypes.Code{parentCode, Erc20AccountCode(parentCode, "eth-erc20-usdt")}, snapshotDate))
	calls := client.HistoricalBalanceAtCalls()
	require.Len(t, calls, 2)
	require.Equal(t, snapshotDate.AddDate(0, 0, 1).Add(-time.Nanosecond), calls[0].At)
	require.Equal(t, calls[0].At, calls[1].At)
	require.Equal(t, calls[0].Account, calls[1].Account)
	require.Nil(t, calls[0].Erc20Token)
	require.NotNil(t, calls[1].Erc20Token)
	require.Equal(t, erc20TokenByCode("eth-erc20-usdt").token.ContractAddress(), calls[1].Erc20Token.ContractAddress())
	pdf, err := os.ReadFile(filename)
	require.NoError(t, err)
	require.Contains(t, string(pdf), "(1 ETH)")
	require.Contains(t, string(pdf), "(100 USDT)")
}

// Zero holdings have a known fiat value even without rates; nonzero holdings
// must still be reported as unavailable for both historical and current snapshots.
func TestExportBalanceStatementWithoutRates(t *testing.T) {
	for _, snapshotDate := range []time.Time{
		time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC),
		time.Now(),
	} {
		for _, amount := range []int64{0, 100_000_000} {
			t.Run(snapshotDate.Format("2006-01-02")+"/"+big.NewInt(amount).String(), func(t *testing.T) {
				b := newBackend(t, testnetDisabled, regtestDisabled)
				defer b.Close()
				filename := filepath.Join(t.TempDir(), "statement.pdf")
				b.environment = fileExportEnvironment{filename: filename}
				b.registerKeystore(makeBitBox02BTCOnly())
				const accountCode accountsTypes.Code = "v0-55555555-btc-0"
				view := b.Accounts().lookup(accountCode)
				require.NotNil(t, view)
				timestamp := snapshotDate.AddDate(0, 0, -1)
				view.Account.(*accountsmock.InterfaceMock).TransactionsFunc = func() (accounts.OrderedTransactions, error) {
					return accounts.OrderedTransactions{
						{Height: 1, Timestamp: &timestamp, Balance: coinpkg.NewAmountFromInt64(amount)},
					}, nil
				}

				require.NoError(t, b.ExportBalanceStatement([]accountsTypes.Code{accountCode}, snapshotDate))
				pdf, err := os.ReadFile(filename)
				require.NoError(t, err)
				if amount == 0 {
					require.Contains(t, string(pdf), "(0.00000000 BTC)")
					require.Equal(t, 2, strings.Count(string(pdf), "(0.00)"), "both the row and total must be zero")
					require.NotContains(t, string(pdf), "N/A")
					require.NotContains(t, string(pdf), "Latest rates were used")
				} else {
					require.Equal(t, 2, strings.Count(string(pdf), "(N/A)"), "the row and total require a rate for nonzero holdings")
				}
			})
		}
	}
}

// An unpriced zero balance must not hide the total of another asset whose rate is available.
func TestExportBalanceStatementZeroBalancePreservesFiatTotal(t *testing.T) {
	b := newBackend(t, testnetDisabled, regtestDisabled)
	defer b.Close()
	filename := filepath.Join(t.TempDir(), "statement.pdf")
	b.environment = fileExportEnvironment{filename: filename}
	b.registerKeystore(makeBitBox02Multi())
	func() {
		defer b.accountsAndKeystoreLock.Lock()()
		b.ratesUpdater.Stop()
		b.ratesUpdater = rates.MockRateUpdater()
	}()
	const btcAccountCode accountsTypes.Code = "v0-55555555-btc-0"
	const ltcAccountCode accountsTypes.Code = "v0-55555555-ltc-0"
	timestamp := time.Now().AddDate(0, 0, -1)
	for accountCode, amount := range map[accountsTypes.Code]int64{
		btcAccountCode: 100_000_000,
		ltcAccountCode: 0,
	} {
		view := b.Accounts().lookup(accountCode)
		require.NotNil(t, view)
		view.Account.(*accountsmock.InterfaceMock).TransactionsFunc = func() (accounts.OrderedTransactions, error) {
			return accounts.OrderedTransactions{
				{Height: 1, Timestamp: &timestamp, Balance: coinpkg.NewAmountFromInt64(amount)},
			}, nil
		}
	}

	require.NoError(t, b.ExportBalanceStatement([]accountsTypes.Code{btcAccountCode, ltcAccountCode}, time.Now()))
	pdf, err := os.ReadFile(filename)
	require.NoError(t, err)
	require.Contains(t, string(pdf), "(21.00*)")
	require.Contains(t, string(pdf), "(0.00)")
	require.Contains(t, string(pdf), "(Total)")
	require.Contains(t, string(pdf), "(21.00)")
	require.NotContains(t, string(pdf), "N/A")
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

// New and overwritten statements must remain private and contain the exported balance.
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
			require.True(t, strings.HasPrefix(string(pdf), "%PDF-"))
			require.Contains(t, string(pdf), "1.23456789")
			require.NotContains(t, string(pdf), "stale contents")
		})
	}
}

// A single-asset statement includes its snapshot date, balance, and disclaimer.
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
	require.True(t, strings.HasPrefix(string(pdf), "%PDF-"))
	require.Contains(t, string(pdf), "Balance of assets as of ")
	require.Contains(t, string(pdf), "31.12.2025")
	require.Contains(t, string(pdf), "Bitcoin")
	require.Contains(t, string(pdf), "Disclaimer: This is an auto-generated report.")
}

// Page boundaries must preserve every row, repeat table headers and the disclaimer,
// and keep the total and both valuation footnotes together on the final page.
func TestCreateBalanceStatementPDFPagination(t *testing.T) {
	for _, test := range []struct {
		name          string
		rows          int
		pages         int
		firstPageRows int
	}{
		{name: "total fits on first page", rows: 9, pages: 1, firstPageRows: 9},
		{name: "total moves to next page", rows: 10, pages: 2, firstPageRows: 10},
		{name: "rows continue on next page", rows: 12, pages: 2, firstPageRows: 11},
	} {
		t.Run(test.name, func(t *testing.T) {
			rows := make([]statementRow, test.rows)
			for i := range rows {
				rows[i] = statementRow{
					coinName:  fmt.Sprintf("Asset %02d", i+1),
					amount:    "1.00000000",
					unit:      "BTC",
					fiatValue: "100.00",
				}
			}
			rows[0].hasEstimatedFiat = true
			rows[len(rows)-1].fiatValue = "N/A"
			pdf, err := createBalanceStatementPDF(
				rows, "CHF", "N/A", time.Date(2025, 12, 31, 0, 0, 0, 0, time.UTC), true, true)
			require.NoError(t, err)

			// Content streams are uncompressed; the table header distinguishes pages from image streams.
			var pages []string
			for _, stream := range regexp.MustCompile(`(?s)\bstream\r?\n(.*?)\r?\nendstream\b`).FindAllStringSubmatch(string(pdf), -1) {
				if strings.Contains(stream[1], "(Asset)") {
					pages = append(pages, stream[1])
				}
			}
			require.Len(t, pages, test.pages)
			for i, page := range pages {
				require.Contains(t, page, "(Amount)")
				require.Contains(t, page, `Value \(CHF\)`)
				require.Contains(t, page, "Disclaimer: This is an auto-generated report.")
				if i < len(pages)-1 {
					require.NotContains(t, page, "(Total)")
					require.NotContains(t, page, "Latest rates were used")
					require.NotContains(t, page, "Some values were unavailable")
				}
			}
			lastPage := pages[len(pages)-1]
			require.Contains(t, lastPage, "(Total)")
			require.Contains(t, lastPage, "Latest rates were used")
			require.Contains(t, lastPage, "Some values were unavailable")
			require.Contains(t, pages[0], "(100.00*)")
			for i, row := range rows {
				label := "(" + row.coinName + ")"
				require.Equal(t, 1, strings.Count(string(pdf), label))
				pageIndex := 0
				if i >= test.firstPageRows {
					pageIndex = 1
				}
				require.Contains(t, pages[pageIndex], label)
			}
		})
	}
}
