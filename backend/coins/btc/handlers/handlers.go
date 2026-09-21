// SPDX-License-Identifier: Apache-2.0

package handlers

import (
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/errors"
	accountsTypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/types"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/util"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/etherscan"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/keystore"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/paymentrequest"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/signing"
	backendutil "github.com/BitBoxSwiss/bitbox-wallet-app/backend/util"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/config"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/btcsuite/btcd/btcutil/v2"
	"github.com/btcsuite/btcd/chaincfg/v2"
	"github.com/btcsuite/btcd/wire/v2"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/gorilla/mux"
	"github.com/sirupsen/logrus"
)

// Handlers provides a web api to the account.
type Handlers struct {
	account                      accounts.Interface
	log                          *logrus.Entry
	signWalletConnectTransaction func(accountsTypes.Code, eth.SignTransactionArgs) (*types.Transaction, error)
}

func formatAddressForDisplay(account accounts.Interface, address string) string {
	return backendutil.FormatAddress(account.Coin().Code(), address)
}

func isFirmwareUpgradeRequired(err error) bool {
	return errp.Cause(err) == keystore.ErrFirmwareUpgradeRequired
}

// NewHandlers creates a new Handlers instance.
func NewHandlers(
	handleFunc func(string, func(*http.Request) (interface{}, error)) *mux.Route,
	log *logrus.Entry,
	signWalletConnectTransaction func(accountsTypes.Code, eth.SignTransactionArgs) (*types.Transaction, error),
) *Handlers {
	handlers := &Handlers{log: log, signWalletConnectTransaction: signWalletConnectTransaction}

	withError := func(handler func(*http.Request) interface{}) func(*http.Request) (interface{}, error) {
		return func(request *http.Request) (interface{}, error) {
			return handler(request), nil
		}
	}

	handleFunc("/init", withError(handlers.postInit)).Methods("POST")
	handleFunc("/status", withError(handlers.getAccountStatus)).Methods("GET")
	handleFunc("/transactions", handlers.ensureAccountInitialized(withError(handlers.getAccountTransactions))).Methods("GET")
	handleFunc("/transaction", handlers.ensureAccountInitialized(withError(handlers.getAccountTransaction))).Methods("GET")
	handleFunc("/export", handlers.ensureAccountInitialized(withError(handlers.postExportTransactions))).Methods("POST")
	handleFunc("/info", handlers.ensureAccountInitialized(withError(handlers.getAccountInfo))).Methods("GET")
	handleFunc("/utxos", handlers.ensureAccountInitialized(withError(handlers.getUTXOs))).Methods("GET")
	handleFunc("/balance", handlers.ensureAccountInitialized(withError(handlers.getAccountBalance))).Methods("GET")
	handleFunc("/sendtx", handlers.ensureAccountInitialized(withError(handlers.postAccountSendTx))).Methods("POST")
	handleFunc("/fee-targets", handlers.ensureAccountInitialized(withError(handlers.getAccountFeeTargets))).Methods("GET")
	handleFunc("/tx-proposal", handlers.ensureAccountInitialized(withError(handlers.postAccountTxProposal))).Methods("POST")
	handleFunc("/receive-addresses", handlers.ensureAccountInitialized(withError(handlers.getReceiveAddresses))).Methods("GET")
	handleFunc("/used-addresses", handlers.ensureAccountInitialized(withError(handlers.getUsedAddresses))).Methods("GET")
	handleFunc("/verify-address", handlers.ensureAccountInitialized(handlers.postVerifyAddress)).Methods("POST")
	handleFunc("/verify-extended-public-key", handlers.ensureAccountInitialized(handlers.postVerifyExtendedPublicKey)).Methods("POST")
	handleFunc("/btc-sign-message-unused-address", handlers.ensureAccountInitialized(handlers.postSignBTCMessageUnusedAddress)).Methods("POST")
	handleFunc("/btc-sign-message-for-address", handlers.ensureAccountInitialized(handlers.postSignBTCMessageForAddress)).Methods("POST")
	handleFunc("/eth-sign-message-for-address", handlers.ensureAccountInitialized(handlers.postSignETHMessageForAddress)).Methods("POST")
	handleFunc("/has-secure-output", handlers.ensureAccountInitialized(withError(handlers.getHasSecureOutput))).Methods("GET")
	handleFunc("/notes/tx", handlers.ensureAccountInitialized(withError(handlers.postSetTxNote))).Methods("POST")
	handleFunc("/eth-sign-msg", handlers.ensureAccountInitialized(handlers.postEthSignMsg)).Methods("POST")
	handleFunc("/eth-sign-typed-msg", handlers.ensureAccountInitialized(handlers.postEthSignTypedMsg)).Methods("POST")
	handleFunc("/eth-sign-wallet-connect-tx", handlers.ensureAccountInitialized(handlers.postEthSignWalletConnectTx)).Methods("POST")
	return handlers
}

// Init installs a account as a base for the web api. This needs to be called before any requests are
// made.
func (handlers *Handlers) Init(account accounts.Interface) {
	handlers.account = account
}

// Uninit removes the account. After this, no requests should be made.
func (handlers *Handlers) Uninit() {
	handlers.account = nil
}

// Transaction is the info returned per transaction by the /transactions and /transaction endpoint.
type Transaction struct {
	TxID                     string                              `json:"txID"`
	InternalID               string                              `json:"internalID"`
	NumConfirmations         int                                 `json:"numConfirmations"`
	NumConfirmationsComplete int                                 `json:"numConfirmationsComplete"`
	Type                     string                              `json:"type"`
	Status                   accounts.TxStatus                   `json:"status"`
	Amount                   coin.FormattedAmountWithConversions `json:"amount"`
	AmountAtTime             coin.FormattedAmountWithConversions `json:"amountAtTime"`
	DeductedAmountAtTime     coin.FormattedAmountWithConversions `json:"deductedAmountAtTime"`
	Fee                      coin.FormattedAmountWithConversions `json:"fee"`
	Time                     *string                             `json:"time"`
	Addresses                []string                            `json:"addresses"`
	Note                     string                              `json:"note"`

	// BTC specific fields.
	VSize       int64  `json:"vsize"`
	Size        int64  `json:"size"`
	Weight      int64  `json:"weight"`
	FeeRateInfo string `json:"feeRateInfo"`

	// ETH specific fields
	Gas   uint64  `json:"gas"`
	Nonce *uint64 `json:"nonce"`
}

func (handlers *Handlers) ensureAccountInitialized(h func(*http.Request) (interface{}, error)) func(*http.Request) (interface{}, error) {
	return func(request *http.Request) (interface{}, error) {
		if handlers.account == nil {
			return nil, errp.New("Account was uninitialized. Cannot handle request.")
		}
		return h(request)
	}
}

// getTxInfoJSON encodes a given transaction in JSON.
// If `detail` is false, Coin related details, fees and historical fiat amount won't be included.
func (handlers *Handlers) getTxInfoJSON(txInfo *accounts.TransactionData, detail bool) Transaction {
	accountConfig := handlers.account.Config()
	var feeString coin.FormattedAmountWithConversions
	if txInfo.Fee != nil {
		feeString = txInfo.Fee.FormatWithConversions(handlers.account.Coin(), true, accountConfig.RateUpdater)
	}
	amount := txInfo.Amount.FormatWithConversions(handlers.account.Coin(), false, accountConfig.RateUpdater)
	var formattedTime *string
	timestamp := txInfo.Timestamp

	deductedAmountAtTime := txInfo.DeductedAmount.FormatWithConversionsAtTime(handlers.account.Coin(), timestamp, accountConfig.RateUpdater)
	amountAtTime := txInfo.Amount.FormatWithConversionsAtTime(handlers.account.Coin(), timestamp, accountConfig.RateUpdater)

	if timestamp != nil {
		t := timestamp.Format(time.RFC3339)
		formattedTime = &t
	}

	addresses := []string{}
	for _, addressAndAmount := range txInfo.Addresses {
		addresses = append(addresses, addressAndAmount.Address)
	}
	txInfoJSON := Transaction{
		TxID:                     txInfo.TxID,
		InternalID:               txInfo.InternalID,
		NumConfirmations:         txInfo.NumConfirmations,
		NumConfirmationsComplete: txInfo.NumConfirmationsComplete,
		Type: map[accounts.TxType]string{
			accounts.TxTypeReceive:  "receive",
			accounts.TxTypeSend:     "send",
			accounts.TxTypeSendSelf: "send_to_self",
		}[txInfo.Type],
		Status:               txInfo.Status,
		Amount:               amount,
		AmountAtTime:         amountAtTime,
		DeductedAmountAtTime: deductedAmountAtTime,
		Time:                 formattedTime,
		Addresses:            addresses,
		Note:                 handlers.account.TxNote(txInfo.InternalID),
		Fee:                  feeString,
	}

	if detail {
		switch handlers.account.Coin().(type) {
		case *btc.Coin:
			txInfoJSON.VSize = txInfo.VSize
			txInfoJSON.Size = txInfo.Size
			txInfoJSON.Weight = txInfo.Weight
			txInfoJSON.FeeRateInfo = btc.FormatFeeRate(txInfo.FeeRatePerKb)
		case *eth.Coin:
			txInfoJSON.Gas = txInfo.Gas
			txInfoJSON.Nonce = txInfo.Nonce
		}
	}
	return txInfoJSON
}

func (handlers *Handlers) getAccountTransactions(*http.Request) interface{} {
	var result struct {
		Success      bool          `json:"success"`
		Transactions []Transaction `json:"list"`
	}
	txs, err := handlers.account.Transactions()
	if err != nil {
		return result
	}
	result.Transactions = []Transaction{}
	for _, txInfo := range txs {
		if txInfo.IsErc20 && big.NewInt(0).Cmp(txInfo.Amount.BigInt()) == 0 {
			// skipping 0 amount erc20 txs to mitigate Address Poisoning attack
			continue
		}
		result.Transactions = append(result.Transactions, handlers.getTxInfoJSON(txInfo, false))
	}
	result.Success = true
	return result
}

func (handlers *Handlers) getAccountTransaction(r *http.Request) interface{} {
	type result struct {
		Success      bool         `json:"success"`
		Transaction  *Transaction `json:"transaction"`
		ErrorMessage string       `json:"errorMessage,omitempty"`
	}
	internalID := r.URL.Query().Get("id")
	txs, err := handlers.account.Transactions()
	if err != nil {
		return result{Success: false, ErrorMessage: err.Error()}
	}
	for _, txInfo := range txs {
		if txInfo.InternalID != internalID {
			continue
		}

		transaction := handlers.getTxInfoJSON(txInfo, true)
		return result{Success: true, Transaction: &transaction}
	}
	return result{Success: true}
}

func (handlers *Handlers) postExportTransactions(*http.Request) interface{} {
	type result struct {
		Success      bool   `json:"success"`
		ErrorMessage string `json:"errorMessage"`
	}
	name := fmt.Sprintf(
		"%s-%s-export.csv",
		time.Now().Format("2006-01-02-at-15-04-05"),
		handlers.account.Config().Code,
	)
	exportsDir, err := config.ExportsDir()
	if err != nil {
		handlers.log.WithError(err).Error("error exporting account")
		return result{Success: false, ErrorMessage: err.Error()}
	}
	suggestedPath := filepath.Join(exportsDir, name)
	path := handlers.account.Config().GetSaveFilename(suggestedPath)
	if path == "" {
		return nil
	}
	handlers.log.Infof("Export transactions to %s.", path)

	transactions, err := handlers.account.Transactions()
	if err != nil {
		handlers.log.WithError(err).Error("error getting the transactions")
		return result{Success: false, ErrorMessage: err.Error()}
	}

	file, err := os.OpenFile(
		path,
		os.O_WRONLY|os.O_CREATE,
		config.PrivateFileMode,
	)
	if err != nil {
		handlers.log.WithError(err).Error("error creating file")
		return result{Success: false, ErrorMessage: err.Error()}
	}
	if err := config.EnsurePrivateFile(path); err != nil {
		_ = file.Close()
		handlers.log.WithError(err).Error("error restricting file permissions")
		return result{Success: false, ErrorMessage: err.Error()}
	}
	if err := file.Truncate(0); err != nil {
		_ = file.Close()
		handlers.log.WithError(err).Error("error truncating file")
		return result{Success: false, ErrorMessage: err.Error()}
	}
	if err := handlers.account.ExportCSV(file, transactions); err != nil {
		_ = file.Close()
		handlers.log.WithError(err).Error("error writing file")
		return result{Success: false, ErrorMessage: err.Error()}
	}
	if err := file.Close(); err != nil {
		handlers.log.WithError(err).Error("error closing file")
		return result{Success: false, ErrorMessage: err.Error()}
	}
	if err := handlers.account.Config().UnsafeSystemOpen(path); err != nil {
		handlers.log.WithError(err).Error("error opening file")
		return result{Success: false, ErrorMessage: err.Error()}
	}
	return result{Success: true}
}

func (handlers *Handlers) getAccountInfo(*http.Request) interface{} {
	type bitcoinSimpleInfo struct {
		KeyInfo    signing.KeyInfo    `json:"keyInfo"`
		ScriptType signing.ScriptType `json:"scriptType"`
		Descriptor string             `json:"descriptor"`
	}
	type signingConfigurationInfo struct {
		BitcoinSimple  *bitcoinSimpleInfo      `json:"bitcoinSimple,omitempty"`
		EthereumSimple *signing.EthereumSimple `json:"ethereumSimple,omitempty"`
	}
	type accountInfo struct {
		SigningConfigurations []signingConfigurationInfo `json:"signingConfigurations"`
	}
	type response struct {
		Success      bool         `json:"success"`
		Info         *accountInfo `json:"info"`
		ErrorMessage string       `json:"errorMessage,omitempty"`
	}

	info := handlers.account.Info()
	if info == nil {
		return response{Success: true}
	}

	var btcNet *chaincfg.Params
	if btcCoin, ok := handlers.account.Coin().(*btc.Coin); ok {
		btcNet = btcCoin.Net()
	}

	result := accountInfo{
		SigningConfigurations: make([]signingConfigurationInfo, 0, len(info.SigningConfigurations)),
	}
	for _, cfg := range info.SigningConfigurations {
		signingConfig := signingConfigurationInfo{}
		if cfg.BitcoinSimple != nil {
			if btcNet == nil {
				return response{Success: false, ErrorMessage: "bitcoin network unavailable for bitcoin signing config"}
			}
			descriptor, err := cfg.BitcoinSimple.Descriptor(btcNet)
			if err != nil {
				return response{Success: false, ErrorMessage: err.Error()}
			}
			signingConfig.BitcoinSimple = &bitcoinSimpleInfo{
				KeyInfo:    cfg.BitcoinSimple.KeyInfo,
				ScriptType: cfg.BitcoinSimple.ScriptType,
				Descriptor: descriptor,
			}
		}
		if cfg.EthereumSimple != nil {
			signingConfig.EthereumSimple = cfg.EthereumSimple
		}
		result.SigningConfigurations = append(result.SigningConfigurations, signingConfig)
	}
	return response{Success: true, Info: &result}
}

func (handlers *Handlers) getUTXOs(*http.Request) interface{} {
	accountConfig := handlers.account.Config()
	type utxoResponse struct {
		OutPoint        string                              `json:"outPoint"`
		TxID            string                              `json:"txId"`
		TxOutput        uint32                              `json:"txOutput"`
		Amount          coin.FormattedAmountWithConversions `json:"amount"`
		Address         string                              `json:"address"`
		ScriptType      signing.ScriptType                  `json:"scriptType"`
		Note            string                              `json:"note"`
		AddressReused   bool                                `json:"addressReused"`
		IsChange        bool                                `json:"isChange"`
		HeaderTimestamp *string                             `json:"headerTimestamp"`
	}
	type response struct {
		Success      bool           `json:"success"`
		UTXOs        []utxoResponse `json:"utxos"`
		ErrorMessage string         `json:"errorMessage,omitempty"`
	}
	result := []utxoResponse{}

	t, ok := handlers.account.(*btc.Account)

	if !ok {
		return response{Success: false, ErrorMessage: "Interface must be of type btc.Account"}
	}

	spendableOutputs, err := t.SpendableOutputs()
	if err != nil {
		return response{Success: false, ErrorMessage: err.Error()}
	}
	reusedAddresses, err := t.ReusedAddressesForOutputs(spendableOutputs)
	if err != nil {
		return response{Success: false, ErrorMessage: err.Error()}
	}

	for _, output := range spendableOutputs {
		address := output.Address.EncodeForHumans()
		_, addressReused := reusedAddresses[output.Address.PubkeyScriptHashHex()]
		var formattedTime *string
		timestamp := output.HeaderTimestamp
		if timestamp != nil {
			t := timestamp.Format(time.RFC3339)
			formattedTime = &t
		}
		result = append(result,
			utxoResponse{
				OutPoint:        output.OutPoint.String(),
				TxID:            output.OutPoint.Hash.String(),
				TxOutput:        output.OutPoint.Index,
				Amount:          coin.ConvertBTCAmount(handlers.account.Coin(), btcutil.Amount(output.TxOut.Value), false, accountConfig.RateUpdater),
				Address:         address,
				ScriptType:      output.Address.AccountConfiguration.ScriptType(),
				Note:            handlers.account.TxNote(output.OutPoint.Hash.String()),
				AddressReused:   addressReused,
				IsChange:        output.IsChange,
				HeaderTimestamp: formattedTime,
			})
	}

	return response{Success: true, UTXOs: result}
}

func (handlers *Handlers) getAccountBalance(*http.Request) interface{} {
	accountConfig := handlers.account.Config()
	type balance struct {
		HasAvailable bool                                `json:"hasAvailable"`
		Available    coin.FormattedAmountWithConversions `json:"available"`
		HasIncoming  bool                                `json:"hasIncoming"`
		Incoming     coin.FormattedAmountWithConversions `json:"incoming"`
	}

	type result struct {
		Success bool    `json:"success"`
		Balance balance `json:"balance,omitempty"`
	}
	accountBalance, err := handlers.account.Balance()
	if err != nil {
		return result{Success: false}
	}
	return result{
		Success: true,
		Balance: balance{
			HasAvailable: accountBalance.Available().BigInt().Sign() > 0,
			Available:    accountBalance.Available().FormatWithConversions(handlers.account.Coin(), false, accountConfig.RateUpdater),
			HasIncoming:  accountBalance.Incoming().BigInt().Sign() > 0,
			Incoming:     accountBalance.Incoming().FormatWithConversions(handlers.account.Coin(), false, accountConfig.RateUpdater),
		},
	}
}

type sendTxInput struct {
	accounts.TxProposalArgs
}

func (input *sendTxInput) UnmarshalJSON(jsonBytes []byte) error {
	jsonBody := struct {
		Address   string `json:"address"`
		SendAll   string `json:"sendAll"`
		FeeTarget string `json:"feeTarget"`
		// Provided in Sat/vByte for BTC/LTC and in Gwei for ETH.
		CustomFee      string                 `json:"customFee"`
		Amount         string                 `json:"amount"`
		SelectedUTXOS  []string               `json:"selectedUTXOS"`
		Note           string                 `json:"note"`
		Counter        int                    `json:"counter"`
		PaymentRequest *paymentrequest.Slip24 `json:"paymentRequest"`
		UseHighestFee  bool                   `json:"useHighestFee"`
	}{}
	if err := json.Unmarshal(jsonBytes, &jsonBody); err != nil {
		return errp.WithStack(err)
	}
	input.RecipientAddress = jsonBody.Address
	var err error
	input.FeeTargetCode, err = accounts.NewFeeTargetCode(jsonBody.FeeTarget)
	if err != nil {
		return errp.WithMessage(err, "Failed to retrieve fee target code")
	}
	if input.FeeTargetCode == accounts.FeeTargetCodeCustom {
		input.CustomFee = jsonBody.CustomFee
	}
	if jsonBody.SendAll == "yes" {
		input.Amount = coin.NewSendAmountAll()
	} else {
		input.Amount = coin.NewSendAmount(jsonBody.Amount)
	}
	input.SelectedUTXOs = map[wire.OutPoint]struct{}{}
	for _, outPointString := range jsonBody.SelectedUTXOS {
		outPoint, err := util.ParseOutPoint([]byte(outPointString))
		if err != nil {
			return err
		}
		input.SelectedUTXOs[*outPoint] = struct{}{}
	}
	input.Note = jsonBody.Note
	if jsonBody.PaymentRequest != nil {
		paymentRequest, err := jsonBody.PaymentRequest.ToRequest()
		if err != nil {
			return err
		}
		input.PaymentRequest = paymentRequest
	}
	input.UseHighestFee = jsonBody.UseHighestFee
	return nil
}

func (handlers *Handlers) postAccountSendTx(r *http.Request) interface{} {
	type response struct {
		Success      bool   `json:"success"`
		Aborted      bool   `json:"aborted,omitempty"`
		ErrorMessage string `json:"errorMessage,omitempty"`
		ErrorCode    string `json:"errorCode,omitempty"`
		TxID         string `json:"txId,omitempty"`
	}

	var txNote string
	if err := json.NewDecoder(r.Body).Decode(&txNote); err != nil {
		// In case unmarshaling of the tx. note fails for some reason we do not want to abort send
		// because the tx. note is not critical for its functionality/correctness. This is why we do
		// not return but only log an error here.
		handlers.log.WithError(err).Error("Failed to unmarshal transaction note")
	}
	txID, err := handlers.account.SendTx(txNote)
	if errp.Cause(err) == keystore.ErrSigningAborted || errp.Cause(err) == errp.ErrUserAbort {
		return response{Success: false, Aborted: true}
	}
	if err != nil {
		handlers.log.WithError(err).Error("Failed to send transaction")
		result := response{Success: false, ErrorMessage: err.Error()}

		cause := errp.Cause(err)
		if validationErr, ok := cause.(errors.TxValidationError); ok {
			result.ErrorCode = validationErr.Error()
		} else if errCode, ok := cause.(errp.ErrorCode); ok {
			result.ErrorCode = errCode.Error()
		} else if isFirmwareUpgradeRequired(err) {
			result.ErrorCode = keystore.ErrFirmwareUpgradeRequired.Error()
		} else if strings.Contains(err.Error(), etherscan.ERC20GasErr) {
			result.ErrorCode = errors.ErrERC20InsufficientGasFunds.Error()
		}

		return result
	}
	return response{Success: true, TxID: txID}
}

type txProposalResponse struct {
	Success                 bool                                 `json:"success"`
	ErrorCode               string                               `json:"errorCode,omitempty"`
	ErrorMessage            string                               `json:"errorMessage,omitempty"`
	Amount                  *coin.FormattedAmountWithConversions `json:"amount,omitempty"`
	Fee                     *coin.FormattedAmountWithConversions `json:"fee,omitempty"`
	Total                   *coin.FormattedAmountWithConversions `json:"total,omitempty"`
	RecipientDisplayAddress string                               `json:"recipientDisplayAddress,omitempty"`
}

func txProposalError(err error) txProposalResponse {
	if validationErr, ok := errp.Cause(err).(errors.TxValidationError); ok {
		return txProposalResponse{Success: false, ErrorCode: validationErr.Error()}
	}
	return txProposalResponse{Success: false, ErrorMessage: errp.WithMessage(err, "Failed to create transaction proposal").Error()}
}

func (handlers *Handlers) postAccountTxProposal(r *http.Request) interface{} {
	accountConfig := handlers.account.Config()
	var input sendTxInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		return txProposalError(errp.WithStack(err))
	}
	outputAmount, fee, total, err := handlers.account.TxProposal(&input.TxProposalArgs)
	if err != nil {
		return txProposalError(err)
	}
	amountResponse := outputAmount.FormatWithConversions(handlers.account.Coin(), false, accountConfig.RateUpdater)
	feeResponse := fee.FormatWithConversions(handlers.account.Coin(), true, accountConfig.RateUpdater)
	totalResponse := total.FormatWithConversions(handlers.account.Coin(), false, accountConfig.RateUpdater)
	return txProposalResponse{
		Success:                 true,
		Amount:                  &amountResponse,
		Fee:                     &feeResponse,
		Total:                   &totalResponse,
		RecipientDisplayAddress: formatAddressForDisplay(handlers.account, input.RecipientAddress),
	}
}

func (handlers *Handlers) getAccountFeeTargets(*http.Request) interface{} {
	type jsonFeeTarget struct {
		Code        accounts.FeeTargetCode `json:"code"`
		FeeRateInfo string                 `json:"feeRateInfo"`
	}
	type response struct {
		FeeTargets       []jsonFeeTarget        `json:"feeTargets"`
		DefaultFeeTarget accounts.FeeTargetCode `json:"defaultFeeTarget"`
	}

	feeTargets, defaultFeeTarget := handlers.account.FeeTargets()
	result := []jsonFeeTarget{}
	for _, feeTarget := range feeTargets {
		result = append(result, jsonFeeTarget{
			Code:        feeTarget.Code(),
			FeeRateInfo: feeTarget.FormattedFeeRate(),
		})
	}
	return response{
		FeeTargets:       result,
		DefaultFeeTarget: defaultFeeTarget,
	}
}

func (handlers *Handlers) postInit(*http.Request) interface{} {
	type result struct {
		Success      bool   `json:"success"`
		ErrorMessage string `json:"errorMessage,omitempty"`
	}
	if handlers.account == nil {
		return result{Success: false, ErrorMessage: "/init called even though account was not added yet"}
	}
	if err := handlers.account.Initialize(); err != nil {
		return result{Success: false, ErrorMessage: err.Error()}
	}
	return result{Success: true}
}

type statusResponse struct {
	// Disabled indicates that the account has not yet been initialized.
	Disabled bool `json:"disabled"`
	// Synced indicates that the account is synced.
	Synced bool `json:"synced"`
	// Offline indicates that the connection to the blockchain network could not be established.
	OfflineError *string `json:"offlineError"`
	// FatalError indicates that there was a fatal error in handling the account. When this happens,
	// an error is shown to the user and the account is made unusable.
	FatalError bool `json:"fatalError"`
}

func (handlers *Handlers) getAccountStatus(*http.Request) interface{} {
	if handlers.account == nil {
		return statusResponse{Disabled: true}
	}
	offlineErr := handlers.account.Offline()
	var offlineError *string
	if offlineErr != nil {
		s := offlineErr.Error()
		offlineError = &s
	}
	return statusResponse{
		Synced:       handlers.account.Synced(),
		OfflineError: offlineError,
		FatalError:   handlers.account.FatalError(),
	}
}

func (handlers *Handlers) getReceiveAddresses(*http.Request) interface{} {

	type jsonAddress struct {
		Address        string `json:"address"`
		DisplayAddress string `json:"displayAddress"`
		AddressID      string `json:"addressID"`
	}
	type jsonAddressList struct {
		ScriptType *signing.ScriptType `json:"scriptType"`
		Addresses  []jsonAddress       `json:"addresses"`
	}
	type response struct {
		Success      bool              `json:"success"`
		Addresses    []jsonAddressList `json:"addresses"`
		ErrorMessage string            `json:"errorMessage,omitempty"`
	}
	addressList := []jsonAddressList{}
	unusedAddressList, err := handlers.account.GetUnusedReceiveAddresses()
	if err != nil {
		return response{Success: false, ErrorMessage: err.Error()}
	}
	for _, addresses := range unusedAddressList {
		addrs := []jsonAddress{}
		for _, address := range addresses.Addresses {
			addrs = append(addrs, jsonAddress{
				Address:        address.EncodeForHumans(),
				DisplayAddress: formatAddressForDisplay(handlers.account, address.EncodeForHumans()),
				AddressID:      address.ID(),
			})
		}
		addressList = append(addressList, jsonAddressList{
			ScriptType: addresses.ScriptType,
			Addresses:  addrs,
		})
	}
	return response{Success: true, Addresses: addressList}
}

type usedAddressesProvider interface {
	accounts.Interface
	GetUsedAddresses() ([]btc.UsedAddress, error)
}

func (handlers *Handlers) getUsedAddresses(*http.Request) interface{} {
	type jsonUsedAddress struct {
		Address        string              `json:"address"`
		DisplayAddress string              `json:"displayAddress"`
		AddressID      string              `json:"addressID"`
		AddressType    btc.UsedAddressType `json:"addressType"`
		CanSignMsg     bool                `json:"canSignMsg"`
		LastUsed       *string             `json:"lastUsed"`
	}
	type response struct {
		Success   bool              `json:"success"`
		Addresses []jsonUsedAddress `json:"addresses"`
		ErrorCode string            `json:"errorCode,omitempty"`
	}

	btcAccount, ok := handlers.account.(usedAddressesProvider)
	if !ok {
		return response{Success: false, ErrorCode: "notSupported"}
	}

	usedAddresses, err := btcAccount.GetUsedAddresses()
	if err != nil {
		if errp.Cause(err) == accounts.ErrSyncInProgress {
			return response{Success: false, ErrorCode: accounts.ErrSyncInProgress.Error()}
		}
		if handlers.log != nil {
			handlers.log.WithField("code", handlers.account.Config().Code).WithError(err).Error(
				"failed to load used addresses",
			)
		}
		// Return success: false instead of error to avoid breaking the frontend.
		return response{Success: false, ErrorCode: "loadFailed"}
	}

	result := make([]jsonUsedAddress, len(usedAddresses))
	for i, addr := range usedAddresses {
		var lastUsed *string
		if addr.LastUsed != nil {
			formatted := addr.LastUsed.Format(time.RFC3339)
			lastUsed = &formatted
		}
		result[i] = jsonUsedAddress{
			Address:        addr.Address,
			DisplayAddress: backendutil.FormatAddress(handlers.account.Coin().Code(), addr.Address),
			AddressID:      addr.AddressID,
			AddressType:    addr.AddressType,
			CanSignMsg:     addr.CanSignMsg,
			LastUsed:       lastUsed,
		}
	}

	return response{Success: true, Addresses: result}
}

func (handlers *Handlers) postVerifyAddress(r *http.Request) (interface{}, error) {
	type result struct {
		Success      bool   `json:"success"`
		ErrorCode    string `json:"errorCode,omitempty"`
		ErrorMessage string `json:"errorMessage,omitempty"`
	}
	var addressID string
	if err := json.NewDecoder(r.Body).Decode(&addressID); err != nil {
		return result{Success: false, ErrorMessage: err.Error()}, nil
	}
	_, err := handlers.account.VerifyAddress(addressID)
	if isFirmwareUpgradeRequired(err) {
		return result{Success: false, ErrorCode: keystore.ErrFirmwareUpgradeRequired.Error()}, nil
	}
	if err != nil {
		return result{Success: false, ErrorMessage: err.Error()}, nil
	}
	return result{Success: true}, nil
}

func (handlers *Handlers) postVerifyExtendedPublicKey(r *http.Request) (interface{}, error) {
	type result struct {
		Success      bool   `json:"success"`
		ErrorMessage string `json:"errorMessage"`
	}
	var input struct {
		SigningConfigIndex int `json:"signingConfigIndex"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		return result{Success: false, ErrorMessage: err.Error()}, nil
	}
	btcAccount, ok := handlers.account.(*btc.Account)
	if !ok {
		return result{
			Success:      false,
			ErrorMessage: "An account must be BTC based to support xpub verification.",
		}, nil
	}
	canVerify, err := btcAccount.VerifyExtendedPublicKey(input.SigningConfigIndex)
	// User canceled keystore connect prompt - no special action or message needed in the frontend.
	if errp.Cause(err) == errp.ErrUserAbort {
		return result{Success: true}, nil
	}
	if err != nil {
		return result{Success: false, ErrorMessage: err.Error()}, nil
	}
	if !canVerify {
		return result{
			Success:      false,
			ErrorMessage: "This device/keystore does not support verifying xpubs.",
		}, nil
	}
	return result{Success: true}, nil
}

func (handlers *Handlers) getHasSecureOutput(r *http.Request) interface{} {
	type response struct {
		Success         bool   `json:"success"`
		HasSecureOutput bool   `json:"hasSecureOutput"`
		Optional        bool   `json:"optional"`
		ErrorMessage    string `json:"errorMessage,omitempty"`
	}

	hasSecureOutput, optional, err := handlers.account.CanVerifyAddresses()
	if err != nil {
		return response{Success: false, ErrorMessage: err.Error()}
	}
	return response{
		Success:         true,
		HasSecureOutput: hasSecureOutput,
		Optional:        optional,
	}
}

func (handlers *Handlers) postSetTxNote(r *http.Request) interface{} {
	type result struct {
		Success      bool   `json:"success"`
		ErrorMessage string `json:"errorMessage,omitempty"`
	}
	var args struct {
		InternalTxID string `json:"internalTxID"`
		Note         string `json:"note"`
	}
	if err := json.NewDecoder(r.Body).Decode(&args); err != nil {
		return result{Success: false, ErrorMessage: err.Error()}
	}

	if err := handlers.account.SetTxNote(args.InternalTxID, args.Note); err != nil {
		return result{Success: false, ErrorMessage: err.Error()}
	}
	return result{Success: true}
}

type signingResponse struct {
	Success      bool   `json:"success"`
	Signature    string `json:"signature"`
	Aborted      bool   `json:"aborted"`
	ErrorMessage string `json:"errorMessage"`
	ErrorCode    string `json:"errorCode,omitempty"`
}

func newSigningErrorResponse(err error) signingResponse {
	if errp.Cause(err) == keystore.ErrSigningAborted || errp.Cause(err) == errp.ErrUserAbort {
		return signingResponse{Success: false, Aborted: true}
	}
	if isFirmwareUpgradeRequired(err) {
		return signingResponse{
			Success:   false,
			ErrorCode: keystore.ErrFirmwareUpgradeRequired.Error(),
		}
	}
	return signingResponse{Success: false, ErrorMessage: err.Error()}
}

func (handlers *Handlers) postEthSignMsg(r *http.Request) (interface{}, error) {
	var signInput string
	if err := json.NewDecoder(r.Body).Decode(&signInput); err != nil {
		return signingResponse{Success: false, ErrorMessage: err.Error()}, nil
	}
	ethAccount, ok := handlers.account.(*eth.Account)
	if !ok {
		return signingResponse{Success: false, ErrorMessage: "Must be an ETH based account"}, nil
	}
	signature, err := ethAccount.SignMsg(signInput)
	if err != nil {
		result := newSigningErrorResponse(err)
		if !result.Aborted {
			handlers.log.WithError(err).Error("Failed to sign message")
		}
		return result, nil
	}
	return signingResponse{
		Success:   true,
		Signature: signature,
	}, nil
}

func (handlers *Handlers) postEthSignTypedMsg(r *http.Request) (interface{}, error) {
	var args struct {
		ChainId *uint64 `json:"chainId"`
		Data    string  `json:"data"`
	}
	if err := json.NewDecoder(r.Body).Decode(&args); err != nil {
		return signingResponse{Success: false, ErrorMessage: err.Error()}, nil
	}
	if args.ChainId == nil {
		return signingResponse{Success: false, ErrorMessage: "chainId is required"}, nil
	}
	ethAccount, ok := handlers.account.(*eth.Account)
	if !ok {
		return signingResponse{Success: false, ErrorMessage: "Must be an ETH based account"}, nil
	}
	signature, err := eth.SignTypedMsg(*args.ChainId, args.Data,
		ethAccount.Info().SigningConfigurations[0], ethAccount.Config().ConnectKeystore)
	if err != nil {
		result := newSigningErrorResponse(err)
		if !result.Aborted {
			handlers.log.WithError(err).Error("Failed to sign typed data")
		}
		return result, nil
	}
	return signingResponse{
		Success:   true,
		Signature: signature,
	}, nil
}

// postEthSignWalletConnectTx adapts the existing WalletConnect route to generic EVM signing.
func (handlers *Handlers) postEthSignWalletConnectTx(r *http.Request) (interface{}, error) {
	var args struct {
		Send    bool                            `json:"send"`
		ChainID *uint64                         `json:"chainId"`
		Tx      walletConnectTransactionRequest `json:"tx"`
	}
	type response struct {
		Success bool   `json:"success"`
		RawTx   string `json:"rawTx"`
		TxHash  string `json:"txHash"`
	}
	if err := json.NewDecoder(r.Body).Decode(&args); err != nil {
		return signingResponse{Success: false, ErrorMessage: err.Error()}, nil
	}
	if args.ChainID == nil {
		return signingResponse{Success: false, ErrorMessage: "chainId is required"}, nil
	}
	transaction, err := parseWalletConnectTransactionRequest(*args.ChainID, args.Tx)
	if err != nil {
		return signingResponse{Success: false, ErrorMessage: err.Error()}, nil
	}
	signedTx, err := handlers.signWalletConnectTransaction(handlers.account.Config().Code, eth.SignTransactionArgs{
		ChainID:     *args.ChainID,
		Broadcast:   args.Send,
		Transaction: transaction,
	})
	if err != nil {
		result := newSigningErrorResponse(err)
		if !result.Aborted {
			handlers.log.WithError(err).Error("Failed to send transaction")
		}
		return result, nil
	}
	rawTx, err := signedTx.MarshalBinary()
	if err != nil {
		handlers.log.WithError(err).Error("Failed to serialize signed transaction")
		return signingResponse{Success: false, ErrorMessage: err.Error()}, nil
	}
	return response{
		Success: true,
		RawTx:   "0x" + hex.EncodeToString(rawTx),
		TxHash:  signedTx.Hash().Hex(),
	}, nil
}

type signMessageForAddressResponse struct {
	Success        bool   `json:"success"`
	Address        string `json:"address,omitempty"`
	DisplayAddress string `json:"displayAddress,omitempty"`
	Signature      string `json:"signature,omitempty"`
	ErrorMessage   string `json:"errorMessage,omitempty"`
	ErrorCode      string `json:"errorCode,omitempty"`
}

func (handlers *Handlers) signMessageForAddressErrorResponse(err error) signMessageForAddressResponse {
	cause := errp.Cause(err)
	if errCode, ok := cause.(errp.ErrorCode); ok {
		return signMessageForAddressResponse{Success: false, ErrorCode: string(errCode)}
	}
	if isFirmwareUpgradeRequired(err) {
		return signMessageForAddressResponse{
			Success:   false,
			ErrorCode: keystore.ErrFirmwareUpgradeRequired.Error(),
		}
	}
	handlers.log.
		WithField("code", handlers.account.Config().Code).
		WithError(err).
		Error("unexpected error signing message")
	return signMessageForAddressResponse{Success: false, ErrorMessage: "An unexpected error occurred."}
}

func (handlers *Handlers) postSignBTCMessageUnusedAddress(r *http.Request) (interface{}, error) {
	var request struct {
		Msg    string             `json:"msg"`
		Format signing.ScriptType `json:"format"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		return signMessageForAddressResponse{Success: false, ErrorMessage: err.Error()}, nil
	}

	btcAccount, ok := handlers.account.(*btc.Account)
	if !ok {
		return signMessageForAddressResponse{
			Success:      false,
			ErrorMessage: "Must be a BTC based account",
		}, nil
	}

	address, signature, err := btc.SignBTCMessageUnusedAddress(btcAccount, request.Msg, request.Format)
	if err != nil {
		return handlers.signMessageForAddressErrorResponse(err), nil
	}
	return signMessageForAddressResponse{
		Success:        true,
		Address:        address,
		DisplayAddress: backendutil.FormatAddress(handlers.account.Coin().Code(), address),
		Signature:      signature,
	}, nil
}

func (handlers *Handlers) postSignBTCMessageForAddress(r *http.Request) (interface{}, error) {
	var request struct {
		AddressID string `json:"addressID"`
		Msg       string `json:"msg"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		return signMessageForAddressResponse{Success: false, ErrorMessage: err.Error()}, nil
	}

	btcAccount, ok := handlers.account.(*btc.Account)
	if !ok {
		return signMessageForAddressResponse{
			Success:      false,
			ErrorMessage: "Must be a BTC based account",
		}, nil
	}

	address, signature, err := btcAccount.SignBTCMessageForAddress(request.AddressID, request.Msg)
	if err != nil {
		return handlers.signMessageForAddressErrorResponse(err), nil
	}
	return signMessageForAddressResponse{
		Success:        true,
		Address:        address,
		DisplayAddress: backendutil.FormatAddress(handlers.account.Coin().Code(), address),
		Signature:      signature,
	}, nil
}

func (handlers *Handlers) postSignETHMessageForAddress(r *http.Request) (interface{}, error) {
	var request struct {
		Msg string `json:"msg"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		return signMessageForAddressResponse{Success: false, ErrorMessage: err.Error()}, nil
	}

	ethAccount, ok := handlers.account.(*eth.Account)
	if !ok {
		return signMessageForAddressResponse{
			Success:      false,
			ErrorMessage: "Must be an ETH based account",
		}, nil
	}

	address, signature, err := ethAccount.SignETHMessage(request.Msg)
	if err != nil {
		return handlers.signMessageForAddressErrorResponse(err), nil
	}
	return signMessageForAddressResponse{
		Success:        true,
		Address:        address,
		DisplayAddress: backendutil.FormatAddress(handlers.account.Coin().Code(), address),
		Signature:      signature,
	}, nil
}
