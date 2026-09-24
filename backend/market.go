// SPDX-License-Identifier: Apache-2.0

package backend

import (
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/types"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/market"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
)

func (backend *Backend) isLightningAccount(code types.Code) bool {
	if backend.lightning == nil {
		return false
	}
	account := backend.lightning.Account()
	return account != nil && account.Code == code
}

func (backend *Backend) marketAccount(code types.Code) (accounts.Interface, error) {
	account, err := backend.GetAccountFromCode(code)
	if err != nil {
		return nil, err
	}
	if account == nil || account.Offline() != nil || account.FatalError() {
		return nil, errp.New("Account is not valid.")
	}
	return account, nil
}

// MarketDeals returns offers for an on-chain account or the enabled Lightning wallet.
func (backend *Backend) MarketDeals(code types.Code, region string, action market.Action) ([]*market.DealsList, error) {
	if backend.isLightningAccount(code) {
		return market.LightningDeals(region, action)
	}
	account, err := backend.marketAccount(code)
	if err != nil {
		return nil, err
	}
	return market.GetDeals(account, region, action, backend.HTTPClient())
}

// MarketBitrefillInfo returns the Bitrefill configuration for the selected wallet.
func (backend *Backend) MarketBitrefillInfo(code types.Code) (market.BitrefillInfoResult, error) {
	if backend.isLightningAccount(code) {
		return market.BitrefillLightningInfo(backend.DevServers()), nil
	}
	account, err := backend.marketAccount(code)
	if err != nil {
		return market.BitrefillInfoResult{}, err
	}
	return market.BitrefillInfo(account, backend.DevServers())
}
