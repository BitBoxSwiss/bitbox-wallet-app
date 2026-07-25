// SPDX-License-Identifier: Apache-2.0

package backend

import (
	"bytes"
	"slices"
	"sort"
	"strings"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	accountsTypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/types"
	coinpkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/config"
	"github.com/ethereum/go-ethereum/params"
)

// AccountView joins a loaded account with its authoritative persisted metadata.
type AccountView struct {
	Account    accounts.Interface
	Record     config.Account
	Keystore   *config.Keystore
	ParentCode *accountsTypes.Code
}

// AccountViews is a presentation-ordered snapshot of loaded accounts and their persisted data.
type AccountViews []AccountView

func (views AccountViews) lookup(code accountsTypes.Code) *AccountView {
	for index := range views {
		view := &views[index]
		if view.Record.Code == code {
			return view
		}
	}
	return nil
}

// lookupByTransactionInternalID finds the account which contains a transaction with this internal
// tx ID. `nil, nil` is returned if not found. `err` is returned if there was an error fetching the
// account transactions.
func (views AccountViews) lookupByTransactionInternalID(internalID string) (*AccountView, error) {
	for index := range views {
		view := &views[index]
		account := view.Account
		if account.FatalError() {
			continue
		}
		if err := account.Initialize(); err != nil {
			return nil, err
		}
		transactions, err := account.Transactions()
		if err != nil {
			return nil, err
		}
		for _, transactionData := range transactions {
			if transactionData.InternalID == internalID {
				return view, nil
			}
		}
	}
	return nil, nil
}

func derivedTokenRecord(
	account accounts.Interface,
	accountsConfig config.AccountsConfig,
) (*config.Account, *accountsTypes.Code) {
	tokenCode := string(account.Coin().Code())
	for _, parent := range accountsConfig.Accounts {
		if !slices.Contains(parent.ActiveTokens, tokenCode) ||
			Erc20AccountCode(parent.Code, tokenCode) != account.Config().Code {
			continue
		}
		name, _ := configuredAccountName(account.Coin(), parent)
		record := &config.Account{
			Inactive:              parent.Inactive,
			InsuranceStatus:       parent.InsuranceStatus,
			HiddenBecauseUnused:   parent.HiddenBecauseUnused,
			CoinCode:              account.Coin().Code(),
			Name:                  name,
			Code:                  account.Config().Code,
			SigningConfigurations: parent.SigningConfigurations,
		}
		parentCode := parent.Code
		return record, &parentCode
	}
	return nil, nil
}

func joinAccountView(
	account accounts.Interface,
	accountsConfig config.AccountsConfig,
) *AccountView {
	var record *config.Account
	var parentCode *accountsTypes.Code
	if eth.IsERC20(account) {
		record, parentCode = derivedTokenRecord(account, accountsConfig)
	} else {
		record = accountsConfig.Lookup(account.Config().Code)
	}
	if record == nil {
		return nil
	}

	var persistedKeystore *config.Keystore
	rootFingerprint, err := record.SigningConfigurations.RootFingerprint()
	if err == nil {
		persistedKeystore, _ = accountsConfig.LookupKeystore(rootFingerprint)
	}

	return &AccountView{
		Account:    account,
		Record:     *record,
		Keystore:   persistedKeystore,
		ParentCode: parentCode,
	}
}

func joinAccountViews(
	runtimeAccounts AccountsList,
	accountsConfig config.AccountsConfig,
) AccountViews {
	views := make(AccountViews, 0, len(runtimeAccounts))
	for _, account := range runtimeAccounts {
		if view := joinAccountView(account, accountsConfig); view != nil {
			views = append(views, *view)
		}
	}
	sortAccountViews(views)
	return views
}

func compareAccountCoins(coin1, coin2 coinpkg.Coin) int {
	getOrder := func(c coinpkg.Coin) (int, bool) {
		switch c.Code() {
		case coinpkg.CodeBTC:
			return 0, true
		case coinpkg.CodeTBTC:
			return 1, true
		case coinpkg.CodeLTC:
			return 2, true
		case coinpkg.CodeTLTC:
			return 3, true
		}
		// We want to sort ETH and ERC20 tokens with the same priority even though they have
		// different coin codes, so we use the chain ID.
		ethCoin, ok := c.(*eth.Coin)
		if ok {
			switch ethCoin.ChainID() {
			case params.MainnetChainConfig.ChainID.Uint64():
				return 4, true
			case params.SepoliaChainConfig.ChainID.Uint64():
				return 5, true
			}
		}
		return 0, false
	}
	order1, ok1 := getOrder(coin1)
	order2, ok2 := getOrder(coin2)
	if !ok1 || !ok2 {
		// In case we deal with a coin we didn't specify, we fallback to ordering by coin code.
		return strings.Compare(string(coin1.Code()), string(coin2.Code()))
	}
	return order1 - order2
}

func lessAccountSortOrder(
	coin1 coinpkg.Coin,
	accountConfig1 *config.Account,
	coin2 coinpkg.Coin,
	accountConfig2 *config.Account,
) bool {
	coinCmp := compareAccountCoins(coin1, coin2)
	if coinCmp != 0 {
		return coinCmp < 0
	}

	if len(accountConfig1.SigningConfigurations) > 0 && len(accountConfig2.SigningConfigurations) > 0 {
		signingCfg1 := accountConfig1.SigningConfigurations[0]
		signingCfg2 := accountConfig2.SigningConfigurations[0]
		// An error should never happen here, but if it does, we just sort as if it was account
		// number 0.
		accountNumber1, _ := signingCfg1.AccountNumber()
		accountNumber2, _ := signingCfg2.AccountNumber()
		if accountNumber1 != accountNumber2 {
			return accountNumber1 < accountNumber2
		}
		// Same coin, same account number: for ETH coins, put regular account first, followed by
		// its children ERC20 token accounts.
		ethCoin1, ok1 := coin1.(*eth.Coin)
		ethCoin2, ok2 := coin2.(*eth.Coin)
		if ok1 && ok2 {
			if ethCoin1.ERC20Token() != nil && ethCoin2.ERC20Token() != nil {
				// ERC20 tokens sorted by code.
				return accountConfig1.Code < accountConfig2.Code
			}
			// ETH parent account comes before its ERC20 tokens.
			return ethCoin2.ERC20Token() != nil
		}
	}

	// Unspecified account ordering: default to ordering by code.
	return accountConfig1.Code < accountConfig2.Code
}

// sortAccountViews sorts the views in-place by 1) keystore name 2) root fingerprint 3) coin
// 4) account number.
func sortAccountViews(views AccountViews) {
	sort.Slice(views, func(i, j int) bool {
		view1 := views[i]
		view2 := views[j]
		if view1.Keystore != nil && view2.Keystore != nil &&
			view1.Keystore.Name != view2.Keystore.Name {
			return view1.Keystore.Name < view2.Keystore.Name
		}
		rootFingerprint1, err1 := view1.Record.SigningConfigurations.RootFingerprint()
		rootFingerprint2, err2 := view2.Record.SigningConfigurations.RootFingerprint()
		if err1 == nil && err2 == nil {
			if cmp := bytes.Compare(rootFingerprint1, rootFingerprint2); cmp != 0 {
				return cmp < 0
			}
		}
		return lessAccountSortOrder(
			view1.Account.Coin(),
			&view1.Record,
			view2.Account.Coin(),
			&view2.Record,
		)
	})
}
