// Copyright 2018 Shift Devices AG
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
	"path"
	"strings"
	"time"

	ethereum "github.com/ethereum/go-ethereum"

	"github.com/btcsuite/btcd/wire"
	"github.com/btcsuite/btcutil"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/accounts"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/accounts/errors"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/synchronizer"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/coin"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/eth/db"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/eth/erc20"
	ethtypes "github.com/digitalbitbox/bitbox-wallet-app/backend/coins/eth/types"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/keystore"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/signing"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
	"github.com/digitalbitbox/bitbox-wallet-app/util/locker"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/params"
	"github.com/sirupsen/logrus"
)

var pollInterval = 30 * time.Second

// Account is an Ethereum account, with one address.
type Account struct {
	locker.Locker

	synchronizer            *synchronizer.Synchronizer
	coin                    *Coin
	dbFolder                string
	db                      db.Interface
	code                    string
	name                    string
	getSigningConfiguration func() (*signing.Configuration, error)
	signingConfiguration    *signing.Configuration
	keystores               *keystore.Keystores
	getNotifier             func(*signing.Configuration) accounts.Notifier
	notifier                accounts.Notifier
	offline                 bool
	onEvent                 func(accounts.Event)

	initialized bool
	// enqueueUpdateCh is used to invoke an account update outside of the regular poll update
	// interval.
	enqueueUpdateCh chan struct{}

	address     Address
	balance     coin.Amount
	blockNumber *big.Int

	nextNonce    uint64
	transactions []accounts.Transaction

	quitChan chan struct{}

	log *logrus.Entry
}

// NewAccount creates a new account.
func NewAccount(
	accountCoin *Coin,
	dbFolder string,
	code string,
	name string,
	getSigningConfiguration func() (*signing.Configuration, error),
	keystores *keystore.Keystores,
	getNotifier func(*signing.Configuration) accounts.Notifier,
	onEvent func(accounts.Event),
	log *logrus.Entry,
) *Account {
	log = log.WithField("group", "eth").
		WithFields(logrus.Fields{"coin": accountCoin.String(), "code": code, "name": name})
	log.Debug("Creating new account")

	account := &Account{
		coin:                    accountCoin,
		dbFolder:                dbFolder,
		code:                    code,
		name:                    name,
		getSigningConfiguration: getSigningConfiguration,
		signingConfiguration:    nil,
		keystores:               keystores,
		getNotifier:             getNotifier,
		onEvent:                 onEvent,
		balance:                 coin.NewAmountFromInt64(0),

		initialized:     false,
		enqueueUpdateCh: make(chan struct{}),
		quitChan:        make(chan struct{}),
		log:             log,
	}
	account.synchronizer = synchronizer.NewSynchronizer(
		func() { onEvent(accounts.EventSyncStarted) },
		func() {
			if !account.initialized {
				account.initialized = true
				onEvent(accounts.EventStatusChanged)
			}
			onEvent(accounts.EventSyncDone)
		},
		log,
	)
	return account
}

// Info implements accounts.Interface.
func (account *Account) Info() *accounts.Info {
	return &accounts.Info{
		SigningConfiguration: account.signingConfiguration,
	}
}

// Code implements accounts.Interface.
func (account *Account) Code() string {
	return account.code
}

// Name implements accounts.Interface.
func (account *Account) Name() string {
	return account.name
}

// Coin implements accounts.Interface.
func (account *Account) Coin() coin.Coin {
	return account.coin
}

// Initialize implements accounts.Interface.
func (account *Account) Initialize() error {
	alreadyInitialized, err := func() (bool, error) {
		defer account.Lock()()
		if account.signingConfiguration != nil {
			// Already initialized.
			return true, nil
		}
		signingConfiguration, err := account.getSigningConfiguration()
		if err != nil {
			return false, err
		}
		account.signingConfiguration = signingConfiguration
		account.notifier = account.getNotifier(signingConfiguration)
		return false, nil
	}()
	if err != nil {
		return err
	}
	if alreadyInitialized {
		account.log.Debug("Account has already been initialized")
		return nil
	}

	dbName := fmt.Sprintf("account-%s-%s.db", account.signingConfiguration.Hash(), account.code)
	account.log.Debugf("Opening the database '%s' to persist the transactions.", dbName)
	db, err := db.NewDB(path.Join(account.dbFolder, dbName))
	if err != nil {
		return err
	}
	account.db = db
	account.log.Debugf("Opened the database '%s' to persist the transactions.", dbName)

	if account.signingConfiguration.IsAddressBased() {
		if !common.IsHexAddress(account.signingConfiguration.Address()) {
			return errp.WithStack(errors.ErrInvalidAddress)
		}
		account.address = Address{
			Address: common.HexToAddress(account.signingConfiguration.Address()),
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
	go account.poll()
	return nil
}

func (account *Account) poll() {
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
				if !account.offline {
					account.offline = true
					account.onEvent(accounts.EventStatusChanged)
				}
			} else if account.offline {
				account.offline = false
				account.onEvent(accounts.EventStatusChanged)
			}
			timer = time.After(pollInterval)
		}
	}
}

// updateOutgoingTransactions updates the height of the stored outgoing transactions.
// We update heights for tx with up to 12 confirmations, so re-orgs are taken into account.
// tipHeight is the current blockchain height.
func (account *Account) updateOutgoingTransactions(tipHeight uint64) {
	defer account.synchronizer.IncRequestsCounter()()

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
	for _, tx := range outgoingTransactions {
		remoteTx, err := account.coin.client.TransactionReceiptWithBlockNumber(context.TODO(), tx.Transaction.Hash())
		if err != nil {
			account.log.WithError(err).Error("could not fetch transaction")
			continue
		}
		if remoteTx == nil {
			continue
		}
		success := remoteTx.Status == types.ReceiptStatusSuccessful
		if tx.Height == 0 || (tipHeight-remoteTx.BlockNumber) < ethtypes.NumConfirmationsComplete || tx.Success != success {
			tx.Height = remoteTx.BlockNumber
			tx.GasUsed = remoteTx.GasUsed
			tx.Success = success
			if err := dbTx.PutOutgoingTransaction(tx); err != nil {
				account.log.WithError(err).Error("could not update outgoing tx")
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
func (account *Account) outgoingTransactions(allTxs []accounts.Transaction) (
	[]accounts.Transaction, error) {
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
		allTxHashes[tx.ID()] = struct{}{}
	}

	transactions := []accounts.Transaction{}
	for _, tx := range outgoingTransactions {
		tx := tx
		// Skip txs already present from transactions source.
		if _, ok := allTxHashes[tx.ID()]; ok {
			continue
		}
		transactions = append(transactions,
			ethtypes.NewTransactionWithConfirmations(tx, account.blockNumber.Uint64(), account.coin.erc20Token))
	}
	return transactions, nil
}

func (account *Account) update() error {
	defer account.synchronizer.IncRequestsCounter()()

	header, err := account.coin.client.HeaderByNumber(context.TODO(), nil)
	if err != nil {
		return errp.WithStack(err)
	}
	account.blockNumber = header.Number

	transactionsSource := account.coin.TransactionsSource()

	go account.updateOutgoingTransactions(account.blockNumber.Uint64())

	// Get confirmed transactions.
	var confirmedTansactions []accounts.Transaction
	if transactionsSource != nil {
		var err error
		confirmedTansactions, err = transactionsSource.Transactions(
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
		localNonce := outgoingTransactions[len(outgoingTransactions)-1].(*ethtypes.TransactionWithConfirmations).Transaction.Nonce() + 1
		if localNonce > account.nextNonce {
			account.nextNonce = localNonce
		}
	}
	account.transactions = append(outgoingTransactions, confirmedTansactions...)
	for _, transaction := range account.transactions {
		if err := account.notifier.Put([]byte(transaction.ID())); err != nil {
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

// Initialized implements accounts.Interface.
func (account *Account) Initialized() bool {
	return account.initialized
}

// Offline implements accounts.Interface.
func (account *Account) Offline() bool {
	return account.offline
}

// FatalError implements accounts.Interface.
func (account *Account) FatalError() bool {
	return false
}

// Close implements accounts.Interface.
func (account *Account) Close() {
	account.log.Info("Closed account")
	if account.db != nil {
		if err := account.db.Close(); err != nil {
			account.log.WithError(err).Error("couldn't close db")
		}
		account.log.Info("Closed DB")
	}
	account.initialized = false
	account.onEvent(accounts.EventStatusChanged)
}

// Notifier implements accounts.Interface.
func (account *Account) Notifier() accounts.Notifier {
	return account.notifier
}

// Transactions implements accounts.Interface.
func (account *Account) Transactions() ([]accounts.Transaction, error) {
	account.synchronizer.WaitSynchronized()
	return account.transactions, nil
}

// Balance implements accounts.Interface.
func (account *Account) Balance() (*accounts.Balance, error) {
	account.synchronizer.WaitSynchronized()
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
	if !common.IsHexAddress(recipientAddress) {
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
		parsedAmount, err := amount.Amount(big.NewInt(params.Ether), allowZero)
		if err != nil {
			return nil, err
		}
		value = parsedAmount.BigInt()
	}

	address := common.HexToAddress(recipientAddress)
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
			From:     account.address.Address,
			To:       &contractAddress,
			Gas:      0,
			GasPrice: suggestedGasPrice,
			Value:    big.NewInt(0),
			Data:     erc20ContractData,
		}
	} else {
		// Standard ethereum transaction
		message = ethereum.CallMsg{
			From:     account.address.Address,
			To:       &address,
			Gas:      0,
			GasPrice: suggestedGasPrice,
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
		return nil, errp.WithStack(errors.ErrInvalidData)
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
			Transaction: transaction,
			Height:      0,
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
func (account *Account) SendTx(
	recipientAddress string,
	amount coin.SendAmount,
	_ accounts.FeeTargetCode,
	_ map[wire.OutPoint]struct{},
	data []byte) error {
	account.log.Info("Signing and sending transaction")
	txProposal, err := account.newTx(recipientAddress, amount, data)
	if err != nil {
		return err
	}
	if err := account.keystores.SignTransaction(txProposal); err != nil {
		return err
	}
	if err := account.coin.client.SendTransaction(context.TODO(), txProposal.Tx); err != nil {
		return errp.WithStack(err)
	}
	if err := account.storePendingOutgoingTransaction(txProposal.Tx); err != nil {
		return err
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
	recipientAddress string,
	amount coin.SendAmount,
	_ accounts.FeeTargetCode,
	_ map[wire.OutPoint]struct{},
	data []byte) (coin.Amount, coin.Amount, coin.Amount, error) {

	txProposal, err := account.newTx(recipientAddress, amount, data)
	if err != nil {
		return coin.Amount{}, coin.Amount{}, coin.Amount{}, err
	}

	var total *big.Int
	if account.coin.erc20Token != nil {
		total = txProposal.Value
	} else {
		total = new(big.Int).Add(txProposal.Value, txProposal.Fee)
	}
	return coin.NewAmount(txProposal.Value), coin.NewAmount(txProposal.Fee), coin.NewAmount(total), nil
}

// GetUnusedReceiveAddresses implements accounts.Interface.
func (account *Account) GetUnusedReceiveAddresses() []accounts.Address {
	return []accounts.Address{account.address}
}

// VerifyAddress implements accounts.Interface.
func (account *Account) VerifyAddress(addressID string) (bool, error) {
	if account.signingConfiguration == nil {
		return false, errp.New("account must be initialized")
	}
	account.synchronizer.WaitSynchronized()
	defer account.RLock()()
	canVerifyAddress, _, err := account.Keystores().CanVerifyAddresses(
		account.signingConfiguration, account.Coin())
	if err != nil {
		return false, err
	}
	if canVerifyAddress {
		return true, account.Keystores().VerifyAddress(account.signingConfiguration, account.Coin())
	}
	return false, nil
}

// CanVerifyAddresses implements accounts.Interface.
func (account *Account) CanVerifyAddresses() (bool, bool, error) {
	if account.signingConfiguration == nil {
		return false, false, errp.New("account must be initialized")
	}
	return account.Keystores().CanVerifyAddresses(account.signingConfiguration, account.Coin())
}

// ConvertToLegacyAddress implements accounts.Interface.
func (account *Account) ConvertToLegacyAddress(string) (btcutil.Address, error) {
	panic("not used")
}

// Keystores implements accounts.Interface.
func (account *Account) Keystores() *keystore.Keystores {
	return account.keystores
}
