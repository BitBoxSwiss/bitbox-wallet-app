// SPDX-License-Identifier: Apache-2.0

package eth

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"strings"
	"sync/atomic"
	"testing"
	"testing/synctest"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	accountmocks "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/mocks"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/erc20"
	"github.com/ethereum/go-ethereum/common"
	gethtypes "github.com/ethereum/go-ethereum/core/types"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"golang.org/x/time/rate"
)

func TestActiveAccountLease(t *testing.T) {
	now := time.Unix(1000, 0)
	updater := NewUpdater(nil, nil, nil, nil)
	updater.timeNow = func() time.Time { return now }

	account := &Account{}
	updater.SetAccountActivity(account, true)
	require.Equal(t, []*Account{account}, updater.activeAccounts())

	now = now.Add(activeProbeLeaseDuration + time.Second)
	require.Empty(t, updater.activeAccounts())

	updater.SetAccountActivity(account, true)
	updater.SetAccountActivity(account, false)
	require.Empty(t, updater.activeAccounts())
}

func TestActiveAccountBalanceUpdates(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		account := newAccountWithOptions(t, true, nil)
		defer account.Close()
		address, err := account.Address()
		require.NoError(t, err)
		header, err := json.Marshal(&gethtypes.Header{Number: big.NewInt(101), Difficulty: big.NewInt(0)})
		require.NoError(t, err)

		var remoteBalance atomic.Int64
		requests := make(chan string, 10)
		client := &http.Client{Transport: chainClientRoundTripFunc(func(request *http.Request) (*http.Response, error) {
			query := request.URL.Query()
			action := query.Get("action")
			requests <- action + " " + query.Get("tag")
			var body string
			switch action {
			case "balancemulti":
				body = fmt.Sprintf(`{"status":"1","result":[{"account":%q,"balance":"%d"}]}`, address.Address.Hex(), remoteBalance.Load())
			case "eth_getBlockByNumber":
				body = fmt.Sprintf(`{"jsonrpc":"2.0","id":1,"result":%s}`, header)
			default:
				return nil, fmt.Errorf("unexpected action: %s", action)
			}
			return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(body))}, nil
		})}
		updater := NewUpdater(nil, client, rate.NewLimiter(rate.Inf, 1), func() error { return nil })
		defer updater.Close()
		updater.SetAccountActivity(account, true)
		go updater.PollBalances()
		synctest.Wait()

		time.Sleep(time.Minute)
		synctest.Wait()
		require.Len(t, requests, 1)
		require.Equal(t, "balancemulti latest", <-requests)

		remoteBalance.Store(1000)
		updater.SetAccountActivity(account, true)
		time.Sleep(time.Minute)
		synctest.Wait()
		require.Len(t, requests, 3)
		require.Equal(t, "balancemulti latest", <-requests)
		require.Equal(t, "eth_getBlockByNumber latest", <-requests)
		require.Equal(t, "balancemulti 0x65", <-requests)
		require.Equal(t, big.NewInt(1000), account.remoteBalance())

		time.Sleep(29 * time.Second)
		synctest.Wait()
		require.Empty(t, requests)
		time.Sleep(time.Second)
		synctest.Wait()
		require.Len(t, requests, 2)
		require.Equal(t, "eth_getBlockByNumber latest", <-requests)
		require.Equal(t, "balancemulti 0x65", <-requests)

		updater.SetAccountActivity(account, true)
		time.Sleep(30 * time.Second)
		synctest.Wait()
		require.Len(t, requests, 1)
		require.Equal(t, "balancemulti latest", <-requests)
	})
}

func TestActiveAccountProbesDoNotOverlap(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		account := newAccountWithOptions(t, true, nil)
		defer account.Close()
		address, err := account.Address()
		require.NoError(t, err)
		release := make(chan struct{})
		defer close(release)
		var calls atomic.Int32
		client := &http.Client{Transport: chainClientRoundTripFunc(func(request *http.Request) (*http.Response, error) {
			if calls.Add(1) == 1 {
				<-release
			}
			body := fmt.Sprintf(`{"status":"1","result":[{"account":%q,"balance":"0"}]}`, address.Address.Hex())
			return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(body))}, nil
		})}
		updater := NewUpdater(nil, client, rate.NewLimiter(rate.Inf, 1), func() error { return nil })
		defer updater.Close()
		updater.SetAccountActivity(account, true)
		go updater.PollBalances()
		synctest.Wait()

		time.Sleep(time.Minute)
		synctest.Wait()
		require.EqualValues(t, 1, calls.Load())
		updater.SetAccountActivity(account, true)
		time.Sleep(time.Minute)
		synctest.Wait()
		require.EqualValues(t, 1, calls.Load())

		release <- struct{}{}
		synctest.Wait()
		updater.SetAccountActivity(account, true)
		time.Sleep(time.Minute)
		synctest.Wait()
		require.EqualValues(t, 2, calls.Load())
	})
}

type delayedTransactionsSource struct {
	calls        int
	transactions []*accounts.TransactionData
}

func (source *delayedTransactionsSource) Transactions(*big.Int, common.Address, *big.Int, *erc20.Token) ([]*accounts.TransactionData, error) {
	source.calls++
	return source.transactions, nil
}

// A regular refresh can discover funds before Etherscan indexes the transfer. Keep retrying
// after the first unchanged balance, then stop once the retry budget is exhausted.
func TestBalanceChangeRetriesHistory(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		_, account := sharedAccounts(t)
		notifier := &accountmocks.Notifier{}
		notifier.On("Put", mock.Anything).Return(nil)
		account.notifier = notifier
		source := &delayedTransactionsSource{}
		account.coin.transactionsSource = source
		client := newTransactionRPCClient(0, 50000, big.NewInt(1), nil)
		account.coin.client = client
		fetcher := updaterBalanceFetcher{Interface: client, balances: func(context.Context, []common.Address, *big.Int) (map[common.Address]*big.Int, error) {
			return nil, nil
		}}
		updater := NewUpdater(nil, nil, nil, nil)
		defer updater.Close()
		updater.UpdateBalancesAndBlockNumber([]*Account{account}, fetcher)
		synctest.Wait()
		require.Equal(t, 1, source.calls)
		balance, err := account.Balance()
		require.NoError(t, err)
		require.Equal(t, big.NewInt(1e18), balance.Available().BigInt())
		transactions, err := account.Transactions()
		require.NoError(t, err)
		require.Empty(t, transactions)

		time.Sleep(29 * time.Second)
		synctest.Wait()
		select {
		case <-updater.enqueueUpdateForAccount:
			t.Fatal("history retry arrived before the delay")
		default:
		}
		time.Sleep(time.Second)
		synctest.Wait()
		select {
		case queued := <-updater.enqueueUpdateForAccount:
			require.Same(t, account, queued)
			updater.UpdateBalancesAndBlockNumber([]*Account{queued}, fetcher)
		default:
			t.Fatal("balance change did not schedule a history retry")
		}
		require.Equal(t, 2, source.calls)
		transactions, err = account.Transactions()
		require.NoError(t, err)
		require.Empty(t, transactions)

		// Indexing completes 45 seconds after the balance change, after the first retry.
		time.Sleep(15 * time.Second)
		source.transactions = []*accounts.TransactionData{{
			TxID: "incoming", Type: accounts.TxTypeReceive, Amount: coin.NewAmountFromInt64(1e18),
			Height: 100, NumConfirmations: 1,
		}}
		time.Sleep(45 * time.Second)
		synctest.Wait()
		select {
		case queued := <-updater.enqueueUpdateForAccount:
			updater.UpdateBalancesAndBlockNumber([]*Account{queued}, fetcher)
		default:
			t.Fatal("unchanged balance stopped history retries too soon")
		}
		require.Equal(t, 3, source.calls)
		transactions, err = account.Transactions()
		require.NoError(t, err)
		require.Len(t, transactions, 1)
		require.Equal(t, "incoming", transactions[0].TxID)

		time.Sleep(2 * time.Minute)
		synctest.Wait()
		select {
		case queued := <-updater.enqueueUpdateForAccount:
			updater.UpdateBalancesAndBlockNumber([]*Account{queued}, fetcher)
		default:
			t.Fatal("missing final history retry")
		}
		require.Equal(t, 4, source.calls)

		time.Sleep(5 * time.Minute)
		synctest.Wait()
		select {
		case <-updater.enqueueUpdateForAccount:
			t.Fatal("history retries exceeded their bound")
		default:
		}
	})
}

// Repeated balance changes share one retry sequence; closing either owner stops queued work.
func TestHistoryRetriesCoalesceAndStop(t *testing.T) {
	for _, stop := range []string{"exhausted", "account closed", "updater closed"} {
		t.Run(stop, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				account := newAccountWithOptions(t, true, nil)
				updater := NewUpdater(nil, nil, nil, nil)
				updater.scheduleHistoryRetries(account)
				updater.scheduleHistoryRetries(account)
				synctest.Wait()
				switch stop {
				case "account closed":
					account.Close()
					defer updater.Close()
				case "updater closed":
					updater.Close()
					defer account.Close()
				default:
					defer account.Close()
					defer updater.Close()
					for _, delay := range []time.Duration{30 * time.Second, time.Minute, 2 * time.Minute} {
						time.Sleep(delay)
						synctest.Wait()
						select {
						case queued := <-updater.enqueueUpdateForAccount:
							require.Same(t, account, queued)
						default:
							t.Fatal("missing history retry")
						}
						synctest.Wait()
					}
				}
				time.Sleep(5 * time.Minute)
				synctest.Wait()
				select {
				case <-updater.enqueueUpdateForAccount:
					t.Fatal("unexpected duplicate or stopped history retry")
				default:
				}
				require.Empty(t, updater.historyRetries)
			})
		})
	}
}
