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
	"fmt"
	"math/big"
	"os"
	"path"
	"strings"
	"time"

	"github.com/digitalbitbox/bitbox-wallet-app/backend/accounts"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/accounts/errors"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/coin"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/eth/db"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/eth/erc20"
	ethtypes "github.com/digitalbitbox/bitbox-wallet-app/backend/coins/eth/types"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/signing"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
	"github.com/digitalbitbox/bitbox-wallet-app/util/locker"
	ethereum "github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	ethcommon "github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/sirupsen/logrus"
)

var pollInterval = 30 * time.Second

// Account is an Ethereum account, with one address.
type Account struct {
	*accounts.BaseAccount

	locker.Locker
	coin *Coin
	// folder for this specific account. It is a subfolder of dbFolder. Full path.
	dbSubfolder          string
	db                   db.Interface
	signingConfiguration *signing.Configuration
	notifier             accounts.Notifier

	// true when initialized (Initialize() was called).
	initialized bool

	// enqueueUpdateCh is used to invoke an account update outside of the regular poll update
	// interval.
	enqueueUpdateCh chan struct{}

	address     Address
	balance     coin.Amount
	blockNumber *big.Int

	// if not nil, SendTx() will sign and send this transaction. Set by TxProposal().
	activeTxProposal     *TxProposal
	activeTxProposalLock locker.Locker

	nextNonce    uint64
	transactions []*accounts.TransactionData

	quitChan chan struct{}

	log *logrus.Entry
}

// NewAccount creates a new account.
func NewAccount(
	config *accounts.AccountConfig,
	accountCoin *Coin,
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

// Initialize implements accounts.Interface.
func (account *Account) Initialize() error {
	defer account.Lock()()
	if account.initialized {
		account.log.Debug("Account has already been initialized")
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

	accountIdentifier := fmt.Sprintf("account-%s-%s", account.signingConfiguration.Hash(), account.Config().Code)
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

	if account.signingConfiguration.IsAddressBased() {
		if !ethcommon.IsHexAddress(account.signingConfiguration.Address()) {
			return errp.WithStack(errors.ErrInvalidAddress)
		}
		account.address = Address{
			Address: ethcommon.HexToAddress(account.signingConfiguration.Address()),
		}
	} else {
		account.address = Address{
			Address: crypto.PubkeyToAddress(*account.signingConfiguration.PublicKeys()[0].ToECDSA()),
		}
	}

	account.signingConfiguration = signing.NewConfiguration(
		account.signingConfiguration.ScriptType(),
		account.signingConfiguration.AbsoluteKeypath(),
		account.signingConfiguration.ExtendedPublicKeys(),
		account.address.String(),
		account.signingConfiguration.SigningThreshold(),
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
	defer account.Synchronizer.IncRequestsCounter()()

	header, err := account.coin.client.HeaderByNumber(context.TODO(), nil)
	if err != nil {
		return errp.WithStack(err)
	}
	account.blockNumber = header.Number

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
		)
	}
	account.transactions = append(outgoingTransactionsData, confirmedTansactions...)
	for _, transaction := range account.transactions {
		if err := account.notifier.Put([]byte(transaction.TxID)); err != nil {
			return err
		}
	}

	if account.coin.erc20Token != nil {
		tok, err := erc20.NewIERC20(account.coin.erc20Token.ContractAddress(), account.coin.client)
		if err != nil {
			panic(err)
		}
		balance, err := tok.BalanceOf(&bind.CallOpts{}, account.address.Address)
		if err != nil {
			return errp.WithStack(err)
		}
		account.balance = coin.NewAmount(balance)
	} else {
		balance, err := account.coin.client.BalanceAt(context.TODO(),
			account.address.Address, nil)
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
	Coin coin.Coin
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

func (account *Account) newTx(
	recipientAddress string,
	amount coin.SendAmount,
	data []byte,
) (*TxProposal, error) {
	if !ethcommon.IsHexAddress(recipientAddress) {
		return nil, errp.WithStack(errors.ErrInvalidAddress)
	}

	suggestedGasPrice, err := account.coin.client.SuggestGasPrice(context.TODO())
	if err != nil {
		return nil, err
	}

	var value *big.Int
	if amount.SendAll() {
		value = account.balance.BigInt() // set here only temporarily to estimate the gas
	} else {
		allowZero := true

		parsedAmount, err := amount.Amount(account.coin.unitFactor(false), allowZero)
		if err != nil {
			return nil, err
		}
		value = parsedAmount.BigInt()
	}

	address := ethcommon.HexToAddress(recipientAddress)
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
			Data:     data,
		}
	}

	// For ERC20 transfers, the EstimateGas call fails if we try to spend more than we have and we
	// do not have enough ether to pay the fee.
	// We make some checks upfront to catch this before calling out to the node and failing.
	if !amount.SendAll() {
		if account.coin.erc20Token != nil {
			if value.Cmp(account.balance.BigInt()) == 1 {
				return nil, errp.WithStack(errors.ErrInsufficientFunds)
			}
		}
	}
	gasLimit, err := account.coin.client.EstimateGas(context.TODO(), message)
	if err != nil {
		account.log.WithError(err).Error("Could not estimate the gas limit.")
		return nil, errp.WithStack(errors.TxValidationError(err.Error()))
	}

	fee := new(big.Int).Mul(new(big.Int).SetUint64(gasLimit), suggestedGasPrice)

	// Adjust amount with fee
	if account.coin.erc20Token != nil {
		// in erc 20 tokens, the amount is in the token unit, while the fee is in ETH, so there is
		// no issue withSendAll.

		if !amount.SendAll() && value.Cmp(account.balance.BigInt()) == 1 {
			return nil, errp.WithStack(errors.ErrInsufficientFunds)
		}
	} else {
		if amount.SendAll() {
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
	unlock := account.activeTxProposalLock.RLock()
	txProposal := account.activeTxProposal
	unlock()
	if txProposal == nil {
		return errp.New("No active tx proposal")
	}

	note := account.BaseAccount.GetAndClearProposedTxNote()

	account.log.Info("Signing and sending transaction")
	if err := account.Config().Keystores.SignTransaction(txProposal); err != nil {
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
	if err := account.SetTxNote(txProposal.Tx.Hash().Hex(), note); err != nil {
		// Not critical.
		account.log.WithError(err).Error("Failed to save transaction note when sending a tx")
	}
	account.enqueueUpdateCh <- struct{}{}
	return nil
}

// FeeTargets implements accounts.Interface.
func (account *Account) FeeTargets() ([]accounts.FeeTarget, accounts.FeeTargetCode) {
	return nil, ""
}

// TxProposal implements accounts.Interface.
func (account *Account) TxProposal(
	args *accounts.TxProposalArgs,
) (coin.Amount, coin.Amount, coin.Amount, error) {
	defer account.activeTxProposalLock.Lock()()
	txProposal, err := account.newTx(args.RecipientAddress, args.Amount, args.Data)
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
	return []accounts.AddressList{
		[]accounts.Address{account.address},
	}
}

// VerifyAddress implements accounts.Interface.
func (account *Account) VerifyAddress(addressID string) (bool, error) {
	if account.signingConfiguration == nil {
		return false, errp.New("account must be initialized")
	}
	account.Synchronizer.WaitSynchronized()
	defer account.RLock()()
	canVerifyAddress, _, err := account.Config().Keystores.CanVerifyAddresses(account.Coin())
	if err != nil {
		return false, err
	}
	if canVerifyAddress {
		return true, account.Config().Keystores.VerifyAddress(account.signingConfiguration, account.Coin())
	}
	return false, nil
}

// CanVerifyAddresses implements accounts.Interface.
func (account *Account) CanVerifyAddresses() (bool, bool, error) {
	if account.signingConfiguration == nil {
		return false, false, errp.New("account must be initialized")
	}
	return account.Config().Keystores.CanVerifyAddresses(account.Coin())
}
