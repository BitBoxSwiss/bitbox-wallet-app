// Copyright 2018 Shift Devices AG
// Copyright 2020 Shift Crypto AG
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package eth

import (
	"context"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"os"
	"path"
	"strings"
	"time"

	"github.com/digitalbitbox/bitbox-wallet-app/backend/accounts"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/accounts/errors"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/coin"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/eth/db"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/eth/erc20"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/eth/etherscan"
	ethtypes "github.com/digitalbitbox/bitbox-wallet-app/backend/coins/eth/types"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/signing"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
	"github.com/digitalbitbox/bitbox-wallet-app/util/locker"
	ethereum "github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	ethcommon "github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/sirupsen/logrus"
)

var pollInterval = 5 * time.Minute

// ethGasStationAPIKey is used to access the API of https://ethgasstation.info.
// See https://docs.ethgasstation.info/.
const ethGasStationAPIKey = "3a61bee56f554cc14db4f49e2ace053b3086d3c323aefec83e5ff25ca485"

func isMixedCase(s string) bool {
	return strings.ToLower(s) != s && strings.ToUpper(s) != s
}

// Account is an Ethereum account, with one address.
type Account struct {
	*accounts.BaseAccount

	coin *Coin
	// folder for this specific account. It is a subfolder of dbFolder. Full path.
	dbSubfolder          string
	db                   db.Interface
	signingConfiguration *signing.Configuration
	notifier             accounts.Notifier
	httpClient           *http.Client

	// true when initialized (Initialize() was called).
	initialized     bool
	initializedLock locker.Locker

	// enqueueUpdateCh is used to invoke an account update outside of the regular poll update
	// interval.
	enqueueUpdateCh chan struct{}

	address Address

	// updateLock covers balance, blockNumber, nextNonce, transactions and activeTxProposal.
	updateLock   locker.Locker
	balance      coin.Amount
	blockNumber  *big.Int
	nextNonce    uint64
	transactions []*accounts.TransactionData

	// if not nil, SendTx() will sign and send this transaction. Set by TxProposal().
	activeTxProposal *TxProposal

	quitChan chan struct{}

	log *logrus.Entry
}

// NewAccount creates a new account.
func NewAccount(
	config *accounts.AccountConfig,
	accountCoin *Coin,
	httpClient *http.Client,
	log *logrus.Entry,
) *Account {
	log = log.WithField("group", "eth").
		WithFields(logrus.Fields{"coin": accountCoin.String(), "code": config.Code, "name": config.Name})
	log.Debug("Creating new account")

	account := &Account{
		BaseAccount:          accounts.NewBaseAccount(config, accountCoin, log),
		coin:                 accountCoin,
		dbSubfolder:          "", // set in Initialize()
		signingConfiguration: nil,
		httpClient:           httpClient,
		balance:              coin.NewAmountFromInt64(0),

		enqueueUpdateCh: make(chan struct{}),
		quitChan:        make(chan struct{}),

		log: log,
	}

	return account
}

// Info implements accounts.Interface.
func (account *Account) Info() *accounts.Info {
	return &accounts.Info{
		SigningConfigurations: []*signing.Configuration{account.signingConfiguration},
	}
}

// FilesFolder implements accounts.Interface.
func (account *Account) FilesFolder() string {
	if account.dbSubfolder == "" {
		panic("Initialize() must be run first")
	}
	return account.dbSubfolder
}

func (account *Account) isInitialized() bool {
	defer account.initializedLock.RLock()()
	return account.initialized
}

// Initialize implements accounts.Interface.
func (account *Account) Initialize() error {
	// Early return that does not require a write-lock.
	if account.isInitialized() {
		return nil
	}

	defer account.initializedLock.Lock()()
	if account.initialized {
		return nil
	}
	account.initialized = true

	signingConfigurations := account.Config().SigningConfigurations
	if len(signingConfigurations) != 1 {
		return errp.New("Ethereum only supports one signing config")
	}
	signingConfiguration := signingConfigurations[0]

	account.signingConfiguration = signingConfiguration
	account.notifier = account.Config().GetNotifier(signingConfigurations)

	accountIdentifier := fmt.Sprintf("account-%s", account.Config().Code)
	account.dbSubfolder = path.Join(account.Config().DBFolder, accountIdentifier)
	if err := os.MkdirAll(account.dbSubfolder, 0700); err != nil {
		return errp.WithStack(err)
	}

	dbName := fmt.Sprintf("%s.db", accountIdentifier)
	account.log.Debugf("Opening the database '%s' to persist the transactions.", dbName)
	db, err := db.NewDB(path.Join(account.Config().DBFolder, dbName))
	if err != nil {
		return err
	}
	account.db = db
	account.log.Debugf("Opened the database '%s' to persist the transactions.", dbName)

	account.address = Address{
		Address:         crypto.PubkeyToAddress(*account.signingConfiguration.PublicKey().ToECDSA()),
		absoluteKeypath: account.signingConfiguration.AbsoluteKeypath(),
	}

	account.signingConfiguration = signing.NewEthereumConfiguration(
		account.signingConfiguration.EthereumSimple.KeyInfo.RootFingerprint,
		account.signingConfiguration.AbsoluteKeypath(),
		account.signingConfiguration.ExtendedPublicKey(),
	)

	account.coin.Initialize()
	done := account.Synchronizer.IncRequestsCounter()
	go account.poll(done)

	return account.BaseAccount.Initialize(accountIdentifier)
}

func (account *Account) poll(initDone func()) {
	timer := time.After(0)
	for {
		select {
		case <-account.quitChan:
			return
		default:
			select {
			case <-account.quitChan:
				return
			case <-timer:
			case <-account.enqueueUpdateCh:
				account.log.Info("extraordinary account update invoked")
			}
			if err := account.update(); err != nil {
				account.log.WithError(err).Error("error updating account")
				account.SetOffline(err)
			} else {
				account.SetOffline(nil)
			}
			if initDone != nil {
				initDone()
				initDone = nil
			}
			timer = time.After(pollInterval)
		}
	}
}

// updateOutgoingTransactions updates the height of the stored outgoing transactions.
// We update heights for tx with up to 12 confirmations, so re-orgs are taken into account.
// tipHeight is the current blockchain height.
func (account *Account) updateOutgoingTransactions(tipHeight uint64) {
	defer account.Synchronizer.IncRequestsCounter()()

	dbTx, err := account.db.Begin()
	if err != nil {
		account.log.WithError(err).Error("could not open db")
		return
	}
	defer dbTx.Rollback()

	// Get our stored outgoing transactions.
	outgoingTransactions, err := dbTx.OutgoingTransactions()
	if err != nil {
		account.log.WithError(err).Error("could not get outgoing transactions")
		return
	}

	// Update the stored txs' metadata if up to 12 confirmations.
	for idx, tx := range outgoingTransactions {
		txLog := account.log.WithField("idx", idx)
		remoteTx, err := account.coin.client.TransactionReceiptWithBlockNumber(context.TODO(), tx.Transaction.Hash())
		if remoteTx == nil || err != nil {
			// Transaction not found. This usually happens for pending transactions.
			// In this case, check if the node actually knows about the transaction, and if not, re-broadcast.
			// We do this because it seems that sometimes, a transaction that was broadcast without error still ends up lost.
			_, _, err := account.coin.client.TransactionByHash(context.TODO(), tx.Transaction.Hash())
			if err != nil {
				tx.BroadcastAttempts++
				txLog.WithError(err).Errorf("could not fetch transaction - rebroadcasting, attempt %d", tx.BroadcastAttempts)
				if err := dbTx.PutOutgoingTransaction(tx); err != nil {
					txLog.WithError(err).Error("could not update outgoing tx")
					// Do not abort here, we want to attempt broadcastng the tx in any case.
				}
				if err := account.coin.client.SendTransaction(context.TODO(), tx.Transaction); err != nil {
					txLog.WithError(err).Error("failed to broadcast")
					continue
				}
				txLog.Info("Broadcasting did not return an error")
			}
			continue
		}
		success := remoteTx.Status == types.ReceiptStatusSuccessful
		if tx.Height == 0 || (tipHeight-remoteTx.BlockNumber) < ethtypes.NumConfirmationsComplete || tx.Success != success {
			tx.Height = remoteTx.BlockNumber
			tx.GasUsed = remoteTx.GasUsed
			tx.Success = success
			if err := dbTx.PutOutgoingTransaction(tx); err != nil {
				txLog.WithError(err).Error("could not update outgoing tx")
				continue
			}
		}
	}
	if err := dbTx.Commit(); err != nil {
		account.log.WithError(err).Error("could not commit db tx")
		return
	}
}

// outgoingTransactions gets all locally stored outgoing transactions. It filters out the ones also
// present from the transactions source.
func (account *Account) outgoingTransactions(allTxs []*accounts.TransactionData) (
	[]*ethtypes.TransactionWithMetadata, error) {
	dbTx, err := account.db.Begin()
	if err != nil {
		return nil, err
	}
	defer dbTx.Rollback()
	outgoingTransactions, err := dbTx.OutgoingTransactions()
	if err != nil {
		return nil, err
	}

	allTxHashes := map[string]struct{}{}
	for _, tx := range allTxs {
		allTxHashes[tx.TxID] = struct{}{}
	}

	transactions := []*ethtypes.TransactionWithMetadata{}
	for _, tx := range outgoingTransactions {
		// Skip txs already present from transactions source.
		if _, ok := allTxHashes[tx.TxID()]; ok {
			continue
		}
		transactions = append(transactions, tx)
	}
	return transactions, nil
}

func (account *Account) update() error {
	defer account.updateLock.Lock()()
	defer account.Synchronizer.IncRequestsCounter()()

	blockNumber, err := account.coin.client.BlockNumber(context.TODO())
	if err != nil {
		return errp.WithStack(err)
	}
	account.blockNumber = blockNumber

	transactionsSource := account.coin.TransactionsSource()

	go account.updateOutgoingTransactions(account.blockNumber.Uint64())

	// Get confirmed transactions.
	var confirmedTansactions []*accounts.TransactionData
	if transactionsSource != nil {
		var err error
		confirmedTansactions, err = transactionsSource.Transactions(
			account.blockNumber,
			account.address.Address, account.blockNumber, account.coin.erc20Token)
		if err != nil {
			return err
		}
	}

	// Get our stored outgoing transactions. Filter out all transactions from the transactions
	// source, which should contain all confirmed tx.
	outgoingTransactions, err := account.outgoingTransactions(confirmedTansactions)
	if err != nil {
		return err
	}

	// Nonce to be used for the next tx, fetched from the ETH node. It might be out of date due to
	// latency, which is addressed below by using the locally stored nonce.
	nodeNonce, err := account.coin.client.PendingNonceAt(context.TODO(), account.address.Address)
	if err != nil {
		return err
	}
	account.nextNonce = nodeNonce

	// In case the nodeNonce is not up to date, we fall back to our stored last nonce to compute the
	// next nonce.
	if len(outgoingTransactions) > 0 {
		localNonce := outgoingTransactions[len(outgoingTransactions)-1].Transaction.Nonce() + 1
		if localNonce > account.nextNonce {
			account.nextNonce = localNonce
		}
	}
	outgoingTransactionsData := make([]*accounts.TransactionData, len(outgoingTransactions))
	for i, tx := range outgoingTransactions {
		outgoingTransactionsData[i] = tx.TransactionData(
			account.blockNumber.Uint64(),
			account.coin.erc20Token,
			account.address.Address.Hex(),
		)
	}
	account.transactions = append(outgoingTransactionsData, confirmedTansactions...)
	for _, transaction := range account.transactions {
		if err := account.notifier.Put([]byte(transaction.TxID)); err != nil {
			return err
		}
	}

	if account.coin.erc20Token != nil {
		balance, err := account.coin.client.ERC20Balance(account.address.Address, account.coin.erc20Token)
		if err != nil {
			return errp.WithStack(err)
		}
		account.balance = coin.NewAmount(balance)
	} else {
		balance, err := account.coin.client.Balance(context.TODO(), account.address.Address)
		if err != nil {
			return errp.WithStack(err)
		}
		account.balance = coin.NewAmount(balance)
	}

	return nil
}

// FatalError implements accounts.Interface.
func (account *Account) FatalError() bool {
	return false
}

// Close implements accounts.Interface.
func (account *Account) Close() {
	account.BaseAccount.Close()
	account.log.Info("Waiting to close account")
	account.Synchronizer.WaitSynchronized()
	account.log.Info("Closed account")
	if account.db != nil {
		if err := account.db.Close(); err != nil {
			account.log.WithError(err).Error("couldn't close db")
		}
		account.log.Info("Closed DB")
	}
	close(account.quitChan)
	account.Config().OnEvent(accounts.EventStatusChanged)
}

// Notifier implements accounts.Interface.
func (account *Account) Notifier() accounts.Notifier {
	return account.notifier
}

// Transactions implements accounts.Interface.
func (account *Account) Transactions() (accounts.OrderedTransactions, error) {
	account.Synchronizer.WaitSynchronized()
	return accounts.NewOrderedTransactions(account.transactions), nil
}

// Balance implements accounts.Interface.
func (account *Account) Balance() (*accounts.Balance, error) {
	account.Synchronizer.WaitSynchronized()
	return accounts.NewBalance(account.balance, coin.NewAmountFromInt64(0)), nil
}

// TxProposal holds all info needed to create and sign a transacstion.
type TxProposal struct {
	Coin *Coin
	Tx   *types.Transaction
	Fee  *big.Int
	// Value can be the same as Tx.Value(), but in case of e.g. ERC20, tx.Value() is zero, while the
	// Token value is encoded in the contract input data.
	Value *big.Int
	// Signer contains the sighash algo, which depends on the block number.
	Signer types.Signer
	// KeyPath is the location of this account's address/pubkey/privkey.
	Keypath signing.AbsoluteKeypath
}

func (account *Account) newTx(args *accounts.TxProposalArgs) (*TxProposal, error) {
	if !ethcommon.IsHexAddress(args.RecipientAddress) {
		return nil, errp.WithStack(errors.ErrInvalidAddress)
	}
	address := ethcommon.HexToAddress(args.RecipientAddress)
	// Validate checksum if the address is mixed case, see https://github.com/ethereum/EIPs/blob/master/EIPS/eip-55.md
	if isMixedCase(args.RecipientAddress) && args.RecipientAddress != address.Hex() {
		return nil, errp.WithStack(errors.ErrInvalidAddress)
	}

	suggestedGasPrice, err := account.gasPrice(args)
	if err != nil {
		if _, ok := errp.Cause(err).(errors.TxValidationError); ok {
			return nil, err
		}
		account.log.WithError(err).Error("error getting the gas price")
		return nil, errp.WithStack(errors.ErrFeesNotAvailable)
	}

	if !account.Synced() {
		return nil, errp.WithStack(errors.ErrAccountNotsynced)
	}

	var value *big.Int
	if args.Amount.SendAll() {
		value = account.balance.BigInt() // set here only temporarily to estimate the gas
	} else {
		allowZero := true

		parsedAmount, err := args.Amount.Amount(account.coin.unitFactor(false), allowZero)
		if err != nil {
			return nil, err
		}
		value = parsedAmount.BigInt()
	}

	var message ethereum.CallMsg

	if account.coin.erc20Token != nil {
		parsed, err := abi.JSON(strings.NewReader(erc20.IERC20ABI))
		if err != nil {
			panic(errp.WithStack(err))
		}
		erc20ContractData, err := parsed.Pack("transfer", &address, value)
		if err != nil {
			panic(errp.WithStack(err))
		}
		contractAddress := account.coin.erc20Token.ContractAddress()
		message = ethereum.CallMsg{
			From: account.address.Address,
			To:   &contractAddress,
			Gas:  0,
			// Gas price has to be 0 for the the Etherscan EstimateGas call to succeed.
			GasPrice: big.NewInt(0),
			Value:    big.NewInt(0),
			Data:     erc20ContractData,
		}
	} else {
		// Standard ethereum transaction
		message = ethereum.CallMsg{
			From:     account.address.Address,
			To:       &address,
			Gas:      0,
			GasPrice: big.NewInt(0),
			Value:    value,
		}
	}

	// For ERC20 transfers, the EstimateGas call fails if we try to spend more than we have and we
	// do not have enough ether to pay the fee.
	// We make some checks upfront to catch this before calling out to the node and failing.
	if !args.Amount.SendAll() {
		if account.coin.erc20Token != nil {
			if value.Cmp(account.balance.BigInt()) == 1 {
				return nil, errp.WithStack(errors.ErrInsufficientFunds)
			}
		}
	}
	gasLimit, err := account.coin.client.EstimateGas(context.TODO(), message)
	if err != nil {
		if strings.Contains(err.Error(), etherscan.ERC20GasErr) {
			return nil, errp.WithStack(errors.ErrInsufficientFunds)
		}
		account.log.WithError(err).Error("Could not estimate the gas limit.")
		return nil, errp.WithStack(errors.TxValidationError(err.Error()))
	}

	fee := new(big.Int).Mul(new(big.Int).SetUint64(gasLimit), suggestedGasPrice)

	// Adjust amount with fee
	if account.coin.erc20Token != nil {
		// in erc 20 tokens, the amount is in the token unit, while the fee is in ETH, so there is
		// no issue withSendAll.

		if !args.Amount.SendAll() && value.Cmp(account.balance.BigInt()) == 1 {
			return nil, errp.WithStack(errors.ErrInsufficientFunds)
		}
	} else {
		if args.Amount.SendAll() {
			// Set the value correctly and check that the fee is smaller than or equal to the balance.
			value = new(big.Int).Sub(account.balance.BigInt(), fee)
			message.Value = value
			if message.Value.Sign() < 0 {
				return nil, errp.WithStack(errors.ErrInsufficientFunds)
			}
		} else {
			// Check that the entered value and the estimated fee are not greater than the balance.
			total := new(big.Int).Add(message.Value, fee)
			if total.Cmp(account.balance.BigInt()) == 1 {
				return nil, errp.WithStack(errors.ErrInsufficientFunds)
			}
		}
	}
	tx := types.NewTransaction(account.nextNonce,
		*message.To,
		message.Value, gasLimit, suggestedGasPrice, message.Data)
	return &TxProposal{
		Coin:    account.coin,
		Tx:      tx,
		Fee:     fee,
		Value:   value,
		Signer:  types.MakeSigner(account.coin.Net(), account.blockNumber),
		Keypath: account.signingConfiguration.AbsoluteKeypath(),
	}, nil
}

// storePendingOutgoingTransaction puts an outgoing tx into the db with height 0 (pending).
func (account *Account) storePendingOutgoingTransaction(transaction *types.Transaction) error {
	dbTx, err := account.db.Begin()
	if err != nil {
		return err
	}
	defer dbTx.Rollback()
	if err := dbTx.PutOutgoingTransaction(
		&ethtypes.TransactionWithMetadata{
			Transaction:       transaction,
			BroadcastAttempts: 1,
		}); err != nil {
		return err
	}
	if err := dbTx.Commit(); err != nil {
		return err
	}
	account.log.Infof("stored pending outgoing tx with nonce: %d", transaction.Nonce())
	return nil
}

// SendTx implements accounts.Interface.
func (account *Account) SendTx() error {
	unlock := account.updateLock.RLock()
	txProposal := account.activeTxProposal
	unlock()
	if txProposal == nil {
		return errp.New("No active tx proposal")
	}

	account.log.Info("Signing and sending transaction")
	if err := account.Config().Keystore.SignTransaction(txProposal); err != nil {
		return err
	}
	// By experience, at least with the Etherscan backend, this can succeed and still the
	// transaction will be lost (not in any block explorer, the node does not know about it, etc.).
	// We do an attempt here and more attempts if needed in `updateOutgoingTransactions()`.
	if err := account.coin.client.SendTransaction(context.TODO(), txProposal.Tx); err != nil {
		return errp.WithStack(err)
	}
	if err := account.storePendingOutgoingTransaction(txProposal.Tx); err != nil {
		return err
	}

	note := account.BaseAccount.GetAndClearProposedTxNote()
	if err := account.SetTxNote(txProposal.Tx.Hash().Hex(), note); err != nil {
		// Not critical.
		account.log.WithError(err).Error("Failed to save transaction note when sending a tx")
	}
	account.enqueueUpdateCh <- struct{}{}
	return nil
}

// ethGasStationFeeTargets returns four priorities with fee targets estimated by
// https://ethgasstation.info/.
func (account *Account) ethGasStationFeeTargets() ([]*feeTarget, error) {
	// TODO: Use timeout.
	// Docs: https://docs.ethgasstation.info/gas-price#gas-price
	response, err := account.httpClient.Get("https://ethgasstation.info/api/ethgasAPI.json?api-key=" + ethGasStationAPIKey)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close() //nolint:errcheck
	if response.StatusCode != http.StatusOK {
		return nil, errp.Newf("ethgasstation returned status code %d", response.StatusCode)
	}
	var responseDecoded struct {
		// Values are in Gwei*10
		Average int64 `json:"average"`
		Fast    int64 `json:"fast"`
		Fastest int64 `json:"fastest"`
		SafeLow int64 `json:"safeLow"`
	}
	if err := json.NewDecoder(response.Body).Decode(&responseDecoded); err != nil {
		return nil, err
	}
	// Conversion from 10x Gwei to Wei.
	factor := big.NewInt(1e8)
	return []*feeTarget{
		{
			code:     accounts.FeeTargetCodeHigh,
			gasPrice: new(big.Int).Mul(big.NewInt(responseDecoded.Fastest), factor),
		},
		{
			code:     accounts.FeeTargetCodeNormal,
			gasPrice: new(big.Int).Mul(big.NewInt(responseDecoded.Fast), factor),
		},
		{
			code:     accounts.FeeTargetCodeLow,
			gasPrice: new(big.Int).Mul(big.NewInt(responseDecoded.Average), factor),
		},
		{
			code:     accounts.FeeTargetCodeEconomy,
			gasPrice: new(big.Int).Mul(big.NewInt(responseDecoded.SafeLow), factor),
		},
	}, nil
}

// feeTargets returns four priorities with fee targets estimated by https://ethgasstation.info/.  If
// the ethgasstation service should not reachable, we fallback to only one priority, estimated by
// the ETH RPC eth_gasPrice endpoint.
func (account *Account) feeTargets() []*feeTarget {
	ethGasStationTargets, err := account.ethGasStationFeeTargets()
	if err == nil {
		return ethGasStationTargets
	}
	account.log.WithError(err).Error("Could not get fee targets from eth gas station, falling back to RPC eth_gasPrice")
	suggestedGasPrice, err := account.coin.client.SuggestGasPrice(context.TODO())
	if err != nil {
		account.log.WithError(err).Error("Fallback to RPC eth_gasPrice failed")
		return nil
	}
	return []*feeTarget{
		{
			code:     accounts.FeeTargetCodeNormal,
			gasPrice: suggestedGasPrice,
		},
	}
}

// FeeTargets implements accounts.Interface.
func (account *Account) FeeTargets() ([]accounts.FeeTarget, accounts.FeeTargetCode) {
	feeTargets := []accounts.FeeTarget{}
	for _, t := range account.feeTargets() {
		feeTargets = append(feeTargets, t)
	}
	return feeTargets, accounts.DefaultFeeTarget
}

// gasPrice returns the currently suggested gas price for the given fee target, or a custom gas
// price if the fee target is `FeeTargetCodeCustom`.
func (account *Account) gasPrice(args *accounts.TxProposalArgs) (*big.Int, error) {
	if args.FeeTargetCode == accounts.FeeTargetCodeCustom {
		// Convert from Gwei to Wei.
		amount, err := coin.NewAmountFromString(args.CustomFee, big.NewInt(1e9))
		if err != nil {
			return nil, err
		}
		gasPrice := amount.BigInt()
		if gasPrice.Cmp(big.NewInt(0)) <= 0 {
			return nil, errors.ErrFeeTooLow
		}
		return gasPrice, nil
	}
	for _, t := range account.feeTargets() {
		if t.code == args.FeeTargetCode {
			if t.gasPrice.Cmp(big.NewInt(0)) <= 0 {
				return nil, errors.ErrFeeTooLow
			}
			return t.gasPrice, nil
		}
	}
	return nil, errp.Newf("Could not find fee target %s", args.FeeTargetCode)
}

// TxProposal implements accounts.Interface.
func (account *Account) TxProposal(
	args *accounts.TxProposalArgs,
) (coin.Amount, coin.Amount, coin.Amount, error) {
	defer account.updateLock.Lock()()
	txProposal, err := account.newTx(args)
	if err != nil {
		return coin.Amount{}, coin.Amount{}, coin.Amount{}, err
	}
	account.activeTxProposal = txProposal

	var total *big.Int
	if account.coin.erc20Token != nil {
		total = txProposal.Value
	} else {
		total = new(big.Int).Add(txProposal.Value, txProposal.Fee)
	}
	return coin.NewAmount(txProposal.Value), coin.NewAmount(txProposal.Fee), coin.NewAmount(total), nil
}

// GetUnusedReceiveAddresses implements accounts.Interface.
func (account *Account) GetUnusedReceiveAddresses() []accounts.AddressList {
	if !account.isInitialized() {
		return nil
	}
	return []accounts.AddressList{{
		Addresses: []accounts.Address{account.address},
	}}
}

// VerifyAddress implements accounts.Interface.
func (account *Account) VerifyAddress(addressID string) (bool, error) {
	if !account.isInitialized() {
		return false, errp.New("account must be initialized")
	}
	canVerifyAddress, _, err := account.Config().Keystore.CanVerifyAddress(account.Coin())
	if err != nil {
		return false, err
	}
	if canVerifyAddress {
		return true, account.Config().Keystore.VerifyAddress(account.signingConfiguration, account.Coin())
	}
	return false, nil
}

// CanVerifyAddresses implements accounts.Interface.
func (account *Account) CanVerifyAddresses() (bool, bool, error) {
	return account.Config().Keystore.CanVerifyAddress(account.Coin())
}
