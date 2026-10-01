// SPDX-License-Identifier: Apache-2.0

package eth

import (
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

	gethtypes "github.com/ethereum/go-ethereum/core/types"
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
			action := request.URL.Query().Get("action")
			requests <- action
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
		updater := NewUpdater(make(chan *Account), client, rate.NewLimiter(rate.Inf, 1), func() error { return nil })
		defer updater.Close()
		updater.SetAccountActivity(account, true)
		go updater.PollBalances()
		synctest.Wait()

		time.Sleep(time.Minute)
		synctest.Wait()
		require.Len(t, requests, 1)
		require.Equal(t, "balancemulti", <-requests)

		remoteBalance.Store(1000)
		updater.SetAccountActivity(account, true)
		time.Sleep(time.Minute)
		synctest.Wait()
		require.Len(t, requests, 2)
		require.Equal(t, "balancemulti", <-requests)
		require.Equal(t, "eth_getBlockByNumber", <-requests)
		require.Equal(t, big.NewInt(1000), account.remoteBalance())

		time.Sleep(29 * time.Second)
		synctest.Wait()
		require.Empty(t, requests)
		time.Sleep(time.Second)
		synctest.Wait()
		require.Len(t, requests, 2)
		require.Equal(t, "balancemulti", <-requests)
		require.Equal(t, "eth_getBlockByNumber", <-requests)

		updater.SetAccountActivity(account, true)
		time.Sleep(30 * time.Second)
		synctest.Wait()
		require.Len(t, requests, 1)
		require.Equal(t, "balancemulti", <-requests)
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
