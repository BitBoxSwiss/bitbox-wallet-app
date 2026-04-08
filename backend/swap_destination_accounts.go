// SPDX-License-Identifier: Apache-2.0

package backend

import (
	"bytes"
	"context"
	"math/big"
	"slices"
	"sort"
	"strings"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	accountsTypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/types"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc"
	btcaddresses "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/addresses"
	coinpkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/config"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/market/swapkit"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/paymentrequest"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/signing"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	ethcommon "github.com/ethereum/go-ethereum/common"
	ethcrypto "github.com/ethereum/go-ethereum/crypto"
)

// SwapDestinationAccount contains the backend-native data needed to serialize swap destinations.
type SwapDestinationAccount struct {
	Keystore          config.Keystore
	AccountConfig     *config.Account
	AccountCoin       coinpkg.Coin
	KeystoreConnected bool
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

// SwapSignResult contains everything the frontend needs to reuse the regular BTC send flow.
type SwapSignResult struct {
	ExpectedBuyAmount string          `json:"expectedBuyAmount"`
	SwapID            string          `json:"swapId"`
	TxInput           SwapSignTxInput `json:"txInput"`
}

// SwapDestinationAccounts returns the accounts that can be selected as swap destinations.
func (backend *Backend) SwapDestinationAccounts() []*SwapDestinationAccount {
	persistedAccounts := backend.config.AccountsConfig()

	swapAccounts := []*SwapDestinationAccount{}
	for _, persistedAccount := range persistedAccounts.Accounts {
		if !backend.shouldIncludeSwapDestinationAccount(persistedAccount) {
			continue
		}

		keystore, keystoreConnected, ok := backend.swapDestinationKeystore(
			persistedAccounts,
			persistedAccount,
		)
		if !ok {
			continue
		}

		accountCoin, err := backend.Coin(persistedAccount.CoinCode)
		if err != nil {
			backend.log.WithField("code", persistedAccount.Code).WithError(err).Error("could not find coin")
			continue
		}

		swapAccounts = append(swapAccounts, &SwapDestinationAccount{
			Keystore:          *keystore,
			AccountConfig:     persistedAccount,
			AccountCoin:       accountCoin,
			KeystoreConnected: keystoreConnected,
		})

		if persistedAccount.CoinCode != coinpkg.CodeETH {
			continue
		}
		swapAccounts = backend.appendERC20SwapDestinationAccounts(
			swapAccounts,
			*keystore,
			persistedAccount,
			keystoreConnected,
		)
	}

	sort.Slice(swapAccounts, func(i, j int) bool {
		return lessAccountSortOrder(
			swapAccounts[i].AccountCoin,
			swapAccounts[i].AccountConfig,
			swapAccounts[j].AccountCoin,
			swapAccounts[j].AccountConfig,
		)
	})

	return swapAccounts
}

// SignSwap prepares a real SwapKit swap and returns a tx input that can be proposed and sent
// through the existing BTC payment-request flow.
func (backend *Backend) SignSwap(
	buyAccountCode, sellAccountCode accountsTypes.Code,
	routeID, sellAmount string,
) (*SwapSignResult, error) {
	if err := backend.activateSwapDestinationAccount(buyAccountCode); err != nil {
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
	switch sellAccount.(type) {
	case *btc.Account, *eth.Account:
	default:
		return nil, errp.New("Only BTC/ETH/ERC20 sell accounts are currently supported")
	}
	switch buyAccount.(type) {
	case *btc.Account, *eth.Account:
	default:
		return nil, errp.New("Only BTC/ETH/ERC20 receive accounts are currently supported")
	}

	sourceAddress, err := swapSourceAddress(sellAccount)
	if err != nil {
		return nil, err
	}
	destinationAddress, destinationDerivation, destinationAddressObj, err := swapDestinationAddress(buyAccount)
	if err != nil {
		return nil, err
	}
	swapSellAmount, err := swapkit.FormatAmount(sellAccount.Coin(), sellAmount)
	if err != nil {
		return nil, err
	}

	swapResponse, swapError := swapkit.NewSwap(
		context.Background(),
		string(sellAccount.Coin().Code()),
		string(buyAccount.Coin().Code()),
		swapSellAmount,
		routeID,
		sourceAddress,
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
	if err := backend.verifySwapDestinationAccount(sellAccount, buyAccount, destinationAddressObj); err != nil {
		return nil, err
	}
	txInput, err := swapSignTxInput(paymentRequest, sellAccount.Coin(), destinationDerivation)
	if err != nil {
		return nil, err
	}
	return &SwapSignResult{
		ExpectedBuyAmount: swapResponse.ExpectedBuyAmount,
		SwapID:            swapResponse.SwapID,
		TxInput:           txInput,
	}, nil
}

func (backend *Backend) activateSwapDestinationAccount(buyAccountCode accountsTypes.Code) error {
	account, err := backend.swapDestinationAccount(buyAccountCode)
	if err != nil {
		return err
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

func (backend *Backend) shouldIncludeSwapDestinationAccount(account *config.Account) bool {
	if account.HiddenBecauseUnused {
		return false
	}
	if _, isTestnet := coinpkg.TestnetCoins[account.CoinCode]; isTestnet != backend.Testing() {
		return false
	}
	return true
}

func (backend *Backend) swapDestinationAccount(
	accountCode accountsTypes.Code,
) (*SwapDestinationAccount, error) {
	for _, account := range backend.SwapDestinationAccounts() {
		if account.AccountConfig.Code == accountCode {
			return account, nil
		}
	}
	return nil, errp.Newf("Could not find swap destination account %s", accountCode)
}

// swapDestinationKeystore returns the account keystore, whether it is currently connected,
// and whether the account can be offered as a swap destination.
func (backend *Backend) swapDestinationKeystore(
	persistedAccounts config.AccountsConfig,
	persistedAccount *config.Account,
) (*config.Keystore, bool, bool) {
	rootFingerprint, err := persistedAccount.SigningConfigurations.RootFingerprint()
	if err != nil {
		backend.log.WithField("code", persistedAccount.Code).Error("could not identify root fingerprint")
		return nil, false, false
	}
	keystore, err := persistedAccounts.LookupKeystore(rootFingerprint)
	if err != nil {
		backend.log.WithField("code", persistedAccount.Code).Error("could not find keystore of account")
		return nil, false, false
	}

	var connectedRootFingerprint []byte
	if backend.keystore != nil {
		connectedRootFingerprint, err = backend.keystore.RootFingerprint()
		if err != nil {
			backend.log.WithError(err).Error("Could not retrieve rootFingerprint")
			return nil, false, false
		}
	}
	keystoreConnected := bytes.Equal(rootFingerprint, connectedRootFingerprint)
	isWatchonly, err := persistedAccounts.IsAccountWatchOnly(persistedAccount)
	if err != nil {
		backend.log.WithField("code", persistedAccount.Code).WithError(err).Error("could not determine watch-only status")
		return nil, false, false
	}
	if !keystoreConnected && !isWatchonly {
		return nil, false, false
	}
	return keystore, keystoreConnected, true
}

func (backend *Backend) appendERC20SwapDestinationAccounts(
	swapAccounts []*SwapDestinationAccount,
	keystore config.Keystore,
	persistedAccount *config.Account,
	keystoreConnected bool,
) []*SwapDestinationAccount {
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
		swapAccounts = append(swapAccounts, &SwapDestinationAccount{
			Keystore:          keystore,
			AccountConfig:     tokenConfig,
			AccountCoin:       tokenCoin,
			KeystoreConnected: keystoreConnected,
			ParentAccountCode: &parentCode,
		})
	}
	return swapAccounts
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

func (backend *Backend) verifySwapDestinationAccount(
	sellAccount, buyAccount accounts.Interface,
	destinationAddress accounts.Address,
) error {
	if backend.keystore == nil {
		return errp.New("A BitBox02 must be connected to verify the swap destination account")
	}

	sellRootFingerprint, err := sellAccount.Config().Config.SigningConfigurations.RootFingerprint()
	if err != nil {
		return err
	}
	buyRootFingerprint, err := buyAccount.Config().Config.SigningConfigurations.RootFingerprint()
	if err != nil {
		return err
	}
	if !bytes.Equal(sellRootFingerprint, buyRootFingerprint) {
		return errp.New("Swap destination account must belong to the same keystore as the sell account")
	}
	if err := compareRootFingerprint(backend.keystore, sellRootFingerprint); err != nil {
		if err == ErrWrongKeystore {
			return errp.New("The connected keystore does not match the selected swap accounts")
		}
		return err
	}

	switch specificBuyAccount := buyAccount.(type) {
	case *eth.Account:
		destinationKeypathAbs := destinationAddress.AbsoluteKeypath()
		xpub, err := backend.keystore.ExtendedPublicKey(buyAccount.Coin(), destinationKeypathAbs)
		if err != nil {
			return err
		}
		pubkey, err := xpub.ECPubKey()
		if err != nil {
			return err
		}
		derivedAddress := ethcrypto.PubkeyToAddress(*pubkey.ToECDSA()).Hex()
		if derivedAddress != ethcommon.HexToAddress(destinationAddress.EncodeForHumans()).Hex() {
			return errp.New("Selected swap destination address does not belong to the connected keystore")
		}
	case *btc.Account:
		accountAddress, ok := destinationAddress.(*btcaddresses.AccountAddress)
		if !ok {
			return errp.New("Unexpected BTC destination address type")
		}
		xpub, err := backend.keystore.ExtendedPublicKey(
			buyAccount.Coin(),
			accountAddress.AccountConfiguration.AbsoluteKeypath(),
		)
		if err != nil {
			return err
		}
		derivedConfig := signing.NewBitcoinConfiguration(
			accountAddress.AccountConfiguration.ScriptType(),
			sellRootFingerprint,
			accountAddress.AccountConfiguration.AbsoluteKeypath(),
			xpub,
		)
		derivedAddress := btcaddresses.NewAccountAddress(
			derivedConfig,
			accountAddress.Derivation,
			specificBuyAccount.Coin().(*btc.Coin).Net(),
			backend.log,
		)
		if derivedAddress.EncodeForHumans() != destinationAddress.EncodeForHumans() {
			return errp.New("Selected swap destination address does not belong to the connected keystore")
		}
	default:
		return errp.New("Unsupported swap destination account")
	}
	return nil
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
		SelectedUTXOS:  []string{},
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

func swapDestinationAddress(account accounts.Interface) (string, *paymentrequest.Slip24AddressDerivation, accounts.Address, error) {
	address, err := firstUnusedAddress(account)
	if err != nil {
		return "", nil, nil, err
	}
	switch typedAddress := address.(type) {
	case eth.Address:
		return typedAddress.EncodeForHumans(), &paymentrequest.Slip24AddressDerivation{
			Eth: &paymentrequest.Slip24EthAddressDerivation{
				Keypath: typedAddress.AbsoluteKeypath().ToUInt32(),
			},
		}, typedAddress, nil
	case *btcaddresses.AccountAddress:
		return typedAddress.EncodeForHumans(), &paymentrequest.Slip24AddressDerivation{
			Btc: &paymentrequest.Slip24BtcAddressDerivation{
				Keypath:    typedAddress.AbsoluteKeypath().ToUInt32(),
				ScriptType: string(typedAddress.AccountConfiguration.ScriptType()),
			},
		}, typedAddress, nil
	default:
		return "", nil, nil, errp.New("Unsupported swap destination address type")
	}
}

func swapSourceAddress(account accounts.Interface) (string, error) {
	switch typedAccount := account.(type) {
	case *btc.Account:
		spendableOutputs, err := typedAccount.SpendableOutputs()
		if err != nil {
			return "", err
		}
		for _, output := range spendableOutputs {
			if output.Address != nil {
				return output.Address.EncodeForHumans(), nil
			}
		}
		address, err := firstUnusedAddress(typedAccount)
		if err != nil {
			return "", err
		}
		return address.EncodeForHumans(), nil
	case *eth.Account:
		address, err := firstUnusedAddress(typedAccount)
		if err != nil {
			return "", err
		}
		return address.EncodeForHumans(), nil
	default:
		return "", errp.New("Unsupported swap source account")
	}
}
