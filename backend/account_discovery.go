// SPDX-License-Identifier: Apache-2.0

package backend

import (
	"slices"

	accountsTypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/types"
	coinpkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/config"
)

// accountDiscoveryStatus is the account state that hidden discovery policy needs.
type accountDiscoveryStatus struct {
	code     accountsTypes.Code
	coinCode coinpkg.Code
	hidden   bool
	synced   bool
}

// accountDiscoveryActions are side effects requested by the discovery coordinator.
type accountDiscoveryActions struct {
	start    bool
	addCoins []coinpkg.Code
}

// accountDiscoveryCoordinator owns the hidden-account discovery state machine.
type accountDiscoveryCoordinator struct {
	// discoveryCoins are the only coins for which hidden discovery accounts are created.
	discoveryCoins []coinpkg.Code

	// started records whether hidden discovery has opened for the current keystore session.
	started bool

	// visibleTracked records whether the coordinator has received the current visible startup
	// account snapshot. It distinguishes "no snapshot yet" from "all visible accounts synced".
	visibleTracked bool

	// visiblePending contains visible account codes that still need to finish startup sync before
	// hidden discovery can open.
	visiblePending map[accountsTypes.Code]struct{}
}

// newAccountDiscoveryCoordinator creates a coordinator for the coins that support hidden discovery.
func newAccountDiscoveryCoordinator(discoveryCoins []coinpkg.Code) *accountDiscoveryCoordinator {
	return &accountDiscoveryCoordinator{
		discoveryCoins: slices.Clone(discoveryCoins),
		visiblePending: map[accountsTypes.Code]struct{}{},
	}
}

// reset closes hidden discovery and forgets the previous visible startup account set.
func (coordinator *accountDiscoveryCoordinator) reset() {
	coordinator.started = false
	coordinator.visibleTracked = false
	coordinator.visiblePending = map[accountsTypes.Code]struct{}{}
}

// hiddenAccountsCanLoad reports whether hidden persisted accounts should be loaded into the runtime
// account registry.
func (coordinator *accountDiscoveryCoordinator) hiddenAccountsCanLoad() bool {
	return coordinator.started
}

// runNow opens hidden discovery immediately and requests a full discovery pass. It is used by
// explicit helper paths that ask to run discovery directly instead of waiting for visible account
// sync, so it requests a pass even if discovery was already open.
func (coordinator *accountDiscoveryCoordinator) runNow() accountDiscoveryActions {
	coordinator.started = true
	return accountDiscoveryActions{start: true}
}

// connect records the current visible startup account set and opens hidden discovery
// immediately if all visible accounts are already synced.
func (coordinator *accountDiscoveryCoordinator) connect(
	accounts []accountDiscoveryStatus,
) accountDiscoveryActions {
	coordinator.visibleTracked = true
	coordinator.visiblePending = map[accountsTypes.Code]struct{}{}
	for _, account := range accounts {
		if account.hidden {
			continue
		}
		if !account.synced {
			coordinator.visiblePending[account.code] = struct{}{}
		}
	}
	return coordinator.startIfReady()
}

// syncDone updates discovery after an account sync event. If usageKnown is false, the event may
// open hidden discovery but will not advance the account's coin.
func (coordinator *accountDiscoveryCoordinator) syncDone(
	account accountDiscoveryStatus,
	usageKnown bool,
) accountDiscoveryActions {
	if !account.hidden && account.synced {
		delete(coordinator.visiblePending, account.code)
	}
	if !coordinator.started {
		return coordinator.startIfReady()
	}
	if !usageKnown || !slices.Contains(coordinator.discoveryCoins, account.coinCode) {
		return accountDiscoveryActions{}
	}
	return accountDiscoveryActions{addCoins: []coinpkg.Code{account.coinCode}}
}

// startIfReady opens hidden discovery after the visible startup account set has been observed and
// all visible accounts have synced.
func (coordinator *accountDiscoveryCoordinator) startIfReady() accountDiscoveryActions {
	if coordinator.started || !coordinator.visibleTracked ||
		len(coordinator.visiblePending) != 0 {
		return accountDiscoveryActions{}
	}
	coordinator.started = true
	return accountDiscoveryActions{start: true}
}

// nextDiscoveryAccountNumber returns the next hidden account number that discovery should create.
func nextDiscoveryAccountNumber(
	coinCode coinpkg.Code,
	candidates []accountCandidate,
) (uint16, bool) {
	maxAccountNumber := -1
	var maxAccount *config.Account
	for _, candidate := range candidates {
		if maxAccount == nil || int(candidate.number) > maxAccountNumber {
			maxAccountNumber = int(candidate.number)
			maxAccount = candidate.account
		}
	}

	// Account scan gap limit:
	// - Previous account must be used for the next one to be scanned, but:
	// - The first accounts up to the hard limit are always scanned as before we had accounts
	//   discovery, the BitBoxApp allowed manual creation of that many accounts, so we need to scan
	//   these.
	nextAccountNumber := maxAccountNumber + 1
	if maxAccount == nil || maxAccount.Used || nextAccountNumber < accountsHardLimit(coinCode) {
		return uint16(nextAccountNumber), true
	}
	return 0, false
}
