// SPDX-License-Identifier: Apache-2.0

package handlers

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/errors"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/types"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/util"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/etherscan"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/keystore"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/signing"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/config"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/BitBoxSwiss/bitbox02-api-go/api/firmware"
	"github.com/btcsuite/btcd/btcutil"
	"github.com/btcsuite/btcd/wire"
	"github.com/gorilla/mux"
	"github.com/sirupsen/logrus"
)

// Handlers provides a web api to the account.
type Handlers struct {
	account accounts.Interface
	log     *logrus.Entry
}

// NewHandlers creates a new Handlers instance.
func NewHandlers(
	handleFunc func(string, func(*http.Request) (interface{}, error)) *mux.Route, log *logrus.Entry) *Handlers {
	handlers := &Handlers{log: log}

	handleFunc("/init", handlers.postInit).Methods("POST")
	handleFunc("/status", handlers.getAccountStatus).Methods("GET")
	handleFunc("/transactions", handlers.ensureAccountInitialized(handlers.getAccountTransactions)).Methods("GET")
	handleFunc("/transaction", handlers.ensureAccountInitialized(handlers.getAccountTransaction)).Methods("GET")
	handleFunc("/export", handlers.ensureAccountInitialized(handlers.postExportTransactions)).Methods("POST")
	handleFunc("/info", handlers.ensureAccountInitialized(handlers.getAccountInfo)).Methods("GET")
	handleFunc("/utxos", handlers.ensureAccountInitialized(handlers.getUTXOs)).Methods("GET")
	handleFunc("/balance", handlers.ensureAccountInitialized(handlers.getAccountBalance)).Methods("GET")
	handleFunc("/sendtx", handlers.ensureAccountInitialized(handlers.postAccountSendTx)).Methods("POST")
	handleFunc("/fee-targets", handlers.ensureAccountInitialized(handlers.getAccountFeeTargets)).Methods("GET")
	handleFunc("/tx-proposal", handlers.ensureAccountInitialized(handlers.postAccountTxProposal)).Methods("POST")
	handleFunc("/receive-addresses", handlers.ensureAccountInitialized(handlers.getReceiveAddresses)).Methods("GET")
	handleFunc("/used-addresses", handlers.ensureAccountInitialized(handlers.getUsedAddresses)).Methods("GET")
	handleFunc("/verify-address", handlers.ensureAccountInitialized(handlers.postVerifyAddress)).Methods("POST")
	handleFunc("/verify-extended-public-key", handlers.ensureAccountInitialized(handlers.postVerifyExtendedPublicKey)).Methods("POST")
	handleFunc("/sign-address", handlers.ensureAccountInitialized(handlers.postSignBTCAddress)).Methods("POST")
	handleFunc("/has-secure-output", handlers.ensureAccountInitialized(handlers.getHasSecureOutput)).Methods("GET")
	handleFunc("/has-payment-request", handlers.ensureAccountInitialized(handlers.getHasPaymentRequest)).Methods("GET")
	handleFunc("/notes/tx", handlers.ensureAccountInitialized(handlers.postSetTxNote)).Methods("POST")
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
	VSize        int64                               `json:"vsize"`
	Size         int64                               `json:"size"`
	Weight       int64                               `json:"weight"`
	FeeRatePerKb coin.FormattedAmountWithConversions `json:"feeRatePerKb"`

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
			feeRatePerKb := txInfo.FeeRatePerKb
			if feeRatePerKb != nil {
				txInfoJSON.FeeRatePerKb = coin.ConvertBTCAmount(handlers.account.Coin(), *feeRatePerKb, true, accountConfig.RateUpdater)
			}
		case *eth.Coin:
			txInfoJSON.Gas = txInfo.Gas
			txInfoJSON.Nonce = txInfo.Nonce
		}
	}
	return txInfoJSON
}

func (handlers *Handlers) getAccountTransactions(*http.Request) (interface{}, error) {
	var result struct {
		Success      bool          `json:"success"`
		Transactions []Transaction `json:"list"`
	}
	txs, err := handlers.account.Transactions()
	if err != nil {
		return result, nil
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
	return result, nil
}

func (handlers *Handlers) getAccountTransaction(r *http.Request) (interface{}, error) {
	internalID := r.URL.Query().Get("id")
	txs, err := handlers.account.Transactions()
	if err != nil {
		return nil, err
	}
	for _, txInfo := range txs {
		if txInfo.InternalID != internalID {
			continue
		}

		return handlers.getTxInfoJSON(txInfo, true), nil
	}
	return nil, nil
}

func (handlers *Handlers) postExportTransactions(*http.Request) (interface{}, error) {
	type result struct {
		Success      bool   `json:"success"`
		ErrorMessage string `json:"errorMessage"`
	}
	name := fmt.Sprintf("%s-%s-export.csv", time.Now().Format("2006-01-02-at-15-04-05"), handlers.account.Config().Config.Code)
	exportsDir, err := config.ExportsDir()
	if err != nil {
		handlers.log.WithError(err).Error("error exporting account")
		return result{Success: false, ErrorMessage: err.Error()}, nil
	}
	suggestedPath := filepath.Join(exportsDir, name)
	path := handlers.account.Config().GetSaveFilename(suggestedPath)
	if path == "" {
		return nil, nil
	}
	handlers.log.Infof("Export transactions to %s.", path)

	transactions, err := handlers.account.Transactions()
	if err != nil {
		handlers.log.WithError(err).Error("error getting the transactions")
		return result{Success: false, ErrorMessage: err.Error()}, nil
	}

	file, err := os.Create(path)
	if err != nil {
		handlers.log.WithError(err).Error("error creating file")
		return result{Success: false, ErrorMessage: err.Error()}, nil
	}
	if err := handlers.account.ExportCSV(file, transactions); err != nil {
		_ = file.Close()
		handlers.log.WithError(err).Error("error writing file")
		return result{Success: false, ErrorMessage: err.Error()}, nil
	}
	if err := file.Close(); err != nil {
		handlers.log.WithError(err).Error("error closing file")
		return result{Success: false, ErrorMessage: err.Error()}, nil
	}
	if err := handlers.account.Config().UnsafeSystemOpen(path); err != nil {
		handlers.log.WithError(err).Error("error opening file")
		return result{Success: false, ErrorMessage: err.Error()}, nil
	}
	return result{Success: true}, nil
}

func (handlers *Handlers) getAccountInfo(*http.Request) (interface{}, error) {
	return handlers.account.Info(), nil
}

func (handlers *Handlers) getUTXOs(*http.Request) (interface{}, error) {
	accountConfig := handlers.account.Config()
	result := []map[string]interface{}{}

	t, ok := handlers.account.(*btc.Account)

	if !ok {
		return result, errp.New("Interface must be of type btc.Account")
	}

	addressCounts := make(map[string]int)

	spendableOutputs, err := t.SpendableOutputs()
	if err != nil {
		return nil, err
	}

	for _, output := range spendableOutputs {
		address := output.Address.EncodeForHumans()
		addressCounts[address]++
	}

	spendableOutputs, err = t.SpendableOutputs()
	if err != nil {
		return nil, err
	}

	for _, output := range spendableOutputs {
		address := output.Address.EncodeForHumans()
		addressReused := addressCounts[address] > 1
		var formattedTime *string
		timestamp := output.HeaderTimestamp
		if timestamp != nil {
			t := timestamp.Format(time.RFC3339)
			formattedTime = &t
		}
		result = append(result,
			map[string]interface{}{
				"outPoint":        output.OutPoint.String(),
				"txId":            output.OutPoint.Hash.String(),
				"txOutput":        output.OutPoint.Index,
				"amount":          coin.ConvertBTCAmount(handlers.account.Coin(), btcutil.Amount(output.TxOut.Value), false, accountConfig.RateUpdater),
				"address":         address,
				"scriptType":      output.Address.AccountConfiguration.ScriptType(),
				"note":            handlers.account.TxNote(output.OutPoint.Hash.String()),
				"addressReused":   addressReused,
				"isChange":        output.IsChange,
				"headerTimestamp": formattedTime,
			})
	}

	return result, nil
}

func (handlers *Handlers) getAccountBalance(*http.Request) (interface{}, error) {
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
		return result{Success: false}, nil
	}
	return result{
		Success: true,
		Balance: balance{
			HasAvailable: accountBalance.Available().BigInt().Sign() > 0,
			Available:    accountBalance.Available().FormatWithConversions(handlers.account.Coin(), false, accountConfig.RateUpdater),
			HasIncoming:  accountBalance.Incoming().BigInt().Sign() > 0,
			Incoming:     accountBalance.Incoming().FormatWithConversions(handlers.account.Coin(), false, accountConfig.RateUpdater),
		},
	}, nil
}

type slip24Request struct {
	RecipientName string `json:"recipientName"`
	Nonce         string `json:"nonce"`
	Memos         []struct {
		Type string `json:"type"`
		Text string `json:"text"`
	} `json:"memos"`
	Outputs []struct {
		Amount  uint64 `json:"amount"`
		Address string `json:"address"`
	} `json:"outputs"`
	Signature string `json:"signature"`
}

func (slip24 slip24Request) toPaymentRequest() (*accounts.PaymentRequest, error) {
	if len(slip24.Outputs) != 1 {
		return nil, errp.New("Missing or multiple payment request output unsupported")
	}

	if len(slip24.Nonce) > 0 {
		return nil, errp.New("Nonce value unsupported")
	}

	sigBytes, err := base64.StdEncoding.DecodeString(slip24.Signature)
	if err != nil {
		return nil, err
	}

	memos := []accounts.TextMemo{}
	for _, memo := range slip24.Memos {
		if memo.Type != "text" {
			return nil, errp.New("Payment request non-text memo unsupported")
		}
		memos = append(memos, accounts.TextMemo{Note: memo.Text})
	}

	return &accounts.PaymentRequest{
		RecipientName: slip24.RecipientName,
		Nonce:         nil,
		Signature:     sigBytes,
		TotalAmount:   slip24.Outputs[0].Amount,
		Memos:         memos,
	}, nil
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
		CustomFee      string         `json:"customFee"`
		Amount         string         `json:"amount"`
		SelectedUTXOS  []string       `json:"selectedUTXOS"`
		Note           string         `json:"note"`
		Counter        int            `json:"counter"`
		PaymentRequest *slip24Request `json:"paymentRequest"`
		UseHighestFee  bool           `json:"useHighestFee"`
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
		paymentRequest, err := jsonBody.PaymentRequest.toPaymentRequest()
		if err != nil {
			return err
		}
		input.PaymentRequest = paymentRequest
	}
	input.UseHighestFee = jsonBody.UseHighestFee
	return nil
}

func (handlers *Handlers) postAccountSendTx(r *http.Request) (interface{}, error) {
	var txNote string
	if err := json.NewDecoder(r.Body).Decode(&txNote); err != nil {
		// In case unmarshaling of the tx. note fails for some reason we do not want to abort send
		// because the tx. note is not critical for its functionality/correctness. This is why we do
		// not return but only log an error here.
		handlers.log.WithError(err).Error("Failed to unmarshal transaction note")
	}
	txID, err := handlers.account.SendTx(txNote)
	if errp.Cause(err) == keystore.ErrSigningAborted || errp.Cause(err) == errp.ErrUserAbort {
		return map[string]interface{}{"success": false, "aborted": true}, nil
	}
	if err != nil {
		handlers.log.WithError(err).Error("Failed to send transaction")
		result := map[string]interface{}{"success": false, "errorMessage": err.Error()}
		if strings.Contains(err.Error(), etherscan.ERC20GasErr) {
			result["errorCode"] = errors.ERC20InsufficientGasFunds.Error()
		}
		return result, nil
	}
	return map[string]interface{}{"success": true, "txId": txID}, nil
}

func txProposalError(err error) (interface{}, error) {
	if validationErr, ok := errp.Cause(err).(errors.TxValidationError); ok {
		return map[string]interface{}{
			"success":   false,
			"errorCode": validationErr.Error(),
		}, nil
	}
	return nil, errp.WithMessage(err, "Failed to create transaction proposal")
}

func (handlers *Handlers) postAccountTxProposal(r *http.Request) (interface{}, error) {
	accountConfig := handlers.account.Config()
	var input sendTxInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		return txProposalError(errp.WithStack(err))
	}
	outputAmount, fee, total, err := handlers.account.TxProposal(&input.TxProposalArgs)
	if err != nil {
		return txProposalError(err)
	}
	return map[string]interface{}{
		"success": true,
		"amount":  outputAmount.FormatWithConversions(handlers.account.Coin(), false, accountConfig.RateUpdater),
		"fee":     fee.FormatWithConversions(handlers.account.Coin(), true, accountConfig.RateUpdater),
		"total":   total.FormatWithConversions(handlers.account.Coin(), false, accountConfig.RateUpdater),
	}, nil
}

func (handlers *Handlers) getAccountFeeTargets(*http.Request) (interface{}, error) {
	type jsonFeeTarget struct {
		Code        accounts.FeeTargetCode `json:"code"`
		FeeRateInfo string                 `json:"feeRateInfo"`
	}

	feeTargets, defaultFeeTarget := handlers.account.FeeTargets()
	result := []jsonFeeTarget{}
	for _, feeTarget := range feeTargets {
		result = append(result, jsonFeeTarget{
			Code:        feeTarget.Code(),
			FeeRateInfo: feeTarget.FormattedFeeRate(),
		})
	}
	return map[string]interface{}{
		"feeTargets":       result,
		"defaultFeeTarget": defaultFeeTarget,
	}, nil
}

func (handlers *Handlers) postInit(*http.Request) (interface{}, error) {
	if handlers.account == nil {
		return nil, errp.New("/init called even though account was not added yet")
	}
	return nil, handlers.account.Initialize()
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

func (handlers *Handlers) getAccountStatus(*http.Request) (interface{}, error) {
	if handlers.account == nil {
		return statusResponse{Disabled: true}, nil
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
	}, nil
}

func (handlers *Handlers) getReceiveAddresses(*http.Request) (interface{}, error) {

	type jsonAddress struct {
		Address   string `json:"address"`
		AddressID string `json:"addressID"`
	}
	type jsonAddressList struct {
		ScriptType *signing.ScriptType `json:"scriptType"`
		Addresses  []jsonAddress       `json:"addresses"`
	}
	addressList := []jsonAddressList{}
	unusedAddressList, err := handlers.account.GetUnusedReceiveAddresses()
	if err != nil {
		return nil, err
	}
	for _, addresses := range unusedAddressList {
		addrs := []jsonAddress{}
		for _, address := range addresses.Addresses {
			addrs = append(addrs, jsonAddress{
				Address:   address.EncodeForHumans(),
				AddressID: address.ID(),
			})
		}
		addressList = append(addressList, jsonAddressList{
			ScriptType: addresses.ScriptType,
			Addresses:  addrs,
		})
	}
	return addressList, nil
}

func (handlers *Handlers) getUsedAddresses(*http.Request) (interface{}, error) {
	type jsonUsedAddress struct {
		Address          string              `json:"address"`
		AddressID        string              `json:"addressID"`
		ScriptType       *signing.ScriptType `json:"scriptType"`
		TransactionCount int                 `json:"transactionCount"`
	}
	type response struct {
		Success   bool              `json:"success"`
		Addresses []jsonUsedAddress `json:"addresses"`
	}

	btcAccount, ok := handlers.account.(*btc.Account)
	if !ok {
		return response{Success: false}, nil
	}

	usedAddresses, err := btcAccount.GetUsedReceiveAddresses()
	if err != nil {
		// Return success: false instead of error to avoid breaking the frontend
		return response{Success: false}, nil
	}

	result := make([]jsonUsedAddress, len(usedAddresses))
	for i, addr := range usedAddresses {
		result[i] = jsonUsedAddress{
			Address:          addr.Address,
			AddressID:        addr.AddressID,
			ScriptType:       addr.ScriptType,
			TransactionCount: addr.TransactionCount,
		}
	}

	return response{Success: true, Addresses: result}, nil
}

func (handlers *Handlers) postVerifyAddress(r *http.Request) (interface{}, error) {
	var addressID string
	if err := json.NewDecoder(r.Body).Decode(&addressID); err != nil {
		return nil, errp.WithStack(err)
	}
	return handlers.account.VerifyAddress(addressID)
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
	if errp.Cause(err) == context.Canceled {
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

func (handlers *Handlers) getHasSecureOutput(r *http.Request) (interface{}, error) {
	hasSecureOutput, optional, err := handlers.account.CanVerifyAddresses()
	if err != nil {
		return nil, err
	}
	return map[string]interface{}{
		"hasSecureOutput": hasSecureOutput,
		"optional":        optional,
	}, nil
}

func (handlers *Handlers) postSetTxNote(r *http.Request) (interface{}, error) {
	var args struct {
		InternalTxID string `json:"internalTxID"`
		Note         string `json:"note"`
	}
	if err := json.NewDecoder(r.Body).Decode(&args); err != nil {
		return nil, errp.WithStack(err)
	}

	return nil, handlers.account.SetTxNote(args.InternalTxID, args.Note)
}

type signingResponse struct {
	Success      bool   `json:"success"`
	Signature    string `json:"signature"`
	Aborted      bool   `json:"aborted"`
	ErrorMessage string `json:"errorMessage"`
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
	if errp.Cause(err) == keystore.ErrSigningAborted || errp.Cause(err) == errp.ErrUserAbort {
		return signingResponse{Success: false, Aborted: true}, nil
	}
	if err != nil {
		handlers.log.WithError(err).Error("Failed to sign message")
		result := signingResponse{Success: false, ErrorMessage: err.Error()}
		return result, nil
	}
	return signingResponse{
		Success:   true,
		Signature: signature,
	}, nil
}

func (handlers *Handlers) postEthSignTypedMsg(r *http.Request) (interface{}, error) {
	var args struct {
		ChainId uint64 `json:"chainId"`
		Data    string `json:"data"`
	}
	if err := json.NewDecoder(r.Body).Decode(&args); err != nil {
		return signingResponse{Success: false, ErrorMessage: err.Error()}, nil
	}
	ethAccount, ok := handlers.account.(*eth.Account)
	if !ok {
		return signingResponse{Success: false, ErrorMessage: "Must be an ETH based account"}, nil
	}
	signature, err := ethAccount.SignTypedMsg(args.ChainId, args.Data)
	if errp.Cause(err) == keystore.ErrSigningAborted || errp.Cause(err) == errp.ErrUserAbort {
		return signingResponse{Success: false, Aborted: true}, nil
	}
	if err != nil {
		handlers.log.WithError(err).Error("Failed to sign typed data")
		result := signingResponse{Success: false, ErrorMessage: err.Error()}
		return result, nil
	}
	return signingResponse{
		Success:   true,
		Signature: signature,
	}, nil
}

// For handling dapp transaction requests through Wallet Connect which can either request tx sign or tx send
// The `json:"send"` bool specifies whether a tx should be only signed (return signature) or signed and broadcast (return tx hash)
// ChainId is needed to allow signing all supported EVM networks via the BBApp.
func (handlers *Handlers) postEthSignWalletConnectTx(r *http.Request) (interface{}, error) {
	var args struct {
		Send    bool                  `json:"send"`
		ChainId uint64                `json:"chainId"`
		Tx      eth.WalletConnectArgs `json:"tx"`
	}
	type response struct {
		Success bool   `json:"success"`
		RawTx   string `json:"rawTx"`
		TxHash  string `json:"txHash"`
	}
	if err := json.NewDecoder(r.Body).Decode(&args); err != nil {
		return signingResponse{Success: false, ErrorMessage: err.Error()}, nil
	}
	ethAccount, ok := handlers.account.(*eth.Account)
	if !ok {
		return signingResponse{Success: false, ErrorMessage: "Must be an ETH based account"}, nil
	}
	txHash, rawTx, err := ethAccount.EthSignWalletConnectTx(args.Send, args.ChainId, args.Tx)
	if errp.Cause(err) == keystore.ErrSigningAborted || errp.Cause(err) == errp.ErrUserAbort {
		return signingResponse{Success: false, Aborted: true}, nil
	}
	if err != nil {
		handlers.log.WithError(err).Error("Failed to send transaction")
		result := signingResponse{Success: false, ErrorMessage: err.Error()}
		return result, nil
	}
	return response{
		Success: true,
		RawTx:   rawTx,
		TxHash:  txHash,
	}, nil
}

func (handlers *Handlers) postSignBTCAddress(r *http.Request) (interface{}, error) {
	type response struct {
		Success      bool   `json:"success"`
		Address      string `json:"address"`
		Signature    string `json:"signature"`
		ErrorMessage string `json:"errorMessage,omitempty"`
		ErrorCode    string `json:"errorCode,omitempty"`
	}

	var request struct {
		AccountCode types.Code         `json:"accountCode"`
		AddressID   string             `json:"addressID"`
		Msg         string             `json:"msg"`
		Format      signing.ScriptType `json:"format"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		return response{Success: false, ErrorMessage: err.Error()}, nil
	}

	var address, signature string
	var err error

	// Handle ETH accounts
	if ethAccount, ok := handlers.account.(*eth.Account); ok {
		address, signature, err = ethAccount.SignETHMessage(request.Msg)
	} else if btcAccount, ok := handlers.account.(*btc.Account); ok {
		// Handle BTC/LTC accounts - use addressID if provided, otherwise fall back to old behavior
		if request.AddressID != "" {
			address, signature, err = btcAccount.SignBTCMessage(request.AddressID, request.Msg)
		} else {
			address, signature, err = btc.SignBTCAddress(btcAccount, request.Msg, request.Format)
		}
	} else {
		return response{
			Success:      false,
			ErrorMessage: "Account type not supported for message signing.",
		}, nil
	}

	if err != nil {
		if firmware.IsErrorAbort(err) {
			return response{Success: false, ErrorCode: errp.ErrUserAbort.Error()}, nil
		}
		if errp.Cause(err) == backend.ErrWrongKeystore {
			return response{Success: false, ErrorCode: backend.ErrWrongKeystore.Error()}, nil
		}
		if errp.Cause(err) == keystore.ErrSigningAborted {
			return response{Success: false, ErrorCode: errp.ErrUserAbort.Error()}, nil
		}

		handlers.log.WithField("code", handlers.account.Config().Config.Code).Error(err)
		return response{Success: false, ErrorMessage: err.Error()}, nil
	}
	return response{Success: true, Address: address, Signature: signature}, nil
}

func (handlers *Handlers) getHasPaymentRequest(r *http.Request) (interface{}, error) {
	type response struct {
		Success      bool   `json:"success"`
		ErrorMessage string `json:"errorMessage,omitempty"`
		ErrorCode    string `json:"errorCode,omitempty"`
	}

	account, ok := handlers.account.(*btc.Account)
	if !ok {
		return response{
			Success:      false,
			ErrorMessage: "An account must be BTC based to support payment requests.",
		}, nil
	}

	keystore, err := account.Config().ConnectKeystore()
	if err != nil {
		return response{Success: false, ErrorMessage: err.Error()}, nil
	}
	err = keystore.SupportsPaymentRequests()
	if err != nil {
		return response{Success: false, ErrorCode: err.Error()}, nil
	}

	return response{Success: true}, nil
}
