// SPDX-License-Identifier: Apache-2.0

package backend

import (
	"context"
	"math/big"
	"slices"
	"sort"
	"strings"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	accountsTypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/types"
	btcaddresses "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/addresses"
	coinpkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/config"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/market/swapkit"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/paymentrequest"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
)

// SwapAccount contains the backend-native data needed to serialize swap accounts.
type SwapAccount struct {
	Keystore          config.Keystore
	KeystoreConnected bool
	AccountConfig     *config.Account
	AccountCoin       coinpkg.Coin
	ParentAccountCode *accountsTypes.Code
}

// SwapSignTxInput mirrors the existing frontend tx proposal input shape.
type SwapSignTxInput struct {
	Address        string                 `json:"address"`
	Amount         string                 `json:"amount"`
	UseHighestFee  bool                   `json:"useHighestFee"`
	SendAll        string                 `json:"sendAll"`
	SelectedUTXOS  []string               `json:"selectedUTXOS"`
	PaymentRequest *paymentrequest.Slip24 `json:"paymentRequest"`
}

// SwapPreparation contains everything the frontend needs to reuse the regular account tx flow.
type SwapPreparation struct {
	ExpectedBuyAmount string          `json:"expectedBuyAmount"`
	SwapID            string          `json:"swapId"`
	TxInput           SwapSignTxInput `json:"txInput"`
}

// SwapAccounts contains the sell and buy accounts needed by the swap screen.
type SwapAccounts struct {
	SellAccounts           []SwapAccount
	BuyAccounts            []SwapAccount
	DefaultSellAccountCode *accountsTypes.Code
	DefaultBuyAccountCode  *accountsTypes.Code
}

// SwapConnectedKeystore describes whether the currently connected keystore is absent, multi, or btc-only.
type SwapConnectedKeystore string

const (
	swapConnectedKeystoreNone    SwapConnectedKeystore = "none"
	swapConnectedKeystoreMulti   SwapConnectedKeystore = "multi"
	swapConnectedKeystoreBTCOnly SwapConnectedKeystore = "btc-only"
)

// SwapStatus summarizes whether swap should be shown at all and what kind of keystore is connected right now.
type SwapStatus struct {
	Available         bool                  `json:"available"`
	ConnectedKeystore SwapConnectedKeystore `json:"connectedKeystore"`
}

// SwapAccounts returns the accounts that can be selected in the swap screen.
func (backend *Backend) SwapAccounts() (SwapAccounts, error) {
	sellAccounts, buyAccounts, err := backend.swapAccounts()
	if err != nil {
		return SwapAccounts{}, err
	}
	defaultSellAccount, defaultSellAccountCode := backend.swapDefaultSellAccount(sellAccounts)
	defaultBuyAccountCode := swapDefaultBuyAccount(buyAccounts, defaultSellAccount)
	return SwapAccounts{
		SellAccounts:           sellAccounts,
		BuyAccounts:            buyAccounts,
		DefaultSellAccountCode: defaultSellAccountCode,
		DefaultBuyAccountCode:  defaultBuyAccountCode,
	}, nil
}

// swapAvailable reports whether swap can be shown. It is available when there is at least one
// non-Bitcoin account currently available, including watch-only and inactive accounts.
func (backend *Backend) swapAvailable() bool {
	for _, account := range backend.Accounts() {
		accountConfig := account.Config().Config
		if accountConfig.HiddenBecauseUnused {
			continue
		}
		if _, isTestnet := coinpkg.TestnetCoins[accountConfig.CoinCode]; isTestnet != backend.Testing() {
			continue
		}
		if account.Coin().Code() == coinpkg.CodeBTC {
			continue
		}
		return true
	}
	return false
}

// swapConnectedKeystore reports whether the currently connected keystore is absent, multi, or btc-only.
func (backend *Backend) swapConnectedKeystore() SwapConnectedKeystore {
	connectedKeystore := backend.Keystore()
	if connectedKeystore == nil {
		return swapConnectedKeystoreNone
	}
	for _, coinCode := range []coinpkg.Code{coinpkg.CodeLTC, coinpkg.CodeETH} {
		coin, err := backend.Coin(coinCode)
		if err != nil {
			continue
		}
		if connectedKeystore.SupportsCoin(coin) {
			return swapConnectedKeystoreMulti
		}
	}
	return swapConnectedKeystoreBTCOnly
}

// SwapStatus combines the broad swap availability signal with the current connected keystore state.
// This lets callers distinguish between "swap exists", "a multi device is connected", and "only a btc-only device is connected".
func (backend *Backend) SwapStatus() SwapStatus {
	return SwapStatus{
		Available:         backend.swapAvailable(),
		ConnectedKeystore: backend.swapConnectedKeystore(),
	}
}

func (backend *Backend) connectedKeystoreConfig() (*config.Keystore, error) {
	persistedAccounts := backend.config.AccountsConfig()
	connectedKeystore := backend.Keystore()
	if connectedKeystore == nil {
		return nil, nil
	}
	connectedRootFingerprint, err := connectedKeystore.RootFingerprint()
	if err != nil {
		return nil, errp.Wrap(err, "could not retrieve rootFingerprint")
	}
	keystore, err := persistedAccounts.LookupKeystore(connectedRootFingerprint)
	if err != nil {
		return nil, errp.Wrap(err, "could not find connected keystore in config")
	}
	return keystore, nil
}

// swapAccounts collects swap sell and buy accounts in one pass over persisted accounts.
// The buy side includes inactive accounts/tokens so they can be activated on demand,
// while the sell side includes only currently active accounts/tokens.
func (backend *Backend) swapAccounts() ([]SwapAccount, []SwapAccount, error) {
	connectedKeystore, err := backend.connectedKeystoreConfig()
	if err != nil {
		return nil, nil, err
	}
	if connectedKeystore == nil {
		return []SwapAccount{}, []SwapAccount{}, nil
	}

	sellAccounts := []SwapAccount{}
	buyAccounts := []SwapAccount{}
	persistedAccounts := backend.config.AccountsConfig()
	for _, persistedAccount := range persistedAccounts.Accounts {
		if persistedAccount.HiddenBecauseUnused {
			continue
		}
		if _, isTestnet := coinpkg.TestnetCoins[persistedAccount.CoinCode]; isTestnet != backend.Testing() {
			continue
		}

		rootFingerprint, err := persistedAccount.SigningConfigurations.RootFingerprint()
		if err != nil {
			backend.log.WithField("code", persistedAccount.Code).Error("could not identify root fingerprint")
			continue
		}
		if !slices.Equal(rootFingerprint, connectedKeystore.RootFingerprint) {
			continue
		}

		accountCoin, err := backend.Coin(persistedAccount.CoinCode)
		if err != nil {
			backend.log.WithField("code", persistedAccount.Code).WithError(err).Error("could not find coin")
			continue
		}

		swapAccount := SwapAccount{
			Keystore:          *connectedKeystore,
			KeystoreConnected: true,
			AccountConfig:     persistedAccount,
			AccountCoin:       accountCoin,
		}
		buyAccounts = append(buyAccounts, swapAccount)
		if !persistedAccount.Inactive {
			sellAccounts = append(sellAccounts, swapAccount)
		}

		if persistedAccount.CoinCode != coinpkg.CodeETH {
			continue
		}
		sellAccounts, buyAccounts = backend.appendERC20SwapAccounts(
			sellAccounts,
			buyAccounts,
			*connectedKeystore,
			persistedAccount,
		)
	}

	sortAccounts := func(accounts []SwapAccount) {
		sort.Slice(accounts, func(i, j int) bool {
			return lessAccountSortOrder(
				accounts[i].AccountCoin,
				accounts[i].AccountConfig,
				accounts[j].AccountCoin,
				accounts[j].AccountConfig,
			)
		})
	}
	sortAccounts(sellAccounts)
	sortAccounts(buyAccounts)

	return sellAccounts, buyAccounts, nil
}

// swapDefaultSellAccount prefers ETH with balance first, then any non-BTC account with balance,
// then BTC with balance, and finally falls back to the first available sell account.
func (backend *Backend) swapDefaultSellAccount(sellAccounts []SwapAccount) (*SwapAccount, *accountsTypes.Code) {
	var firstBTCAccount *SwapAccount
	var firstNonBTCAccount *SwapAccount
	for _, account := range sellAccounts {
		// Skip accounts with no balance as they can't be used to sell.
		if !backend.accountHasNonZeroBalance(account.AccountConfig.Code) {
			continue
		}
		switch account.AccountCoin.Code() {
		case coinpkg.CodeETH:
			// Prefer the first ETH account with balance immediately.
			return &account, &account.AccountConfig.Code
		case coinpkg.CodeBTC:
			if firstBTCAccount == nil {
				// Keep the first BTC candidate as a final fallback.
				firstBTCAccount = &account
			}
		default:
			if firstNonBTCAccount == nil {
				// Keep the first non-BTC candidate in case no ETH account is available.
				firstNonBTCAccount = &account
			}
		}
	}
	if firstNonBTCAccount != nil {
		return firstNonBTCAccount, &firstNonBTCAccount.AccountConfig.Code
	}
	if firstBTCAccount != nil {
		return firstBTCAccount, &firstBTCAccount.AccountConfig.Code
	}
	if len(sellAccounts) == 0 {
		return nil, nil
	}
	return &sellAccounts[0], &sellAccounts[0].AccountConfig.Code
}

// swapDefaultBuyAccount prefers BTC as the buy side, except when selling BTC, where it prefers
// ETH instead. If that preferred coin is unavailable, it falls back to the first account that is
// different from the default sell account.
func swapDefaultBuyAccount(
	buyAccounts []SwapAccount,
	defaultSellAccount *SwapAccount,
) *accountsTypes.Code {
	if defaultSellAccount == nil {
		return nil
	}
	preferredBuyCoinCode := coinpkg.CodeBTC
	if defaultSellAccount.AccountCoin.Code() == coinpkg.CodeBTC {
		preferredBuyCoinCode = coinpkg.CodeETH
	}
	for _, account := range buyAccounts {
		if account.AccountCoin.Code() == preferredBuyCoinCode {
			return &account.AccountConfig.Code
		}
	}
	for _, account := range buyAccounts {
		if account.AccountConfig.Code == defaultSellAccount.AccountConfig.Code {
			continue
		}
		return &account.AccountConfig.Code
	}
	return nil
}

func (backend *Backend) accountHasNonZeroBalance(accountCode accountsTypes.Code) bool {
	account := backend.Accounts().lookup(accountCode)
	if account == nil {
		return false
	}
	balance, err := account.Balance()
	if err != nil {
		backend.log.WithField("code", accountCode).WithError(err).Error("could not get account balance")
		return false
	}
	if balance == nil {
		return false
	}
	return balance.Available().BigInt().Sign() > 0
}

// PrepareSwap prepares a real SwapKit swap and returns a tx input that can be proposed and sent
// through the existing account tx flow.
func (backend *Backend) PrepareSwap(
	buyAccountCode, sellAccountCode accountsTypes.Code,
	routeID, sellAmount string,
	selectedUTXOs []string,
) (*SwapPreparation, error) {
	if err := backend.activateSwapBuyAccount(buyAccountCode); err != nil {
		return nil, err
	}

	sellAccount, err := backend.GetAccountFromCode(sellAccountCode)
	if err != nil {
		return nil, err
	}
	buyAccount, err := backend.GetAccountFromCode(buyAccountCode)
	if err != nil {
		return nil, err
	}
	if err := validateSwapAccountSupported(sellAccount); err != nil {
		return nil, err
	}
	if err := validateSwapAccountSupported(buyAccount); err != nil {
		return nil, err
	}

	// Grab an unused address; since we build the tx ourselves, we don't need an used
	// address; this address is then used for refunds.
	sourceAddress, err := firstUnusedAddress(sellAccount)
	if err != nil {
		return nil, err
	}

	destinationAddress, destinationDerivation, err := swapDestinationAddress(buyAccount)
	if err != nil {
		return nil, err
	}

	swapSellAmount, err := swapkit.FormatAmount(sellAccount.Coin(), sellAmount)
	if err != nil {
		return nil, err
	}

	swapResponse, swapError := swapkit.NewSwap(
		context.Background(),
		backend.httpClient,
		string(sellAccount.Coin().Code()),
		string(buyAccount.Coin().Code()),
		swapSellAmount,
		routeID,
		sourceAddress.EncodeForHumans(),
		destinationAddress,
	)
	if swapError != nil {
		return nil, errp.New(swapError.Message)
	}
	if strings.TrimSpace(swapResponse.Memo) != "" {
		return nil, errp.New("Swap transaction memo is currently unsupported")
	}
	paymentRequest := swapResponse.PaymentRequest()
	if paymentRequest == nil {
		return nil, errp.New("Missing payment request")
	}
	if len(paymentRequest.Outputs) != 1 {
		return nil, errp.New("Missing or multiple payment request output unsupported")
	}
	if !slip24HasCoinPurchase(paymentRequest) {
		return nil, errp.New("Missing coinPurchase payment request memo")
	}
	txInput, err := swapSignTxInput(paymentRequest, sellAccount.Coin(), destinationDerivation, selectedUTXOs)
	if err != nil {
		return nil, err
	}
	return &SwapPreparation{
		ExpectedBuyAmount: swapResponse.ExpectedBuyAmount,
		SwapID:            swapResponse.SwapID,
		TxInput:           txInput,
	}, nil
}

func validateSwapAccountSupported(account accounts.Interface) error {
	coinCode := account.Coin().Code()
	switch coinCode {
	case coinpkg.CodeBTC, coinpkg.CodeLTC, coinpkg.CodeETH:
		return nil
	}
	for _, token := range ERC20Tokens() {
		if coinCode == token.Code {
			return nil
		}
	}
	return errp.New("Only supported mainnet BTC/LTC/ETH/ERC20 accounts are currently supported")
}

func (backend *Backend) activateSwapBuyAccount(buyAccountCode accountsTypes.Code) error {
	_, buyAccounts, err := backend.swapAccounts()
	if err != nil {
		return err
	}
	for _, account := range buyAccounts {
		if account.AccountConfig.Code != buyAccountCode {
			continue
		}
		if account.ParentAccountCode != nil {
			if parentAccount := backend.config.AccountsConfig().Lookup(*account.ParentAccountCode); parentAccount != nil && parentAccount.Inactive {
				if err := backend.SetAccountActive(*account.ParentAccountCode, true); err != nil {
					return err
				}
			}
			if account.AccountConfig.Inactive {
				if err := backend.SetTokenActive(*account.ParentAccountCode, string(account.AccountCoin.Code()), true); err != nil {
					return err
				}
			}
			return nil
		}
		if account.AccountConfig.Inactive {
			return backend.SetAccountActive(account.AccountConfig.Code, true)
		}
		return nil
	}
	return errp.Newf("Could not find swap buy account %s", buyAccountCode)
}

func (backend *Backend) appendERC20SwapAccounts(
	sellAccounts, buyAccounts []SwapAccount,
	keystore config.Keystore,
	persistedAccount *config.Account,
) ([]SwapAccount, []SwapAccount) {
	for _, token := range ERC20Tokens() {
		tokenCoin, err := backend.Coin(token.Code)
		if err != nil {
			backend.log.WithField("tokenCode", token.Code).WithError(err).Error("could not find ERC20 coin")
			continue
		}

		tokenAccountCode := Erc20AccountCode(persistedAccount.Code, string(token.Code))
		tokenName, err := configuredAccountName(tokenCoin, persistedAccount)
		if err != nil {
			backend.log.WithField("code", persistedAccount.Code).WithError(err).Error("could not get account number")
		}

		tokenConfig := &config.Account{
			Inactive:              !slices.Contains(persistedAccount.ActiveTokens, string(token.Code)),
			HiddenBecauseUnused:   persistedAccount.HiddenBecauseUnused,
			CoinCode:              token.Code,
			Name:                  tokenName,
			Code:                  tokenAccountCode,
			SigningConfigurations: persistedAccount.SigningConfigurations,
		}
		parentCode := persistedAccount.Code
		swapAccount := SwapAccount{
			Keystore:          keystore,
			KeystoreConnected: true,
			AccountConfig:     tokenConfig,
			AccountCoin:       tokenCoin,
			ParentAccountCode: &parentCode,
		}
		buyAccounts = append(buyAccounts, swapAccount)
		if !persistedAccount.Inactive && !tokenConfig.Inactive {
			sellAccounts = append(sellAccounts, swapAccount)
		}
	}
	return sellAccounts, buyAccounts
}

func slip24HasCoinPurchase(paymentRequest *paymentrequest.Slip24) bool {
	if paymentRequest == nil {
		return false
	}
	for _, memo := range paymentRequest.Memos {
		if memo.CoinPurchase != nil {
			return true
		}
	}
	return false
}

func frontendPaymentRequest(
	paymentRequest *paymentrequest.Slip24,
	destinationDerivation *paymentrequest.Slip24AddressDerivation,
) *paymentrequest.Slip24 {
	if paymentRequest == nil {
		return nil
	}
	memos := make([]paymentrequest.Slip24Memo, 0, len(paymentRequest.Memos))
	for _, memo := range paymentRequest.Memos {
		switch memo.Type {
		case "text":
			memos = append(memos, paymentrequest.Slip24Memo{
				Type: "text",
				Text: memo.Text,
			})
		case "coinPurchase":
			if memo.CoinPurchase == nil {
				continue
			}
			mappedMemo := paymentrequest.Slip24Memo{
				Type: "coinPurchase",
				CoinPurchase: &paymentrequest.Slip24CoinPurchase{
					CoinType: memo.CoinPurchase.CoinType,
					Amount:   memo.CoinPurchase.Amount,
					Address:  memo.CoinPurchase.Address,
				},
			}
			if destinationDerivation != nil {
				mappedMemo.CoinPurchase.AddressDerivation = destinationDerivation
			}
			memos = append(memos, mappedMemo)
		}
	}
	return &paymentrequest.Slip24{
		RecipientName: paymentRequest.RecipientName,
		Nonce:         paymentRequest.Nonce,
		Memos:         memos,
		Outputs:       paymentRequest.Outputs,
		Signature:     paymentRequest.Signature,
	}
}

func swapSignTxInput(
	paymentRequest *paymentrequest.Slip24,
	sellCoin coinpkg.Coin,
	destinationDerivation *paymentrequest.Slip24AddressDerivation,
	selectedUTXOs []string,
) (SwapSignTxInput, error) {
	if paymentRequest == nil {
		return SwapSignTxInput{}, errp.New("Missing payment request")
	}
	if len(paymentRequest.Outputs) != 1 {
		return SwapSignTxInput{}, errp.New("Missing or multiple payment request output unsupported")
	}
	output := paymentRequest.Outputs[0]
	if strings.TrimSpace(output.Address) == "" {
		return SwapSignTxInput{}, errp.New("Missing target address")
	}
	amount := sellCoin.FormatAmount(coinpkg.NewAmount(new(big.Int).SetUint64(output.Amount)), false)
	return SwapSignTxInput{
		Address:        output.Address,
		Amount:         amount,
		UseHighestFee:  true,
		SendAll:        "no",
		SelectedUTXOS:  selectedUTXOs,
		PaymentRequest: frontendPaymentRequest(paymentRequest, destinationDerivation),
	}, nil
}

func firstUnusedAddress(account accounts.Interface) (accounts.Address, error) {
	addressLists, err := account.GetUnusedReceiveAddresses()
	if err != nil {
		return nil, err
	}
	for _, addressList := range addressLists {
		if len(addressList.Addresses) == 0 {
			continue
		}
		return addressList.Addresses[0], nil
	}
	return nil, errp.New("Could not find an unused receive address")
}

func swapDestinationAddress(account accounts.Interface) (string, *paymentrequest.Slip24AddressDerivation, error) {
	address, err := firstUnusedAddress(account)
	if err != nil {
		return "", nil, err
	}
	switch typedAddress := address.(type) {
	case eth.Address:
		return typedAddress.EncodeForHumans(), &paymentrequest.Slip24AddressDerivation{
			Eth: &paymentrequest.Slip24EthAddressDerivation{
				Keypath: typedAddress.AbsoluteKeypath().ToUInt32(),
			},
		}, nil
	case *btcaddresses.AccountAddress:
		return typedAddress.EncodeForHumans(), &paymentrequest.Slip24AddressDerivation{
			Btc: &paymentrequest.Slip24BtcAddressDerivation{
				Keypath:    typedAddress.AbsoluteKeypath().ToUInt32(),
				ScriptType: string(typedAddress.AccountConfiguration.ScriptType()),
			},
		}, nil
	default:
		return "", nil, errp.New("Unsupported swap destination address type")
	}
}
