// SPDX-License-Identifier: Apache-2.0

package eth

import (
	"fmt"
	"io"
	"math/big"
	"net/http"
	"strings"
	"sync/atomic"
	"testing"
	"testing/synctest"
	"time"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/common/hexutil"
	"github.com/stretchr/testify/require"
	"golang.org/x/time/rate"
)

func balancesSnapshotResponse(t *testing.T, blockNumber *big.Int, balance *big.Int) *http.Response {
	t.Helper()
	uint256Type, err := abi.NewType("uint256", "", nil)
	require.NoError(t, err)
	bytes32Type, err := abi.NewType("bytes32", "", nil)
	require.NoError(t, err)
	resultsType, err := abi.NewType("tuple[]", "", []abi.ArgumentMarshaling{
		{Name: "success", Type: "bool"}, {Name: "returnData", Type: "bytes"},
	})
	require.NoError(t, err)
	result, err := abi.Arguments{{Type: uint256Type}, {Type: bytes32Type}, {Type: resultsType}}.Pack(
		blockNumber,
		[32]byte{},
		[]struct {
			Success    bool
			ReturnData []byte
		}{{true, common.BigToHash(balance).Bytes()}},
	)
	require.NoError(t, err)
	body := fmt.Sprintf(`{"jsonrpc":"2.0","id":1,"result":%q}`, hexutil.Encode(result))
	return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(body))}
}

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

		var remoteBalance atomic.Int64
		requests := make(chan string, 10)
		client := &http.Client{Transport: chainClientRoundTripFunc(func(request *http.Request) (*http.Response, error) {
			query := request.URL.Query()
			action := query.Get("action")
			requests <- action + " " + query.Get("tag")
			if action != "eth_call" {
				return nil, fmt.Errorf("unexpected action: %s", action)
			}
			return balancesSnapshotResponse(t, big.NewInt(101), big.NewInt(remoteBalance.Load())), nil
		})}
		updater := NewUpdater(nil, client, rate.NewLimiter(rate.Inf, 1), func() error { return nil })
		defer updater.Close()
		updater.SetAccountActivity(account, true)
		go updater.PollBalances()
		synctest.Wait()

		time.Sleep(time.Minute)
		synctest.Wait()
		require.Len(t, requests, 1)
		require.Equal(t, "eth_call latest", <-requests)

		remoteBalance.Store(1000)
		updater.SetAccountActivity(account, true)
		time.Sleep(time.Minute)
		synctest.Wait()
		require.Len(t, requests, 2)
		require.Equal(t, "eth_call latest", <-requests)
		require.Equal(t, "eth_call latest", <-requests)
		require.Equal(t, big.NewInt(1000), account.remoteBalance())
		unlock := account.updateLock.RLock()
		require.Equal(t, big.NewInt(101), account.blockNumber)
		unlock()

		time.Sleep(29 * time.Second)
		synctest.Wait()
		require.Empty(t, requests)
		time.Sleep(time.Second)
		synctest.Wait()
		require.Len(t, requests, 1)
		require.Equal(t, "eth_call latest", <-requests)

		updater.SetAccountActivity(account, true)
		time.Sleep(30 * time.Second)
		synctest.Wait()
		require.Len(t, requests, 1)
		require.Equal(t, "eth_call latest", <-requests)
	})
}

func TestActiveAccountProbesDoNotOverlap(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		account := newAccountWithOptions(t, true, nil)
		defer account.Close()
		release := make(chan struct{})
		defer close(release)
		var calls atomic.Int32
		client := &http.Client{Transport: chainClientRoundTripFunc(func(request *http.Request) (*http.Response, error) {
			if calls.Add(1) == 1 {
				<-release
			}
			return balancesSnapshotResponse(t, big.NewInt(100), big.NewInt(0)), nil
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
