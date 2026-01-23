// SPDX-License-Identifier: Apache-2.0

package backend

import (
	"encoding/hex"
	"fmt"
	"math"
	"math/big"
	"sort"
	"strings"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	accountsTypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/types"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/bitsurance"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/addresses"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/blockchain"
	btctypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/types"
	coinpkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/config"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/keystore"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/signing"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/observable"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/observable/action"
	"github.com/btcsuite/btcd/btcutil/hdkeychain"
	"github.com/ethereum/go-ethereum/params"
)

const (
	// ErrAccountAlreadyExists is returned if an account is being added which already exists.
	errAccountAlreadyExists errp.ErrorCode = "accountAlreadyExists"
	// ErrAccountLimitReached is returned when adding an account if no more accounts can be added.
	errAccountLimitReached errp.ErrorCode = "accountLimitReached"
)

// hardenedKeystart is the BIP44 offset to make a keypath element hardened.
const hardenedKeystart uint32 = hdkeychain.HardenedKeyStart

const (
	// see `accountsHardLimit()`.

	accountsHardLimitBTC    = 6
	accountsHardLimitOthers = 5
)

// accountsHardlimit is the maximum possible number of accounts per coin and keystore. This is
// useful in recovery, so we can scan a fixed number of accounts to discover all funds.  The
// alternative (or a complement) would be an accounts gap limit, similar to Bitcoin's address gap
// limit, but simply use a hard limit for simplicity.
//
// BTC/LTC have a different limit because of an off-by-one bug in the past that allowed adding up to
// six accounts instead of up to five.
func accountsHardLimit(coinCode coinpkg.Code) int {
	switch coinCode {
	case coinpkg.CodeBTC, coinpkg.CodeTBTC, coinpkg.CodeRBTC, coinpkg.CodeLTC, coinpkg.CodeTLTC:
		return accountsHardLimitBTC
	default:
		return accountsHardLimitOthers
	}
}

// AccountsList is an accounts.Interface slice which implements a lookup method.
type AccountsList []accounts.Interface

// KeystoresAccountsListMap is a map where keys are keystores' fingerprints and values are
// AccountsLists of accounts belonging to each keystore.
type KeystoresAccountsListMap map[string]AccountsList

func (a AccountsList) lookup(code accountsTypes.Code) accounts.Interface {
	for _, acct := range a {
		if acct.Config().Config.Code == code {
			return acct
		}
	}
	return nil
}

// lookupByTransactionInternalID finds the account which contains a transaction with this internal
// tx ID. `nil, nil` is returned if not found. `err` is returned if there was an error fetching the
// account transactions.
func (a AccountsList) lookupByTransactionInternalID(internalID string) (accounts.Interface, error) {
	for _, account := range a {
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
				return account, nil
			}
		}
	}
	return nil, nil
}

// sortAccounts sorts the accounts in-place by 1) coin 2) account number.
func sortAccounts(accounts []accounts.Interface) {
	compareCoin := func(coin1, coin2 coinpkg.Coin) int {
		getOrder := func(c coinpkg.Coin) (int, bool) {
			order, ok := map[coinpkg.Code]int{
				coinpkg.CodeBTC:  0,
				coinpkg.CodeTBTC: 1,
				coinpkg.CodeLTC:  2,
				coinpkg.CodeTLTC: 3,
			}[c.Code()]
			if ok {
				return order, true
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
	less := func(i, j int) bool {
		acct1 := accounts[i]
		acct2 := accounts[j]
		coinCmp := compareCoin(acct1.Coin(), acct2.Coin())
		if coinCmp == 0 && len(acct1.Config().Config.SigningConfigurations) > 0 && len(acct2.Config().Config.SigningConfigurations) > 0 {
			signingCfg1 := acct1.Config().Config.SigningConfigurations[0]
			signingCfg2 := acct2.Config().Config.SigningConfigurations[0]
			// An error should never happen here, but if it does, we just sort as if it was account
			// number 0.
			accountNumber1, _ := signingCfg1.AccountNumber()
			accountNumber2, _ := signingCfg2.AccountNumber()
			if accountNumber1 != accountNumber2 {
				return accountNumber1 < accountNumber2
			}
			// Same coin, same account number: for ETH coins, put regular account first, followed by
			// its children ERC20 token accounts.
			ethCoin1, ok1 := acct1.Coin().(*eth.Coin)
			ethCoin2, ok2 := acct2.Coin().(*eth.Coin)
			if ok1 && ok2 {
				if ethCoin1.ERC20Token() != nil && ethCoin2.ERC20Token() != nil {
					// ERC20 tokens sorted by code.
					return acct1.Config().Config.Code < acct2.Config().Config.Code
				}
				// ETH parent account comes before its ERC20 tokens.
				return ethCoin2.ERC20Token() != nil
			}
			// Unspecified account ordering: default to ordering by code.
			return acct1.Config().Config.Code < acct2.Config().Config.Code
		}
		return coinCmp < 0
	}
	sort.Slice(accounts, less)
}

// filterAccounts fetches all persisted accounts that pass the provided filter. Testnet/regtest
// accounts are not loaded in mainnet and vice versa.
func (backend *Backend) filterAccounts(accountsConfig *config.AccountsConfig, filter func(*config.AccountsConfig, *config.Account) bool) []*config.Account {
	var accounts []*config.Account
	for _, account := range accountsConfig.Accounts {
		if !backend.arguments.Regtest() {
			if _, isTestnet := coinpkg.TestnetCoins[account.CoinCode]; isTestnet != backend.Testing() {
				// Don't load testnet accounts when running normally, nor mainnet accounts when running
				// in testing mode
				continue
			}
		}
		if isRegtest := account.CoinCode == coinpkg.CodeRBTC; isRegtest != backend.arguments.Regtest() {
			// Don't load regtest accounts when running normally, nor mainnet accounts when running
			// in regtest mode.
			continue
		}
		_, err := backend.Coin(account.CoinCode)
		if err != nil {
			backend.log.Errorf("filterAccounts: skipping persisted account %s/%s, could not find coin",
				account.CoinCode, account.Code)
			continue
		}

		if !filter(accountsConfig, account) {
			continue
		}
		accounts = append(accounts, account)
	}
	return accounts
}

// SupportedCoins returns the list of coins that can be used with the given keystore.
func (backend *Backend) SupportedCoins(keystore keystore.Keystore) []coinpkg.Code {
	allCoins := []coinpkg.Code{
		coinpkg.CodeBTC, coinpkg.CodeTBTC, coinpkg.CodeRBTC,
		coinpkg.CodeLTC, coinpkg.CodeTLTC,
		coinpkg.CodeETH, coinpkg.CodeSEPETH,
	}
	var availableCoins []coinpkg.Code
	for _, coinCode := range allCoins {
		if _, isTestnet := coinpkg.TestnetCoins[coinCode]; !backend.arguments.Regtest() && isTestnet != backend.Testing() {
			// Don't load testnet accounts when running normally, nor mainnet accounts when running
			// in testing mode
			continue
		}
		if isRegtest := coinCode == coinpkg.CodeRBTC; isRegtest != backend.arguments.Regtest() {
			// Don't load regtest accounts when running normally, nor mainnet accounts when running
			// in regtest mode.
			continue
		}
		coin, err := backend.Coin(coinCode)
		if err != nil {
			backend.log.WithError(err).Errorf("AvailableCoins")
			continue
		}
		if !keystore.SupportsCoin(coin) {
			continue
		}
		availableCoins = append(availableCoins, coinCode)
	}
	return availableCoins
}

// AccountsByKeystore returns a map of the current accounts of the backend, grouped
// by keystore.
func (backend *Backend) AccountsByKeystore() (KeystoresAccountsListMap, error) {
	defer backend.accountsAndKeystoreLock.RLock()()
	accountsByKeystore := KeystoresAccountsListMap{}
	for _, account := range backend.accounts {
		persistedAccount := account.Config().Config
		rootFingerprint, err := persistedAccount.SigningConfigurations.RootFingerprint()
		if err != nil {
			return nil, err
		}
		hexFingerprint := hex.EncodeToString(rootFingerprint)
		accountsByKeystore[hexFingerprint] = append(accountsByKeystore[hexFingerprint], account)
	}
	return accountsByKeystore, nil
}

// accountFiatBalance returns an account's balance, converted in fiat currency.
func (backend *Backend) accountFiatBalance(account accounts.Interface, fiat string) (*big.Rat, error) {
	balance, err := account.Balance()
	if err != nil {
		return nil, err
	}

	coinDecimals := coinpkg.DecimalsExp(account.Coin())
	price, err := backend.RatesUpdater().LatestPriceForPair(account.Coin().Unit(false), fiat)
	if err != nil {
		return nil, err
	}
	fiatValue := new(big.Rat).Mul(
		new(big.Rat).SetFrac(
			balance.Available().BigInt(),
			coinDecimals,
		),
		new(big.Rat).SetFloat64(price),
	)
	return fiatValue, nil
}

type coinFormattedAmount struct {
	CoinCode        coinpkg.Code                           `json:"coinCode"`
	CoinName        string                                 `json:"coinName"`
	FormattedAmount coinpkg.FormattedAmountWithConversions `json:"formattedAmount"`
}

// getCoinsTotalBalance returns the total balances grouped by coins.
func (backend *Backend) coinsTotalBalance() ([]coinFormattedAmount, error) {
	var coinFormattedAmounts []coinFormattedAmount
	var sortedCoins []coinpkg.Code
	totalCoinsBalances := make(map[coinpkg.Code]*big.Int)

	for _, account := range backend.Accounts() {
		if account.Config().Config.Inactive || account.Config().Config.HiddenBecauseUnused {
			continue
		}
		if account.FatalError() {
			continue
		}
		err := account.Initialize()
		if err != nil {
			return nil, err
		}
		coinCode := account.Coin().Code()
		b, err := account.Balance()
		if err != nil {
			return nil, err
		}
		amount := b.Available()

		if totalBalance, exists := totalCoinsBalances[coinCode]; exists {
			totalBalance.Add(totalBalance, amount.BigInt())
		} else {
			totalCoinsBalances[coinCode] = amount.BigInt()
			sortedCoins = append(sortedCoins, coinCode)
		}
	}

	for _, coinCode := range sortedCoins {
		coin, err := backend.Coin(coinCode)
		if err != nil {
			return nil, err
		}
		coinAmount := coinpkg.NewAmount(totalCoinsBalances[coinCode])
		coinFormattedAmounts = append(coinFormattedAmounts, coinFormattedAmount{
			CoinCode: coinCode,
			CoinName: coin.Name(),
			FormattedAmount: coinpkg.FormattedAmountWithConversions{
				Amount: coin.FormatAmount(coinAmount, false),
				Unit:   coin.GetFormatUnit(false),
				Conversions: coinpkg.Conversions(
					coinAmount,
					coin,
					false,
					backend.RatesUpdater(),
				),
			},
		})
	}
	return coinFormattedAmounts, nil
}

// AmountsByCoin maps the total amount of each coin.
type AmountsByCoin map[coinpkg.Code]coinpkg.FormattedAmountWithConversions

// KeystoreBalance represents the total balance amount of the accounts belonging to a keystore.
type KeystoreBalance = struct {
	// FiatUnit is the fiat unit of the balance
	FiatUnit string `json:"fiatUnit"`
	// Fiat total formatted for frontend visualization
	Total string `json:"total"`
	// Total amounts for each coin
	CoinsBalance AmountsByCoin `json:"coinsBalance"`
}

// AccountsFiatAndCoinBalance returns the total fiat balance and the balance for each coin, of a list of accounts.
func (backend *Backend) AccountsFiatAndCoinBalance(accounts AccountsList, fiatUnit string) (*big.Rat, map[coinpkg.Code]*big.Int, error) {
	keystoreBalance := new(big.Rat)
	keystoreCoinsBalance := make(map[coinpkg.Code]*big.Int)

	for _, account := range accounts {
		if account.Config().Config.Inactive || account.Config().Config.HiddenBecauseUnused {
			continue
		}
		if account.FatalError() {
			continue
		}
		err := account.Initialize()
		if err != nil {
			return nil, nil, err
		}

		accountFiatBalance, err := backend.accountFiatBalance(account, fiatUnit)
		if err != nil {
			return nil, nil, err
		}
		keystoreBalance.Add(keystoreBalance, accountFiatBalance)

		coinCode := account.Coin().Code()
		balance, err := account.Balance()
		if err != nil {
			return nil, nil, err
		}
		accountBalance := balance.Available().BigInt()
		if _, ok := keystoreCoinsBalance[coinCode]; !ok {
			keystoreCoinsBalance[coinCode] = accountBalance
		} else {
			keystoreCoinsBalance[coinCode] = new(big.Int).Add(keystoreCoinsBalance[coinCode], accountBalance)
		}
	}

	return keystoreBalance, keystoreCoinsBalance, nil
}

// keystoresBalance returns a map of accounts' total balances across coins, grouped by keystore.
func (backend *Backend) keystoresBalance() (map[string]KeystoreBalance, error) {
	keystoreBalanceMap := make(map[string]KeystoreBalance)
	fiatUnit := backend.Config().AppConfig().Backend.MainFiat

	accountsByKeystore, err := backend.AccountsByKeystore()
	if err != nil {
		return nil, err
	}
	for rootFingerprint, accountList := range accountsByKeystore {
		keystoreTotalBalance, keystoreCoinsBalance, err := backend.AccountsFiatAndCoinBalance(accountList, fiatUnit)
		if err != nil {
			return nil, err
		}

		keystoreCoinsAmount := AmountsByCoin{}
		for coinCode, coinBalance := range keystoreCoinsBalance {
			coinAmount := coinpkg.NewAmount(coinBalance)
			coin, err := backend.Coin(coinCode)
			if err != nil {
				return nil, err
			}
			keystoreCoinsAmount[coinCode] = coinpkg.FormattedAmountWithConversions{
				Amount: coin.FormatAmount(coinAmount, false),
				Unit:   coin.GetFormatUnit(false),
				Conversions: coinpkg.Conversions(
					coinAmount,
					coin,
					false,
					backend.ratesUpdater),
			}
		}

		keystoreBalanceMap[rootFingerprint] = KeystoreBalance{
			FiatUnit:     fiatUnit,
			Total:        coinpkg.FormatAsCurrency(keystoreTotalBalance, fiatUnit),
			CoinsBalance: keystoreCoinsAmount,
		}
	}
	return keystoreBalanceMap, nil
}

// AccountsBalanceSummary holds the total balance for each coin and of each keystore.
type AccountsBalanceSummary struct {
	KeystoresBalance  map[string]KeystoreBalance `json:"keystoresBalance"`
	CoinsTotalBalance []coinFormattedAmount      `json:"coinsTotalBalance"`
}

// AccountsBalanceSummary returns the total balance for each coin and of each keystore.
func (backend *Backend) AccountsBalanceSummary() (*AccountsBalanceSummary, error) {
	keystoresBalance, err := backend.keystoresBalance()
	if err != nil {
		return nil, err
	}
	coinsTotalBalance, err := backend.coinsTotalBalance()
	if err != nil {
		return nil, err
	}

	return &AccountsBalanceSummary{
		KeystoresBalance:  keystoresBalance,
		CoinsTotalBalance: coinsTotalBalance,
	}, nil
}

// LookupInsuredAccounts queries the insurance status of specified or all active BTC accounts
// and updates the internal state based on the retrieved information. If the accountCode is
// provided, it checks the insurance status for that specific account; otherwise, it checks
// the status for all active BTC accounts. If any account's insurance status changes, the
// function persists the change, reinitializes the accounts, and emits a status change event.
// Additionally, if an account's insurance is canceled or inactive, the account code is added
// to the frontend config for notifying the user.
func (backend *Backend) LookupInsuredAccounts(accountCode accountsTypes.Code) ([]bitsurance.AccountDetails, error) {
	var accountList []accounts.Interface

	if len(accountCode) > 0 {
		// if the accountCode is not empty, we'll just check the insurance status of that account.
		acct, err := backend.GetAccountFromCode(accountCode)
		if err != nil {
			return nil, err
		}
		accountList = []accounts.Interface{acct}
	} else {
		// otherwise we'll check the status for all the active BTC accounts.
		for _, account := range backend.accounts {
			config := account.Config().Config
			if !config.HiddenBecauseUnused && config.CoinCode == coinpkg.CodeBTC {
				accountList = append(accountList, account)
			}
		}
	}

	// check the insurance status of the selected accounts.
	bitsuranceAccounts, err := bitsurance.LookupBitsuranceAccounts(backend.DevServers(), accountList, backend.httpClient)
	if err != nil {
		return nil, err
	}

	// if any account insurance status changed, persist the change and reinitialize the accounts.
	statusChange := false
	err = backend.config.ModifyAccountsConfig(func(accountsConfig *config.AccountsConfig) error {
		for _, bitsuranceAccount := range bitsuranceAccounts {
			bitsuranceStatus := string(bitsuranceAccount.Status)
			accountConfig := accountsConfig.Lookup(bitsuranceAccount.AccountCode)
			if accountConfig == nil {
				return errp.Newf("Could not find account %s", bitsuranceAccount.AccountCode)
			}
			if accountConfig.InsuranceStatus != bitsuranceStatus {
				backend.log.Infof("Account [%s] insurance status changed to %v", bitsuranceAccount.AccountCode, bitsuranceStatus)
				canceled := bitsuranceStatus == string(bitsurance.CanceledStatus) || bitsuranceStatus == string(bitsurance.InactiveStatus)
				if canceled {
					// add the canceled insurance account code in the frontend config, to allow alerting the user.
					appConfig := backend.config.AppConfig()
					frontendConfig, ok := appConfig.Frontend.(map[string]interface{})
					if !ok {
						frontendConfig = make(map[string]interface{})
					}
					canceledAccounts, ok := frontendConfig["bitsuranceNotifyCancellation"].([]accountsTypes.Code)
					if !ok {
						frontendConfig["bitsuranceNotifyCancellation"] = []accountsTypes.Code{bitsuranceAccount.AccountCode}
					} else {
						canceledAccounts = append(canceledAccounts, bitsuranceAccount.AccountCode)
						frontendConfig["bitsuranceNotifyCancellation"] = canceledAccounts
					}
					if err := backend.config.SetAppConfig(appConfig); err != nil {
						return err
					}
				}
				accountConfig.InsuranceStatus = bitsuranceStatus
				statusChange = true
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	if statusChange {
		backend.emitAccountsStatusChanged()
	}
	return bitsuranceAccounts, nil
}

// defaultAccountName returns a default name for a new account. The first account is the coin name,
// the following accounts is the coin name followed by the account number. Note: `accountNumber` is
// 0-indexed, so `accountNumber 1` results in e.g. "Bitcoin 2".
func defaultAccountName(coin coinpkg.Coin, accountNumber uint16) string {
	if accountNumber > 0 {
		return fmt.Sprintf("%s %d", coin.Name(), accountNumber+1)
	}
	return coin.Name()
}

// createAndPersistAccountConfig adds an account for the given coin and account number. The account
// numbers start at 0 (first account). The added account will be a unified account supporting all
// types that the keystore supports. The keypaths will be standard BIP44 keypaths for the respective
// account types. `name` is the name of the new account and will be shown to the user.
// If empty, a default name will be used.
//
// The account code of the newly created account is returned.
func (backend *Backend) createAndPersistAccountConfig(
	coinCode coinpkg.Code,
	accountNumber uint16,
	hiddenBecauseUnused bool,
	name string,
	keystore keystore.Keystore,
	activeTokens []string,
	accountsConfig *config.AccountsConfig) (accountsTypes.Code, error) {
	rootFingerprint, err := keystore.RootFingerprint()
	if err != nil {
		return "", err
	}
	accountCoin, err := backend.Coin(coinCode)
	if err != nil {
		return "", err
	}
	if name == "" {
		name = defaultAccountName(accountCoin, accountNumber)
	}

	// v0 prefix: in case this code turns out to be not unique in the future, we can switch to 'v1-'
	// and avoid any collisions.
	accountCode := regularAccountCode(rootFingerprint, coinCode, accountNumber)

	log := backend.log.
		WithField("accountCode", accountCode).
		WithField("coinCode", coinCode).
		WithField("accountNumber", accountNumber)
	log.Info("Persisting new account config")
	accountNumberHardened := uint32(accountNumber) + hardenedKeystart

	switch coinCode {
	case coinpkg.CodeBTC, coinpkg.CodeTBTC, coinpkg.CodeRBTC:
		bip44Coin := 1 + hardenedKeystart
		if coinCode == coinpkg.CodeBTC {
			bip44Coin = hardenedKeystart
		}
		return accountCode, backend.persistBTCAccountConfig(keystore, accountCoin,
			accountCode,
			hiddenBecauseUnused,
			name,
			[]scriptTypeWithKeypath{
				{signing.ScriptTypeP2WPKH, signing.NewAbsoluteKeypathFromUint32(84+hardenedKeystart, bip44Coin, accountNumberHardened)},
				{signing.ScriptTypeP2TR, signing.NewAbsoluteKeypathFromUint32(86+hardenedKeystart, bip44Coin, accountNumberHardened)},
				{signing.ScriptTypeP2WPKHP2SH, signing.NewAbsoluteKeypathFromUint32(49+hardenedKeystart, bip44Coin, accountNumberHardened)},
				{signing.ScriptTypeP2PKH, signing.NewAbsoluteKeypathFromUint32(44+hardenedKeystart, bip44Coin, accountNumberHardened)},
			},
			accountsConfig,
		)
	case coinpkg.CodeLTC, coinpkg.CodeTLTC:
		bip44Coin := 1 + hardenedKeystart
		if coinCode == coinpkg.CodeLTC {
			bip44Coin = 2 + hardenedKeystart
		}
		return accountCode, backend.persistBTCAccountConfig(keystore, accountCoin,
			accountCode,
			hiddenBecauseUnused,
			name,
			[]scriptTypeWithKeypath{
				{signing.ScriptTypeP2WPKH, signing.NewAbsoluteKeypathFromUint32(84+hardenedKeystart, bip44Coin, accountNumberHardened)},
				{signing.ScriptTypeP2WPKHP2SH, signing.NewAbsoluteKeypathFromUint32(49+hardenedKeystart, bip44Coin, accountNumberHardened)},
			},
			accountsConfig,
		)
	case coinpkg.CodeETH, coinpkg.CodeSEPETH:
		bip44Coin := "1'"
		if coinCode == coinpkg.CodeETH {
			bip44Coin = "60'"
		}
		return accountCode, backend.persistETHAccountConfig(
			keystore, accountCoin, accountCode, hiddenBecauseUnused,
			// TODO: Use []uint32 instead of a string keypath
			fmt.Sprintf("m/44'/%s/0'/0/%d", bip44Coin, accountNumber),
			name,
			activeTokens,
			accountsConfig)
	default:
		return "", errp.Newf("Unrecognized coin code: %s", coinCode)
	}
}

// findHiddenAccount finds the first (lowest account number) account which is hidden because it is
// unused. Returns nil if no such account exists.
func findHiddenAccount(
	coinCode coinpkg.Code,
	keystore keystore.Keystore,
	accountsConfig *config.AccountsConfig) (*config.Account, error) {
	rootFingerprint, err := keystore.RootFingerprint()
	if err != nil {
		return nil, err
	}
	smallestHiddenAccountNumber := uint16(math.MaxUint16)
	var result *config.Account

	for _, account := range accountsConfig.Accounts {
		if coinCode != account.CoinCode {
			continue
		}
		if !account.SigningConfigurations.ContainsRootFingerprint(rootFingerprint) {
			continue
		}
		if len(account.SigningConfigurations) == 0 {
			continue
		}
		accountNumber, err := account.SigningConfigurations[0].AccountNumber()
		if err != nil {
			continue
		}
		if account.HiddenBecauseUnused && accountNumber < smallestHiddenAccountNumber {
			smallestHiddenAccountNumber = accountNumber
			result = account
		}
	}
	return result, nil
}

// nextAccountNumber checks if an account for the given coin can be added, and if so, returns the
// account number of the new account.
func nextAccountNumber(coinCode coinpkg.Code, keystore keystore.Keystore, accountsConfig *config.AccountsConfig) (uint16, error) {
	rootFingerprint, err := keystore.RootFingerprint()
	if err != nil {
		return 0, err
	}
	nextAccountNumber := uint16(0)
	for _, account := range accountsConfig.Accounts {
		if coinCode != account.CoinCode {
			continue
		}
		if !account.SigningConfigurations.ContainsRootFingerprint(rootFingerprint) {
			continue
		}
		if len(account.SigningConfigurations) == 0 {
			continue
		}
		accountNumber, err := account.SigningConfigurations[0].AccountNumber()
		if err != nil {
			continue
		}
		if accountNumber+1 > nextAccountNumber {
			nextAccountNumber = accountNumber + 1
		}
	}
	if !keystore.SupportsMultipleAccounts() && nextAccountNumber >= 1 {
		return 0, errp.WithStack(errAccountLimitReached)
	}

	if int(nextAccountNumber) >= accountsHardLimit(coinCode) {
		return 0, errp.WithStack(errAccountLimitReached)
	}
	return nextAccountNumber, nil
}

// CanAddAccount returns true if it is possible to add an account for the given coin and keystore,
// along with a suggested name for the account.
func (backend *Backend) CanAddAccount(coinCode coinpkg.Code, keystore keystore.Keystore) (string, bool) {
	conf := backend.config.AccountsConfig()
	// If there is an unused hidden account, that one would be activated when adding a new
	// account. See `CreateAndPersistAccountConfig` for details.
	hiddenAccount, err := findHiddenAccount(coinCode, keystore, &conf)
	if err != nil {
		return "", false
	}
	if hiddenAccount != nil {
		return hiddenAccount.Name, true
	}
	// Otherwise a new account will be added.
	accountNumber, err := nextAccountNumber(coinCode, keystore, &conf)
	if err != nil {
		return "", false
	}
	coin, err := backend.Coin(coinCode)
	if err != nil {
		return "", false
	}
	return defaultAccountName(coin, accountNumber), true
}

// CreateAndPersistAccountConfig checks if an account for the given coin can be added, and if so,
// adds it to the accounts database. The next account number, which is part of the BIP44 keypath, is
// determined automatically to be the increment of the highest existing account.
//
// If there is an unused hidden account, we activate (unhide) and return that one instead of
// creating a new account. Such unused hidden accounts are added during accounts discovery, and are
// marked hidden so that they can be scanned in the background without the user seeing it. If the
// user adds an account, we simply activate such an account that was already prepared.
//
// `name` is the account name, shown to the user. If empty, a default name will be set.
func (backend *Backend) CreateAndPersistAccountConfig(
	coinCode coinpkg.Code, name string, keystore keystore.Keystore) (accountsTypes.Code, error) {
	var accountCode accountsTypes.Code
	err := backend.config.ModifyAccountsConfig(func(accountsConfig *config.AccountsConfig) error {
		hiddenAccount, err := findHiddenAccount(coinCode, keystore, accountsConfig)
		if err != nil {
			return err
		}
		if hiddenAccount != nil {
			hiddenAccount.HiddenBecauseUnused = false
			hiddenAccount.Name = name

			accountCode = hiddenAccount.Code
			return nil
		}
		// Otherwise we create a new account.
		nextAccountNumber, err := nextAccountNumber(coinCode, keystore, accountsConfig)
		if err != nil {
			return err
		}
		accountCode, err = backend.createAndPersistAccountConfig(
			coinCode, nextAccountNumber, false, name, keystore, nil, accountsConfig)
		return err
	})
	if err != nil {
		return "", err
	}
	backend.ReinitializeAccounts()
	return accountCode, nil
}

// SetAccountActive activates/deactivates an account.
func (backend *Backend) SetAccountActive(accountCode accountsTypes.Code, active bool) error {
	err := backend.config.ModifyAccountsConfig(func(accountsConfig *config.AccountsConfig) error {
		acct := accountsConfig.Lookup(accountCode)
		if acct == nil {
			return errp.Newf("Could not find account %s", accountCode)
		}
		acct.Inactive = !active
		return nil
	})
	if err != nil {
		return err
	}
	backend.ReinitializeAccounts()
	return nil
}

// SetTokenActive activates/deactivates an token on an account. `tokenCode` must be an ERC20 token
// code, e.g. "eth-erc20-usdt", "eth-erc20-bat", etc.
func (backend *Backend) SetTokenActive(accountCode accountsTypes.Code, tokenCode string, active bool) error {
	err := backend.config.ModifyAccountsConfig(func(accountsConfig *config.AccountsConfig) error {
		acct := accountsConfig.Lookup(accountCode)
		if acct == nil {
			return errp.Newf("Could not find account %s", accountCode)
		}
		return acct.SetTokenActive(tokenCode, active)
	})
	if err != nil {
		return err
	}
	backend.ReinitializeAccounts()
	return nil
}

// RenameAccount renames an account in the accounts database.
func (backend *Backend) RenameAccount(accountCode accountsTypes.Code, name string) error {
	if name == "" {
		return errp.New("Name cannot be empty")
	}
	err := backend.config.ModifyAccountsConfig(func(accountsConfig *config.AccountsConfig) error {
		acct := accountsConfig.Lookup(accountCode)
		if acct == nil {
			return errp.Newf("Could not find account %s", accountCode)
		}
		acct.Name = name
		return nil
	})
	if err != nil {
		return err
	}
	backend.emitAccountsStatusChanged()
	return nil
}

// addAccount adds the given account to the backend.
// The accountsAndKeystoreLock must be held when calling this function.
func (backend *Backend) addAccount(account accounts.Interface) {
	backend.accounts = append(backend.accounts, account)
	sortAccounts(backend.accounts)

	account.Observe(func(event observable.Event) {
		backend.Notify(observable.Event{
			Subject: fmt.Sprintf("account/%s/%s", account.Config().Config.Code, event.Subject),
			Action:  event.Action,
			Object:  event.Object,
		})
		if event.Subject == string(accountsTypes.EventSyncDone) {
			backend.notifyNewTxs(account)
			go backend.checkAccountUsed(account)
		}
	})
	if err := account.Initialize(); err != nil {
		backend.log.WithError(err).Error("error initializing account")
		return
	}
	if backend.onAccountInit != nil {
		backend.onAccountInit(account)
	}
}

// ConnectKeystore ensures that the keystore with the given root fingerprint is connected,
// prompts the user if necessary, and returns the keystore instance.
func (backend *Backend) ConnectKeystore(rootFingerprint []byte) (keystore.Keystore, error) {
	type data struct {
		Type         string `json:"typ"`
		KeystoreName string `json:"keystoreName"`
		ErrorCode    string `json:"errorCode,omitempty"`
		ErrorMessage string `json:"errorMessage"`
	}
	var keystoreName string
	persistedKeystore, err := backend.config.AccountsConfig().LookupKeystore(rootFingerprint)
	if err == nil {
		keystoreName = persistedKeystore.Name
	}
	var ks keystore.Keystore
	timeout := 20 * time.Minute
outerLoop:
	for {
		backend.Notify(observable.Event{
			Subject: "connect-keystore",
			Action:  action.Replace,
			Object: data{
				Type:         "connect",
				KeystoreName: keystoreName,
			},
		})
		ks, err = backend.connectKeystore.connect(
			backend.Keystore(),
			rootFingerprint,
			timeout,
		)
		if err == nil || errp.Cause(err) != ErrWrongKeystore {
			break
		} else {
			backend.Notify(observable.Event{
				Subject: "connect-keystore",
				Action:  action.Replace,
				Object: data{
					Type:         "error",
					ErrorCode:    err.Error(),
					ErrorMessage: "",
				},
			})
			c := make(chan bool)
			// retryCallback is called when the current keystore is deregistered or when
			// CancelConnectKeystore() is called.
			// In the first case it allows to make a new connection attempt, in the last one
			// it'll make this function return ErrUserAbort.
			backend.connectKeystore.SetRetryConnect(func(retry bool) {
				c <- retry
			})
			select {
			case retry := <-c:
				if !retry {
					err = errp.ErrUserAbort
					break outerLoop
				}
			case <-time.After(timeout):
				backend.connectKeystore.SetRetryConnect(nil)
				err = errTimeout
				break outerLoop
			}
		}
	}
	switch {
	case errp.Cause(err) == errReplaced:
		// If a previous connect-keystore request is in progress, the previous request is
		// failed, but we don't dismiss the prompt, as the new prompt has already been shown
		// by the above "connect" notification.
	case err == nil || errp.Cause(err) == errp.ErrUserAbort:
		// Dismiss prompt after success or upon user abort.
		backend.Notify(observable.Event{
			Subject: "connect-keystore",
			Action:  action.Replace,
			Object:  nil,
		})
	default:
		var errorCode = ""
		if errp.Cause(err) == errTimeout {
			errorCode = err.Error()
		}
		// Display error to user.
		backend.Notify(observable.Event{
			Subject: "connect-keystore",
			Action:  action.Replace,
			Object: data{
				Type:         "error",
				ErrorMessage: err.Error(),
				ErrorCode:    errorCode,
			},
		})
	}
	return ks, err
}

// gapLimits returns the gap limits to use, with arguments having priority over config settings.
func (backend *Backend) gapLimits() *btctypes.GapLimits {
	gapLimits := backend.arguments.GapLimits()

	if gapLimits == nil {
		configReceive := uint16(backend.config.AppConfig().Backend.GapLimitReceive)
		configChange := uint16(backend.config.AppConfig().Backend.GapLimitChange)
		if configReceive > 0 && configChange > 0 {
			gapLimits = &btctypes.GapLimits{
				Receive: configReceive,
				Change:  configChange,
			}
		}
	}

	return gapLimits
}

// The accountsAndKeystoreLock must be held when calling this function.
func (backend *Backend) createAndAddAccount(coin coinpkg.Coin, persistedConfig *config.Account) {
	if backend.accounts.lookup(persistedConfig.Code) != nil {
		// Do not create/load account if it is already loaded.
		return
	}
	var account accounts.Interface
	accountConfig := &accounts.AccountConfig{
		Config:      persistedConfig,
		DBFolder:    backend.arguments.CacheDirectoryPath(),
		NotesFolder: backend.arguments.NotesDirectoryPath(),
		ConnectKeystore: func() (keystore.Keystore, error) {
			accountRootFingerprint, err := persistedConfig.SigningConfigurations.RootFingerprint()
			if err != nil {
				return nil, err
			}
			return backend.ConnectKeystore(accountRootFingerprint)
		},
		RateUpdater: backend.ratesUpdater,
		GetNotifier: func(configurations signing.Configurations) accounts.Notifier {
			return backend.notifier.ForAccount(persistedConfig.Code)
		},
		GetSaveFilename:  backend.environment.GetSaveFilename,
		UnsafeSystemOpen: backend.environment.SystemOpen,
	}

	// This function is passed as a callback to the BTC account constructor. It is called when the
	// keystore needs to determine whether an address belongs to an account on its same keystore.
	getAddressCallback := func(coinCode coinpkg.Code, scriptHashHex blockchain.ScriptHashHex) (*addresses.AccountAddress, error) {
		accountsByKeystore, err := backend.AccountsByKeystore()
		if err != nil {
			return nil, err
		}
		rootFingerprint, err := backend.keystore.RootFingerprint()
		if err != nil {
			return nil, err
		}
		for _, account := range accountsByKeystore[hex.EncodeToString(rootFingerprint)] {
			// This only makes sense for BTC accounts.
			btcAccount, ok := account.(*btc.Account)
			if !ok {
				continue
			}
			// Only return an address if the coin codes match.
			if btcAccount.Coin().Code() != coinCode {
				continue
			}
			if address := btcAccount.GetAddress(scriptHashHex); address != nil {
				return address, nil
			}
		}
		return nil, nil
	}

	switch specificCoin := coin.(type) {
	case *btc.Coin:
		account = backend.makeBtcAccount(
			accountConfig,
			specificCoin,
			backend.gapLimits(),
			getAddressCallback,
			backend.log,
		)
		backend.addAccount(account)
	case *eth.Coin:
		account = backend.makeEthAccount(accountConfig, specificCoin, backend.httpClient, backend.log)
		backend.addAccount(account)

		// Load ERC20 tokens enabled with this Ethereum account.
		for _, erc20TokenCode := range persistedConfig.ActiveTokens {
			erc20CoinCode := coinpkg.Code(erc20TokenCode)
			token, err := backend.Coin(erc20CoinCode)
			if err != nil {
				backend.log.WithError(err).Error("could not find ERC20 token")
				continue
			}
			erc20AccountCode := Erc20AccountCode(persistedConfig.Code, erc20TokenCode)

			tokenName := token.Name()

			accountNumber, err := accountConfig.Config.SigningConfigurations[0].AccountNumber()
			if err != nil {
				backend.log.WithError(err).Error("could not get account number")
			} else if accountNumber > 0 {
				tokenName = fmt.Sprintf("%s %d", tokenName, accountNumber+1)
			}

			erc20Config := &config.Account{
				Inactive:              persistedConfig.Inactive,
				HiddenBecauseUnused:   persistedConfig.HiddenBecauseUnused,
				CoinCode:              erc20CoinCode,
				Name:                  tokenName,
				Code:                  erc20AccountCode,
				SigningConfigurations: persistedConfig.SigningConfigurations,
				ActiveTokens:          nil,
			}

			backend.createAndAddAccount(token, erc20Config)
		}
	default:
		panic("unknown coin type")
	}
}

func (backend *Backend) emitAccountsStatusChanged() {
	backend.Notify(observable.Event{
		Subject: "accounts",
		Action:  action.Reload,
	})
}

// persistAccount adds the account information to the accounts database. These accounts are loaded
// in `initPersistedAccounts()`.
func (backend *Backend) persistAccount(account config.Account, accountsConfig *config.AccountsConfig) error {
	if account.Name == "" {
		return errp.New("Account name cannot be empty")
	}
	for _, account2 := range accountsConfig.Accounts {
		if account.Code == account2.Code {
			backend.log.Errorf("An account with same code exists: %s", account.Code)
			return errp.WithStack(errAccountAlreadyExists)
		}
		if account.CoinCode == account2.CoinCode {
			// We detect a duplicate account (subaccount in a unified account) if any of the
			// configurations is already present.
			for _, config := range account.SigningConfigurations {
				for _, config2 := range account2.SigningConfigurations {
					if config.ExtendedPublicKey().String() == config2.ExtendedPublicKey().String() {
						return errp.WithStack(errAccountAlreadyExists)
					}
				}
			}

		}
	}
	accountsConfig.Accounts = append(accountsConfig.Accounts, &account)
	return nil
}

type scriptTypeWithKeypath struct {
	scriptType signing.ScriptType
	keypath    signing.AbsoluteKeypath
}

// adds a combined BTC account with the given script types.
func (backend *Backend) persistBTCAccountConfig(
	keystore keystore.Keystore,
	coin coinpkg.Coin,
	code accountsTypes.Code,
	hiddenBecauseUnused bool,
	name string,
	configs []scriptTypeWithKeypath,
	accountsConfig *config.AccountsConfig,
) error {
	log := backend.log.WithField("code", code)
	var supportedConfigs []scriptTypeWithKeypath
	for _, cfg := range configs {
		if keystore.SupportsAccount(coin, cfg.scriptType) {
			supportedConfigs = append(supportedConfigs, cfg)
		}
	}
	if len(supportedConfigs) == 0 {
		log.Info("skipping unsupported account")
		return nil
	}
	log.Info("persist account")

	rootFingerprint, err := keystore.RootFingerprint()
	if err != nil {
		return err
	}

	keypaths := make([]signing.AbsoluteKeypath, len(supportedConfigs))
	for i, cfg := range supportedConfigs {
		keypaths[i] = cfg.keypath
	}
	xpubs, err := keystore.BTCXPubs(coin, keypaths)
	if err != nil {
		log.WithError(err).Errorf("Could not derive xpubs at keypaths")
		return err
	}

	var signingConfigurations signing.Configurations
	for i, cfg := range supportedConfigs {
		signingConfiguration := signing.NewBitcoinConfiguration(
			cfg.scriptType,
			rootFingerprint,
			cfg.keypath,
			xpubs[i],
		)
		signingConfigurations = append(signingConfigurations, signingConfiguration)
	}

	return backend.persistAccount(config.Account{
		HiddenBecauseUnused:   hiddenBecauseUnused,
		CoinCode:              coin.Code(),
		Name:                  name,
		Code:                  code,
		SigningConfigurations: signingConfigurations,
	}, accountsConfig)
}

func (backend *Backend) persistETHAccountConfig(
	keystore keystore.Keystore,
	coin coinpkg.Coin,
	code accountsTypes.Code,
	hiddenBecauseUnused bool,
	keypath string,
	name string,
	activeTokens []string,
	accountsConfig *config.AccountsConfig,
) error {
	log := backend.log.
		WithField("code", code).
		WithField("name", name).
		WithField("keypath", keypath)

	if !keystore.SupportsAccount(coin, nil) {
		log.Info("skipping unsupported account")
		return nil
	}

	log.Info("persist account")
	absoluteKeypath, err := signing.NewAbsoluteKeypath(keypath)
	if err != nil {
		panic(err)
	}
	extendedPublicKey, err := keystore.ExtendedPublicKey(coin, absoluteKeypath)
	if err != nil {
		return err
	}

	rootFingerprint, err := keystore.RootFingerprint()
	if err != nil {
		return err
	}
	signingConfigurations := signing.Configurations{
		signing.NewEthereumConfiguration(
			rootFingerprint,
			absoluteKeypath,
			extendedPublicKey,
		),
	}

	return backend.persistAccount(config.Account{
		HiddenBecauseUnused:   hiddenBecauseUnused,
		CoinCode:              coin.Code(),
		Name:                  name,
		Code:                  code,
		SigningConfigurations: signingConfigurations,
		ActiveTokens:          activeTokens,
	}, accountsConfig)
}

// The accountsAndKeystoreLock must be held when calling this function.
func (backend *Backend) initPersistedAccounts() {
	// Only load accounts which belong to connected keystores or for which watchonly is enabled.
	keystoreConnectedOrWatch := func(accountsConfig *config.AccountsConfig, account *config.Account) bool {
		isWatch, err := accountsConfig.IsAccountWatchOnly(account)
		if err != nil {
			backend.log.WithError(err).Error("Can't determine watch status of account")
		} else if isWatch {
			return true
		}

		if backend.keystore == nil {
			return false
		}
		rootFingerprint, err := backend.keystore.RootFingerprint()
		if err != nil {
			backend.log.WithError(err).Error("Could not retrieve root fingerprint")
			return false
		}

		return account.SigningConfigurations.ContainsRootFingerprint(rootFingerprint)
	}

	persistedAccounts := backend.config.AccountsConfig()

	// In this loop, we add all accounts that match the filter, except for the ones whose signing
	// configuration is not supported by the connected keystore. The latter can happen for example
	// if a user connects a BitBox02 Multi edition first, which persists some altcoin accounts, and
	// then connects a BitBox02 BTC-only with the same seed. In that case, the unsupported accounts
	// will not be loaded, unless their keystore has watch-only enabled.
outer:
	for _, account := range backend.filterAccounts(&persistedAccounts, keystoreConnectedOrWatch) {
		coin, err := backend.Coin(account.CoinCode)
		if err != nil {
			backend.log.Errorf("skipping persisted account %s/%s, could not find coin",
				account.CoinCode, account.Code)
			continue
		}

		// Watch-only accounts are loaded regardless, and if later e.g. a BitBox02 BTC-only is
		// inserted with the same seed as a Multi, we will need to catch that mismatch when the
		// keystore will be used to e.g. display an Ethereum address etc.
		if backend.keystore != nil {
			isWatch, err := persistedAccounts.IsAccountWatchOnly(account)
			if err != nil {
				backend.log.WithError(err).Error("Could not retrieve root fingerprint")
				continue
			}
			if !isWatch {
				switch coin.(type) {
				case *btc.Coin:
					for _, cfg := range account.SigningConfigurations {
						if !backend.keystore.SupportsAccount(coin, cfg.ScriptType()) {
							continue outer
						}
					}
				default:
					if !backend.keystore.SupportsAccount(coin, nil) {
						continue
					}
				}
			}
		}

		backend.createAndAddAccount(coin, account)
	}
}

// persistDefaultAccountConfigs persists a bunch of default accounts for the connected keystore (not
// manually user-added). Currently the first bip44 account of BTC/LTC/ETH. ERC20 tokens are added if
// they were configured to be active by the user in the past, when they could still configure them
// globally in the settings.
//
// The accounts are only added for the coins that are marked active in the settings. This used to be
// a user-facing setting. Now we simply use it for migration to decide which coins to add by
// default.
func (backend *Backend) persistDefaultAccountConfigs(keystore keystore.Keystore, accountsConfig *config.AccountsConfig) error {
	if backend.Testing() {
		if backend.arguments.Regtest() {
			if backend.config.AppConfig().Backend.DeprecatedCoinActive(coinpkg.CodeRBTC) {
				if _, err := backend.createAndPersistAccountConfig(
					coinpkg.CodeRBTC, 0, false, "", keystore, nil, accountsConfig); err != nil {
					return err
				}
			}
		} else {
			for _, coinCode := range []coinpkg.Code{coinpkg.CodeTBTC, coinpkg.CodeTLTC, coinpkg.CodeSEPETH} {
				if backend.config.AppConfig().Backend.DeprecatedCoinActive(coinCode) {
					if _, err := backend.createAndPersistAccountConfig(
						coinCode, 0, false, "", keystore, nil, accountsConfig); err != nil {
						return err

					}
				}
			}
		}
	} else {
		for _, coinCode := range []coinpkg.Code{coinpkg.CodeBTC, coinpkg.CodeLTC, coinpkg.CodeETH} {
			if backend.config.AppConfig().Backend.DeprecatedCoinActive(coinCode) {
				// In the past, ERC20 tokens were configured to be active or inactive globally, now they are
				// active/inactive per ETH account. We use the previous global settings to decide the default
				// set of active tokens, for a smoother migration for the user.
				var activeTokens []string
				if coinCode == coinpkg.CodeETH {
					for _, tokenCode := range backend.config.AppConfig().Backend.ETH.DeprecatedActiveERC20Tokens {
						prefix := "eth-erc20-"
						// Old config entries did not contain this prefix, but the token codes in the new config
						// do, to match the codes listed in erc20.go
						activeTokens = append(activeTokens, prefix+tokenCode)
					}
				}

				if _, err := backend.createAndPersistAccountConfig(
					coinCode, 0, false, "", keystore, activeTokens, accountsConfig); err != nil {
					return err
				}
			}
		}
	}
	return nil
}

// maybeAddP2TR adds a taproot subaccount to all Bitcoin accounts if the keystore suports it.
func (backend *Backend) maybeAddP2TR(keystore keystore.Keystore, accounts []*config.Account) error {
	for _, account := range accounts {
		if account.CoinCode == coinpkg.CodeBTC ||
			account.CoinCode == coinpkg.CodeTBTC ||
			account.CoinCode == coinpkg.CodeRBTC {
			accountCoin, err := backend.Coin(account.CoinCode)
			if err != nil {
				return err
			}
			if keystore.SupportsAccount(accountCoin, signing.ScriptTypeP2TR) &&
				account.SigningConfigurations.FindScriptType(signing.ScriptTypeP2TR) == -1 {
				rootFingerprint, err := backend.keystore.RootFingerprint()
				if err != nil {
					return err
				}
				bip44Coin := 1 + hardenedKeystart
				if account.CoinCode == coinpkg.CodeBTC {
					bip44Coin = hardenedKeystart
				}
				accountNumber, err := account.SigningConfigurations[0].AccountNumber()
				if err != nil {
					return err
				}
				keypath := signing.NewAbsoluteKeypathFromUint32(
					86+hdkeychain.HardenedKeyStart,
					bip44Coin,
					uint32(accountNumber)+hdkeychain.HardenedKeyStart)
				extendedPublicKey, err := keystore.ExtendedPublicKey(accountCoin, keypath)
				if err != nil {
					return err
				}
				account.SigningConfigurations = append(
					account.SigningConfigurations,
					signing.NewBitcoinConfiguration(
						signing.ScriptTypeP2TR,
						rootFingerprint,
						keypath,
						extendedPublicKey,
					))
				backend.log.WithField("code", account.Code).
					Info("upgraded account with taproot subaccount")
			}
		}
	}
	return nil
}

// updatePersistedAccounts handles any updates to the persisted accounts before loading them, to
// perform migrations, updates etc. We use it to add taproot subaccounts to Bitcoin accounts that
// were created (persisted) before the introduction of taproot support.
func (backend *Backend) updatePersistedAccounts(
	keystore keystore.Keystore, accounts []*config.Account) error {

	return backend.maybeAddP2TR(keystore, accounts)
}

// The accountsAndKeystoreLock must be held when calling this function.
// if force is true, all accounts are uninitialized first, even if they are watch-only.
func (backend *Backend) initAccounts(force bool) {
	// Since initAccounts replaces all previous accounts, we need to properly close them first.
	backend.uninitAccounts(force)

	backend.initPersistedAccounts()

	backend.emitAccountsStatusChanged()

	// The updater fetches rates only for active accounts, so this seems the most
	// appropriate place to update exchange rate configuration.
	// Every time fiats or coins list is changed in the UI settings, ReinitializedAccounts
	// is invoked which triggers this method.
	backend.configureHistoryExchangeRates()
}

// ReinitializeAccounts uninits and then reinits all accounts. This is useful to reload the accounts
// if the configuration changed (e.g. which accounts are active). This is a stopgap measure until
// accounts can be added and removed individually.
func (backend *Backend) ReinitializeAccounts() {
	defer backend.accountsAndKeystoreLock.Lock()()

	backend.log.Info("Reinitializing accounts")
	backend.initAccounts(true)
}

// The accountsAndKeystoreLock must be held when calling this function.
// if force is true, all accounts are uninitialized, even if they are watch-only.
func (backend *Backend) uninitAccounts(force bool) {
	keep := []accounts.Interface{}
	accountsConfig := backend.config.AccountsConfig()
	for _, account := range backend.accounts {

		belongsToKeystore := false
		if backend.keystore != nil {
			fingerprint, err := backend.keystore.RootFingerprint()
			if err != nil {
				backend.log.WithError(err).Error("could not retrieve keystore fingerprint")
			} else {
				belongsToKeystore = account.Config().Config.SigningConfigurations.ContainsRootFingerprint(fingerprint)
			}
		}

		isWatchonly, err := accountsConfig.IsAccountWatchOnly(account.Config().Config)
		if err != nil {
			backend.log.WithError(err).Error("could not determine watch status of account")
		}
		if !force && (belongsToKeystore || isWatchonly) {
			// Do not uninit/remove account that is being watched.
			keep = append(keep, account)
			continue
		}
		if backend.onAccountUninit != nil {
			backend.onAccountUninit(account)
		}
		account.Close()
	}
	backend.accounts = keep
}

// maybeAddHiddenUnusedAccounts adds a hidden account for scanning to facilitate accounts discovery.
// A hidden account is added per coin if:
//   - the highest account is used (so another one needs to be scanned) OR
//   - there are less than 5 accounts: we need to always scan the first 5 accounts because we used
//     to allow adding up to 5 accounts before we added the accounts discovery feature in v4.38.
//
// For now this only happens for btc/ltc, not for ETH.
// Supporting ETH needs more care as we currently use Etherscan with a rate limit as the ETH backend.
//
// See https://github.com/bitcoin/bips/blob/3db736243cd01389a4dfd98738204df1856dc5b9/bip-0044.mediawiki#user-content-Account_discovery.
//
// We deviate from BIP-44 significantly in two ways:
//
//   - we always scan the first 5 accounts, as historically we allowed
//     users to add that many accounts even if all of them were empty. We
//     need to scan these as such gaps probably exist in the wild.
//   - the accounts scan in BIP-44 is per script type (per purpose field in
//     the BIP-44 keypath). Since we support unified accounts, we consider
//     them together. This means that someone could have many accounts that
//     all have coins on e.g. a P2WPKH address and none on a P2TR address,
//     and still be able to receive to P2TR in the highest account. Such a P2TR
//     account would not be discovered by other BIP44-compatible software.
func (backend *Backend) maybeAddHiddenUnusedAccounts() {
	if backend.tstMaybeAddHiddenUnusedAccounts != nil {
		defer backend.tstMaybeAddHiddenUnusedAccounts()
	}
	defer backend.accountsAndKeystoreLock.Lock()()
	if backend.keystore == nil {
		return
	}
	// Only load accounts which belong to connected keystores.
	rootFingerprint, err := backend.keystore.RootFingerprint()
	if err != nil {
		backend.log.WithError(err).Error("Could not retrieve root fingerprint")
		return
	}

	do := func(cfg *config.AccountsConfig, coinCode coinpkg.Code) *accountsTypes.Code {
		log := backend.log.
			WithField("rootFingerprint", hex.EncodeToString(rootFingerprint)).
			WithField("coinCode", coinCode)

		maxAccountNumber := -1
		var maxAccount *config.Account
		for _, accountConfig := range cfg.Accounts {
			if coinCode != accountConfig.CoinCode {
				continue
			}
			if !accountConfig.SigningConfigurations.ContainsRootFingerprint(rootFingerprint) {
				continue
			}
			accountNumber, err := accountConfig.SigningConfigurations[0].AccountNumber()
			if err != nil {
				continue
			}
			if maxAccount == nil || int(accountNumber) > maxAccountNumber {
				maxAccountNumber = int(accountNumber)
				maxAccount = accountConfig
			}
		}
		// Account scan gap limit:
		// - Previous account must be used for the next one to be scanned, but:
		// - The first 5 accounts are always scanned as before we had accounts discovery, the
		//   BitBoxApp allowed manual creation of 5 accounts, so we need to always scan these
		nextAccountNumber := maxAccountNumber + 1
		if maxAccount == nil || maxAccount.Used || nextAccountNumber < accountsHardLimit(coinCode) {
			accountCode, err := backend.createAndPersistAccountConfig(
				coinCode,
				uint16(nextAccountNumber),
				true,
				"",
				backend.keystore,
				nil,
				cfg,
			)
			if err != nil {
				log.WithError(err).Error("adding hidden account failed")
				return nil
			}
			log.
				WithField("accountCode", accountCode).
				WithField("accountNumber", nextAccountNumber).
				Info("automatically created hidden account")
			return &accountCode
		}
		return nil
	}

	// Enable accounts discovery for these coins.
	var coinCodes []coinpkg.Code
	switch {
	case backend.arguments.Regtest():
		coinCodes = []coinpkg.Code{coinpkg.CodeRBTC}
	case backend.Testing():
		coinCodes = []coinpkg.Code{coinpkg.CodeTBTC, coinpkg.CodeTLTC}
	default:
		coinCodes = []coinpkg.Code{coinpkg.CodeBTC, coinpkg.CodeLTC}
	}
	for _, coinCode := range coinCodes {
		coin, err := backend.Coin(coinCode)
		if err != nil {
			backend.log.Errorf("could not find coin %s", coinCode)
			continue
		}
		if !backend.keystore.SupportsCoin(coin) {
			continue
		}
		var newAccountCode *accountsTypes.Code
		err = backend.config.ModifyAccountsConfig(func(cfg *config.AccountsConfig) error {
			newAccountCode = do(cfg, coinCode)
			return nil
		})
		if err != nil {
			backend.log.
				WithField("coinCode", coinCode).
				WithError(err).
				Error("maybeAddHiddenUnusedAccounts failed")
			continue
		}
		if newAccountCode != nil {
			accountConfig := backend.config.AccountsConfig().Lookup(*newAccountCode)
			if accountConfig == nil {
				backend.log.Errorf("could not find newly persisted account %s", *newAccountCode)
				continue
			}
			backend.createAndAddAccount(coin, accountConfig)
			backend.emitAccountsStatusChanged()
		}
	}
}

func (backend *Backend) checkAccountUsed(account accounts.Interface) {
	if backend.tstCheckAccountUsed != nil {
		if !backend.tstCheckAccountUsed(account) {
			return
		}
	}

	log := backend.log.WithField("accountCode", account.Config().Config.Code)
	if !account.Config().Config.Used {
		txs, err := account.Transactions()
		if err != nil {
			log.WithError(err).Error("discoverAccount")
			return
		}

		if len(txs) == 0 {
			// Invoke this here too because even if an account is unused, we scan up to 5 accounts.
			backend.maybeAddHiddenUnusedAccounts()
			return
		}
	}
	log.Info("marking account as used")
	err := backend.config.ModifyAccountsConfig(func(accountsConfig *config.AccountsConfig) error {
		acct := accountsConfig.Lookup(account.Config().Config.Code)
		if acct == nil {
			return errp.Newf("could not find account")
		}
		acct.Used = true
		acct.HiddenBecauseUnused = false

		return nil
	})
	if err != nil {
		log.WithError(err).Error("checkAccountUsed")
		return
	}
	backend.emitAccountsStatusChanged()
	backend.maybeAddHiddenUnusedAccounts()
}

// LookupEthAccountCode takes an Ethereum address and returns the corresponding account code and account name
// Used for handling Wallet Connect requests from anywhere in the app
// Implemented only for pure ETH accounts (not ERC20s), as all Wallet Connect interactions are handled through the root ETH accounts.
func (backend *Backend) LookupEthAccountCode(address string) (accountsTypes.Code, string, error) {
	for _, account := range backend.Accounts() {
		ethAccount, ok := account.(*eth.Account)
		if !ok {
			continue
		}
		matches, err := ethAccount.MatchesAddress(address)
		if err != nil {
			return "", "", err
		}
		if matches && !eth.IsERC20(ethAccount) {
			return ethAccount.Config().Config.Code, ethAccount.Config().Config.Name, nil
		}
	}
	return "", "", errp.Newf("Account with address: %s not found", address)
}
