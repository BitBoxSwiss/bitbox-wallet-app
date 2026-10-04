// SPDX-License-Identifier: Apache-2.0

package backend

import (
	"encoding/hex"
	"math/big"
	"slices"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accountbuilder"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accountmanager"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	accountsTypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/types"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/bitsurance"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/addresses"
	btctypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/types"
	coinpkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/config"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/keystore"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/signing"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/observable"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/observable/action"
)

const (
	// ErrAccountAlreadyExists is returned if an account is being added which already exists.
	errAccountAlreadyExists errp.ErrorCode = "accountAlreadyExists"
	// ErrAccountLimitReached is returned when adding an account if no more accounts can be added.
	errAccountLimitReached errp.ErrorCode = "accountLimitReached"
)

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

// coinPolicy returns the active coin policy for the backend's current network mode.
func (backend *Backend) coinPolicy() coinPolicy {
	return coinPolicy{
		testing: backend.Testing(),
		regtest: backend.arguments.Regtest(),
	}
}

// AccountsList is a snapshot of runtime account instances.
type AccountsList []accounts.Interface

// KeystoresAccountViewsMap groups account views by their keystore fingerprints.
type KeystoresAccountViewsMap map[string]AccountViews

// filterAccounts fetches all persisted accounts that pass the provided filter. Testnet/regtest
// accounts are not loaded in mainnet and vice versa.
func (backend *Backend) filterAccounts(accountsConfig *config.AccountsConfig, filter func(*config.AccountsConfig, *config.Account) bool) []*config.Account {
	var accounts []*config.Account
	policy := backend.coinPolicy()
	for _, account := range accountsConfig.Accounts {
		if !policy.coinEnabled(account.CoinCode) {
			// Don't load accounts from another network mode.
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
	var availableCoins []coinpkg.Code
	for _, coinCode := range backend.coinPolicy().supportedCoins() {
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

func groupAccountViewsByKeystore(accountViews AccountViews) (KeystoresAccountViewsMap, error) {
	accountsByKeystore := KeystoresAccountViewsMap{}
	for index := range accountViews {
		accountView := &accountViews[index]
		rootFingerprint, err := accountView.Record.SigningConfigurations.RootFingerprint()
		if err != nil {
			return nil, err
		}
		hexFingerprint := hex.EncodeToString(rootFingerprint)
		accountsByKeystore[hexFingerprint] = append(accountsByKeystore[hexFingerprint], *accountView)
	}
	return accountsByKeystore, nil
}

// AccountsByKeystore returns a map of the current accounts of the backend, grouped
// by keystore.
func (backend *Backend) AccountsByKeystore() (KeystoresAccountViewsMap, error) {
	return groupAccountViewsByKeystore(backend.Accounts())
}

// accountFiatBalance returns an account's balance, converted in fiat currency.
func (backend *Backend) accountFiatBalance(account accounts.Interface, fiat string) (*big.Rat, error) {
	balance, err := account.Balance()
	if err != nil {
		return nil, err
	}

	return backend.convertToFiat(account.Coin(), balance.Available(), fiat)
}

func (backend *Backend) convertToFiat(coin coinpkg.Coin, amount coinpkg.Amount, fiat string) (*big.Rat, error) {
	price, err := backend.RatesUpdater().LatestPriceForPair(coin.Unit(false), fiat)
	if err != nil {
		return nil, err
	}
	return new(big.Rat).Mul(
		new(big.Rat).SetFrac(
			amount.BigInt(),
			coinpkg.DecimalsExp(coin, false),
		),
		new(big.Rat).SetFloat64(price),
	), nil
}

type coinFormattedAmount struct {
	CoinCode        coinpkg.Code                            `json:"coinCode"`
	CoinName        string                                  `json:"coinName"`
	FormattedAmount *coinpkg.FormattedAmountWithConversions `json:"formattedAmount,omitempty"`
}

func (backend *Backend) formattedCoinBalance(
	coinCode coinpkg.Code,
	coinName string,
	coin coinpkg.Coin,
	amount *big.Int,
) coinFormattedAmount {
	coinAmount := coinpkg.NewAmount(amount)
	return coinFormattedAmount{
		CoinCode: coinCode,
		CoinName: coinName,
		FormattedAmount: &coinpkg.FormattedAmountWithConversions{
			Amount: coin.FormatAmount(coinAmount, false),
			Unit:   coin.GetFormatUnit(false),
			Conversions: coinpkg.Conversions(
				coinAmount,
				coin,
				false,
				backend.RatesUpdater(),
			),
		},
	}
}

// coinsTotalBalance returns the total balances grouped by coins. Lightning is included on a
// best-effort basis so that an unavailable Lightning SDK cannot prevent on-chain balances from
// loading.
func (backend *Backend) coinsTotalBalance(accountViews AccountViews) ([]coinFormattedAmount, error) {
	coinFormattedAmounts := []coinFormattedAmount{}
	var sortedCoins []coinpkg.Code
	totalCoinsBalances := make(map[coinpkg.Code]*big.Int)

	for index := range accountViews {
		accountView := &accountViews[index]
		if accountView.Record.Inactive || accountView.Record.HiddenBecauseUnused {
			continue
		}
		account := accountView.Account
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

	var lightningBalance *coinFormattedAmount
	if backend.hasLightningAccount() {
		lightningBalance = &coinFormattedAmount{
			CoinCode: coinCodeLightning,
			CoinName: "Lightning",
		}
		formattedLightningBalance, err := backend.lightningFormattedBalance()
		if err != nil {
			backend.log.WithError(err).Error("Failed to load Lightning balance for account summary")
		} else {
			lightningBalance = formattedLightningBalance
		}
	}

	for _, coinCode := range sortedCoins {
		coin, err := backend.Coin(coinCode)
		if err != nil {
			return nil, err
		}
		coinFormattedAmounts = append(coinFormattedAmounts, backend.formattedCoinBalance(
			coinCode,
			coin.Name(),
			coin,
			totalCoinsBalances[coinCode],
		))
	}
	return insertLightningFormattedBalance(coinFormattedAmounts, lightningBalance), nil
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
func (backend *Backend) AccountsFiatAndCoinBalance(accounts AccountViews, fiatUnit string) (*big.Rat, map[coinpkg.Code]*big.Int, error) {
	keystoreBalance := new(big.Rat)
	keystoreCoinsBalance := make(map[coinpkg.Code]*big.Int)

	for index := range accounts {
		accountView := &accounts[index]
		if accountView.Record.Inactive || accountView.Record.HiddenBecauseUnused {
			continue
		}
		account := accountView.Account
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
func (backend *Backend) keystoresBalance(
	accountViews AccountViews,
) (map[string]KeystoreBalance, error) {
	keystoreBalanceMap := make(map[string]KeystoreBalance)
	fiatUnit := backend.Config().AppConfig().Backend.MainFiat

	accountsByKeystore, err := groupAccountViewsByKeystore(accountViews)
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
	accountViews := backend.Accounts()
	keystoresBalance, err := backend.keystoresBalance(accountViews)
	if err != nil {
		return nil, err
	}
	coinsTotalBalance, err := backend.coinsTotalBalance(accountViews)
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
// function persists the change and emits a status change event.
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
		accountViews := backend.Accounts()
		for index := range accountViews {
			accountView := &accountViews[index]
			if !accountView.Record.HiddenBecauseUnused && accountView.Record.CoinCode == coinpkg.CodeBTC {
				accountList = append(accountList, accountView.Account)
			}
		}
	}

	// check the insurance status of the selected accounts.
	bitsuranceAccounts, err := bitsurance.LookupBitsuranceAccounts(backend.DevServers(), accountList, backend.httpClient)
	if err != nil {
		return nil, err
	}

	// If any account insurance status changed, persist the change.
	statusChange := false
	err = backend.accountsDB.Update(func(accountsConfig *config.AccountsConfig) error {
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

func configuredAccountName(coin coinpkg.Coin, accountConfig *config.Account) (string, error) {
	accountNumber, err := accountConfig.SigningConfigurations.AccountNumber()
	if err != nil {
		return coin.Name(), err
	}
	return accountbuilder.DefaultName(coin, accountNumber), nil
}

// CanAddAccount returns true if it is possible to add an account for the given coin and keystore,
// along with a suggested name for the account.
func (backend *Backend) CanAddAccount(coinCode coinpkg.Code, keystore keystore.Keystore) (string, bool) {
	conf, err := backend.accountsDB.Snapshot()
	if err != nil {
		backend.log.WithError(err).Error("could not load account records")
		return "", false
	}
	rootFingerprint, err := keystore.RootFingerprint()
	if err != nil {
		return "", false
	}
	// If there is an unused hidden account, that one would be activated when adding a new
	// account. See `CreateAndPersistAccountConfig` for details.
	hiddenAccount := findHiddenAccount(coinCode, rootFingerprint, &conf)
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
	return accountbuilder.DefaultName(coin, accountNumber), true
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
	defer backend.accountsAndKeystoreLock.Lock()()

	rootFingerprint, err := keystore.RootFingerprint()
	if err != nil {
		return "", err
	}

	var accountCode accountsTypes.Code
	var nextNumber uint16
	errPrepareAccount := errp.New("new account requires hardware preparation")
	err = backend.accountsDB.Update(func(accountsConfig *config.AccountsConfig) error {
		// Selection and activation must be atomic: discovery can unhide accounts without
		// acquiring accountsAndKeystoreLock.
		if hiddenAccount := findHiddenAccount(coinCode, rootFingerprint, accountsConfig); hiddenAccount != nil {
			accountCode = hiddenAccount.Code
			hiddenAccount.HiddenBecauseUnused = false
			hiddenAccount.Name = name
			return nil
		}
		candidates := accountCandidates(accountsConfig, rootFingerprint, coinCode)
		var err error
		nextNumber, err = nextManualAccountNumber(coinCode, candidates)
		if err != nil {
			return err
		}
		// Leave without writing so hardware access happens outside the database update.
		// accountsAndKeystoreLock protects the account number until the new record is saved.
		return errPrepareAccount
	})
	if err != nil && err != errPrepareAccount {
		return "", err
	}
	if err == errPrepareAccount {
		var account *config.Account
		accountCode, account, err = backend.accountBuilder.Build(
			coinCode,
			nextNumber,
			false,
			name,
			keystore,
			nil,
		)
		if err != nil {
			return "", err
		}
		if account != nil {
			if err := backend.accountsDB.Update(func(accountsConfig *config.AccountsConfig) error {
				return backend.persistAccount(*account, accountsConfig)
			}); err != nil {
				return "", err
			}
		}
	}
	if err := backend.reconcileAccountWriteLocked(accountCode); err != nil {
		return "", err
	}
	return accountCode, nil
}

// SetAccountActive activates/deactivates an account.
func (backend *Backend) SetAccountActive(accountCode accountsTypes.Code, active bool) error {
	err := backend.accountsDB.Update(func(accountsConfig *config.AccountsConfig) error {
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
	backend.emitAccountsStatusChanged()
	return nil
}

// SetTokenActive activates/deactivates an token on an account. `tokenCode` must be an ERC20 token
// code, e.g. "eth-erc20-usdt", "eth-erc20-bat", etc.
func (backend *Backend) SetTokenActive(accountCode accountsTypes.Code, tokenCode string, active bool) error {
	defer backend.accountsAndKeystoreLock.Lock()()

	err := backend.accountsDB.Update(func(accountsConfig *config.AccountsConfig) error {
		acct := accountsConfig.Lookup(accountCode)
		if acct == nil {
			return errp.Newf("Could not find account %s", accountCode)
		}
		if active {
			acct.Inactive = false
		}
		return acct.SetTokenActive(tokenCode, active)
	})
	if err != nil {
		return err
	}
	return backend.reconcileAccountWriteLocked(accountCode)
}

// reconcileAccountWriteLocked updates runtime membership and dependent services after a persisted
// account-family write. Callers hold accountsAndKeystoreLock across both persistence and
// reconciliation so joined views cannot combine new desired membership with stale runtime state.
func (backend *Backend) reconcileAccountWriteLocked(accountCode accountsTypes.Code) error {
	accountsConfig, err := backend.accountsDB.Snapshot()
	if err != nil {
		return err
	}
	result := backend.accounts.ReconcileFamily(
		accountsConfig,
		accountCode,
		backend.keystore,
	)
	// Newly initialized ETH accounts enqueue their own initial update.
	backend.applyAccountReconcileEffectsLocked(result.MembershipChanged, false)
	return nil
}

// SetAccountReceiveScriptType stores the receive script type for an account.
func (backend *Backend) SetAccountReceiveScriptType(
	accountCode accountsTypes.Code,
	scriptType signing.ScriptType,
) error {
	err := backend.accountsDB.Update(func(accountsConfig *config.AccountsConfig) error {
		acct := accountsConfig.Lookup(accountCode)
		if acct == nil {
			return errp.Newf("Could not find account %s", accountCode)
		}
		if scriptType == signing.ScriptTypeP2WPKHP2SH {
			return errp.New("wrapped segwit is not supported in receive flows")
		}
		if acct.InsuranceStatus == string(bitsurance.ActiveStatus) &&
			scriptType != signing.ScriptTypeP2WPKH {
			return errp.New("insured accounts can only receive on native segwit")
		}
		return acct.SetReceiveScriptType(scriptType)
	})
	if err != nil {
		return err
	}
	backend.emitAccountsStatusChanged()
	return nil
}

// RenameAccount renames an account in the accounts database.
func (backend *Backend) RenameAccount(accountCode accountsTypes.Code, name string) error {
	if name == "" {
		return errp.New("Name cannot be empty")
	}
	err := backend.accountsDB.Update(func(accountsConfig *config.AccountsConfig) error {
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

// updateKeystoreName persists a keystore name change and updates account views.
func (backend *Backend) updateKeystoreName(rootFingerprint []byte, name string) error {
	// Serialize name changes with registration so a prepared name cannot overwrite a rename.
	defer backend.accountsAndKeystoreLock.Lock()()

	if name == "" {
		return errp.New("Name cannot be empty")
	}
	if err := backend.accountsDB.Update(func(accountsConfig *config.AccountsConfig) error {
		accountsConfig.GetOrAddKeystore(rootFingerprint).Name = name
		return nil
	}); err != nil {
		return err
	}
	backend.emitAccountsStatusChanged()
	return nil
}

// CheckKeystoreFeature checks a feature's requirements, including account-specific requirements
// when an account code is provided.
func (backend *Backend) CheckKeystoreFeature(
	ks keystore.Keystore, feature keystore.Feature, accountCode accountsTypes.Code,
) error {
	if err := ks.SupportsFeature(feature); err != nil {
		return err
	}
	if feature != keystore.FeatureBTCTransactionSigning || accountCode == "" {
		return nil
	}
	account, err := backend.GetAccountFromCode(accountCode)
	if err != nil {
		return err
	}
	btcAccount, ok := account.(*btc.Account)
	if !ok {
		return keystore.ErrUnsupportedFeature
	}
	return btcAccount.CheckTaprootSendSupport(ks)
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
	accountsConfig, err := backend.accountsDB.Snapshot()
	if err == nil {
		persistedKeystore, lookupErr := accountsConfig.LookupKeystore(rootFingerprint)
		if lookupErr == nil {
			keystoreName = persistedKeystore.Name
		}
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

// makeAccount constructs a runtime account with its backend service dependencies.
// The account manager registers and initializes the returned account.
// The accountsAndKeystoreLock must be held when calling this function.
func (backend *Backend) makeAccount(
	coin coinpkg.Coin,
	persistedConfig *config.Account,
	options accountmanager.LoadOptions,
) accounts.Interface {
	accountCode := persistedConfig.Code
	signingConfigurations := persistedConfig.SigningConfigurations
	accountConfig := &accounts.AccountConfig{
		Code:                  accountCode,
		SigningConfigurations: signingConfigurations,
		DBFolder:              backend.arguments.CacheDirectoryPath(),
		SkipInitialSync:       options.SkipETHInitialSync,
		NotesFolder:           backend.arguments.NotesDirectoryPath(),
		ConnectKeystore: func() (keystore.Keystore, error) {
			accountRootFingerprint, err := signingConfigurations.RootFingerprint()
			if err != nil {
				return nil, err
			}
			return backend.ConnectKeystore(accountRootFingerprint)
		},
		RateUpdater: backend.ratesUpdater,
		GetMainCurrency: func() string {
			return backend.config.AppConfig().Backend.MainFiat
		},
		GetNotifier: func(configurations signing.Configurations) accounts.Notifier {
			return backend.notifier.ForAccount(accountCode)
		},
		GetSaveFilename: backend.environment.GetSaveFilename,
		IsInsured: func() bool {
			accountsConfig, err := backend.accountsDB.Snapshot()
			if err != nil {
				backend.log.WithError(err).Error("could not load account insurance status")
				return false
			}
			record := accountsConfig.Lookup(accountCode)
			return record != nil &&
				record.InsuranceStatus == string(bitsurance.ActiveStatus)
		},
		UnsafeSystemOpen: backend.environment.SystemOpen,
	}

	// This function is passed as a callback to the BTC account constructor. It is called when the
	// keystore needs to determine whether an address belongs to an account on its same keystore.
	getAddressByIDCallback := func(coinCode coinpkg.Code, addressID addresses.AddressID) (*addresses.AccountAddress, error) {
		accountsByKeystore, err := backend.AccountsByKeystore()
		if err != nil {
			return nil, err
		}
		rootFingerprint, err := backend.keystore.RootFingerprint()
		if err != nil {
			return nil, err
		}
		accountViews := accountsByKeystore[hex.EncodeToString(rootFingerprint)]
		for index := range accountViews {
			accountView := &accountViews[index]
			// This only makes sense for BTC accounts.
			btcAccount, ok := accountView.Account.(*btc.Account)
			if !ok {
				continue
			}
			// Only return an address if the coin codes match.
			if btcAccount.Coin().Code() != coinCode {
				continue
			}
			if address := btcAccount.AddressByID(addressID); address != nil {
				return address, nil
			}
		}
		return nil, nil
	}

	switch specificCoin := coin.(type) {
	case *btc.Coin:
		return backend.makeBtcAccount(
			accountConfig,
			specificCoin,
			backend.gapLimits(),
			getAddressByIDCallback,
			backend.log,
		)
	case *eth.Coin:
		return backend.makeEthAccount(accountConfig, specificCoin, backend.log)
	default:
		panic("unknown coin type")
	}
}

// applyAccountReconcileEffectsLocked updates services and observers after membership reconciliation.
// accountsAndKeystoreLock must be held.
func (backend *Backend) applyAccountReconcileEffectsLocked(
	membershipChanged bool,
	refreshAllETHAccounts bool,
) {
	if refreshAllETHAccounts {
		backend.enqueueETHInitialSyncLocked()
	}
	backend.emitAccountsStatusChanged()
	if membershipChanged {
		backend.configureHistoryExchangeRates()
	}
}

func (backend *Backend) emitAccountsStatusChanged() {
	backend.Notify(observable.Event{
		Subject: "accounts",
		Action:  action.Reload,
	})
}

// persistAccount adds a prepared account to the authoritative account records.
func (backend *Backend) persistAccount(account config.Account, accountsConfig *config.AccountsConfig) error {
	if account.Name == "" {
		return errp.New("Account name cannot be empty")
	}
	for _, existingAccount := range accountsConfig.Accounts {
		if account.Code == existingAccount.Code {
			backend.log.Errorf("An account with same code exists: %s", account.Code)
			return errp.WithStack(errAccountAlreadyExists)
		}
		if account.CoinCode == existingAccount.CoinCode {
			// We detect a duplicate account (subaccount in a unified account) if any of the
			// configurations is already present.
			for _, signingConfig := range account.SigningConfigurations {
				for _, existingSigningConfig := range existingAccount.SigningConfigurations {
					if signingConfig.ExtendedPublicKey().String() ==
						existingSigningConfig.ExtendedPublicKey().String() {
						return errp.WithStack(errAccountAlreadyExists)
					}
				}
			}

		}
	}
	account.ActiveTokens = slices.Clone(account.ActiveTokens)
	accountsConfig.Accounts = append(accountsConfig.Accounts, &account)
	return nil
}

// buildDefaultAccountConfigs prepares the default accounts for the connected keystore (not manually
// user-added). Currently the first bip44 account of BTC/LTC/ETH. ERC20 tokens are added if they were
// configured to be active by the user in the past, when they could still configure them globally
// in the settings.
//
// The accounts are only added for the coins that are marked active in the settings. This used to be
// a user-facing setting. Now we simply use it for migration to decide which coins to add by
// default.
func (backend *Backend) buildDefaultAccountConfigs(
	keystore keystore.Keystore,
) ([]config.Account, error) {
	var accountConfigs []config.Account
	for _, coinCode := range backend.coinPolicy().supportedCoins() {
		if !backend.config.AppConfig().Backend.DeprecatedCoinActive(coinCode) {
			continue
		}

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

		_, account, err := backend.accountBuilder.Build(
			coinCode,
			0,
			false,
			"",
			keystore,
			activeTokens,
		)
		if err != nil {
			return nil, err
		}
		if account != nil {
			accountConfigs = append(accountConfigs, *account)
		}
	}
	return accountConfigs, nil
}

// enqueueETHInitialSyncLocked asks the ETH updater to refresh all loaded ETH accounts if any exist.
//
// The accountsAndKeystoreLock must be held when calling this function.
func (backend *Backend) enqueueETHInitialSyncLocked() {
	for _, account := range backend.accounts.Accounts() {
		if _, ok := account.Coin().(*eth.Coin); ok {
			backend.enqueueETHUpdateForAllAccountsAsync()
			return
		}
	}
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

	// Enable accounts discovery for these coins.
	for _, coinCode := range backend.coinPolicy().discoveryCoins() {
		log := backend.log.
			WithField("rootFingerprint", hex.EncodeToString(rootFingerprint)).
			WithField("coinCode", coinCode)
		coin, err := backend.Coin(coinCode)
		if err != nil {
			backend.log.Errorf("could not find coin %s", coinCode)
			continue
		}
		if !backend.keystore.SupportsCoin(coin) {
			continue
		}
		accountsConfig, err := backend.accountsDB.Snapshot()
		if err != nil {
			log.WithError(err).Error("could not load account records")
			continue
		}
		nextAccountNumber, ok := nextDiscoveryAccountNumber(
			coinCode,
			accountCandidates(&accountsConfig, rootFingerprint, coinCode),
		)
		if !ok {
			continue
		}
		accountCode, account, err := backend.accountBuilder.Build(
			coinCode,
			nextAccountNumber,
			true,
			"",
			backend.keystore,
			nil,
		)
		if err != nil {
			log.WithError(err).Error("adding hidden account failed")
			continue
		}
		if account == nil {
			continue
		}
		if err := backend.accountsDB.Update(func(cfg *config.AccountsConfig) error {
			return backend.persistAccount(*account, cfg)
		}); err != nil {
			log.WithError(err).Error("maybeAddHiddenUnusedAccounts failed")
			continue
		}
		log.
			WithField("accountCode", accountCode).
			WithField("accountNumber", nextAccountNumber).
			Info("automatically created hidden account")
		accountsConfig, err = backend.accountsDB.Snapshot()
		if err != nil {
			log.WithError(err).Error("could not load account records")
			continue
		}
		backend.accounts.ReconcileFamily(accountsConfig, accountCode, backend.keystore)
		// Discovery adds scanning accounts without restarting historical exchange-rate updates.
		backend.emitAccountsStatusChanged()
	}
}

func (backend *Backend) checkAccountUsed(account accounts.Interface) {
	if backend.tstCheckAccountUsed != nil {
		if !backend.tstCheckAccountUsed(account) {
			return
		}
	}

	log := backend.log.WithField("accountCode", account.Config().Code)
	accountsConfig, err := backend.accountsDB.Snapshot()
	if err != nil {
		log.WithError(err).Error("checkAccountUsed")
		return
	}
	accountRecord := accountsConfig.Lookup(account.Config().Code)
	if accountRecord == nil {
		log.Error("could not find account")
		return
	}
	if !accountRecord.Used {
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
	var emitUpdate bool
	err = backend.accountsDB.Update(func(accountsConfig *config.AccountsConfig) error {
		acct := accountsConfig.Lookup(account.Config().Code)
		if acct == nil {
			return errp.Newf("could not find account")
		}
		emitUpdate = !acct.Used || acct.HiddenBecauseUnused
		acct.Used = true
		acct.HiddenBecauseUnused = false

		return nil
	})
	if err != nil {
		log.WithError(err).Error("checkAccountUsed")
		return
	}
	if emitUpdate {
		backend.emitAccountsStatusChanged()
	}
	backend.maybeAddHiddenUnusedAccounts()
}

// LookupEthAccountCode takes an Ethereum address and returns the corresponding account code and account name
// Used for handling Wallet Connect requests from anywhere in the app
// Implemented only for pure ETH accounts (not ERC20s), as all Wallet Connect interactions are handled through the root ETH accounts.
func (backend *Backend) LookupEthAccountCode(address string) (accountsTypes.Code, string, error) {
	accountViews := backend.Accounts()
	for index := range accountViews {
		accountView := &accountViews[index]
		ethAccount, ok := accountView.Account.(*eth.Account)
		if !ok {
			continue
		}
		matches, err := ethAccount.MatchesAddress(address)
		if err != nil {
			return "", "", err
		}
		if matches && !eth.IsERC20(ethAccount) {
			return accountView.Record.Code, accountView.Record.Name, nil
		}
	}
	return "", "", errp.Newf("Account with address: %s not found", address)
}
