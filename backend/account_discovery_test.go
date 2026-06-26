// SPDX-License-Identifier: Apache-2.0

package backend

import (
	"testing"

	accountsTypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/types"
	coinpkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/config"
	"github.com/stretchr/testify/require"
)

func discoveryStatus(
	code accountsTypes.Code,
	coinCode coinpkg.Code,
	hidden bool,
	synced bool,
) accountDiscoveryStatus {
	return accountDiscoveryStatus{
		code:     code,
		coinCode: coinCode,
		hidden:   hidden,
		synced:   synced,
	}
}

func TestAccountDiscoveryCoordinatorStartsAfterVisibleAccountsSync(t *testing.T) {
	coordinator := newAccountDiscoveryCoordinator([]coinpkg.Code{coinpkg.CodeBTC, coinpkg.CodeLTC})

	require.Empty(t, coordinator.connect([]accountDiscoveryStatus{
		discoveryStatus("btc-0", coinpkg.CodeBTC, false, false),
		discoveryStatus("ltc-0", coinpkg.CodeLTC, false, false),
		discoveryStatus("btc-1", coinpkg.CodeBTC, true, false),
	}))

	require.Empty(t, coordinator.syncDone(
		discoveryStatus("btc-0", coinpkg.CodeBTC, false, true),
		true,
	))

	require.Equal(t,
		accountDiscoveryActions{start: true},
		coordinator.syncDone(discoveryStatus("ltc-0", coinpkg.CodeLTC, false, true), true),
	)
	require.True(t, coordinator.hiddenAccountsCanLoad())
}

func TestAccountDiscoveryCoordinatorStartsWithoutVisibleAccounts(t *testing.T) {
	coordinator := newAccountDiscoveryCoordinator([]coinpkg.Code{coinpkg.CodeBTC})

	require.Equal(t, accountDiscoveryActions{start: true}, coordinator.connect(nil))
	require.True(t, coordinator.hiddenAccountsCanLoad())
}

func TestAccountDiscoveryCoordinatorAdvancesDiscoveryCoins(t *testing.T) {
	coordinator := newAccountDiscoveryCoordinator([]coinpkg.Code{coinpkg.CodeBTC, coinpkg.CodeLTC})
	require.Equal(t,
		accountDiscoveryActions{start: true},
		coordinator.connect([]accountDiscoveryStatus{
			discoveryStatus("btc-0", coinpkg.CodeBTC, false, true),
		}),
	)

	require.Equal(t,
		accountDiscoveryActions{addCoins: []coinpkg.Code{coinpkg.CodeBTC}},
		coordinator.syncDone(discoveryStatus("btc-1", coinpkg.CodeBTC, true, true), true),
	)
	require.Empty(t, coordinator.syncDone(
		discoveryStatus("eth-0", coinpkg.CodeETH, false, true),
		true,
	))
	require.Empty(t, coordinator.syncDone(
		discoveryStatus("btc-1", coinpkg.CodeBTC, true, true),
		false,
	))
}

func TestAccountDiscoveryCoordinatorForceStart(t *testing.T) {
	coordinator := newAccountDiscoveryCoordinator([]coinpkg.Code{coinpkg.CodeBTC})

	require.Equal(t,
		accountDiscoveryActions{start: true},
		coordinator.runNow(),
	)
	require.Equal(t,
		accountDiscoveryActions{start: true},
		coordinator.runNow(),
	)
	require.True(t, coordinator.hiddenAccountsCanLoad())
}

func TestNextDiscoveryAccountNumber(t *testing.T) {
	account4 := &config.Account{Code: "account-4"}
	account5 := &config.Account{Code: "account-5"}
	usedAccount5 := &config.Account{Code: "used-account-5", Used: true}

	accountNumber, ok := nextDiscoveryAccountNumber(coinpkg.CodeBTC, nil)
	require.True(t, ok)
	require.Equal(t, uint16(0), accountNumber)

	accountNumber, ok = nextDiscoveryAccountNumber(coinpkg.CodeBTC, []accountCandidate{
		{account: account4, number: 4},
	})
	require.True(t, ok)
	require.Equal(t, uint16(5), accountNumber)

	_, ok = nextDiscoveryAccountNumber(coinpkg.CodeBTC, []accountCandidate{
		{account: account5, number: 5},
	})
	require.False(t, ok)

	accountNumber, ok = nextDiscoveryAccountNumber(coinpkg.CodeBTC, []accountCandidate{
		{account: usedAccount5, number: 5},
	})
	require.True(t, ok)
	require.Equal(t, uint16(6), accountNumber)
}
