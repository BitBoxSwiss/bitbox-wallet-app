package eth

import (
	"context"
	"fmt"
	"math/big"
	"path"
	"time"

	ethereum "github.com/ethereum/go-ethereum"

	"github.com/btcsuite/btcd/wire"
	"github.com/btcsuite/btcutil"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/accounts"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/accounts/errors"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/synchronizer"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/coin"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/eth/db"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/keystore"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/signing"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
	"github.com/digitalbitbox/bitbox-wallet-app/util/locker"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/params"
	"github.com/sirupsen/logrus"
)

var pollInterval = 10 * time.Second

// Event instances are sent to the onEvent callback of the wallet.
type Event string

// Account is an Ethereum account, with one address.
type Account struct {
	locker.Locker

	synchronizer            *synchronizer.Synchronizer
	coin                    *Coin
	dbFolder                string
	code                    string
	name                    string
	db                      db.Interface
	getSigningConfiguration func() (*signing.Configuration, error)
	signingConfiguration    *signing.Configuration
	keystores               *keystore.Keystores
	getNotifier             func(*signing.Configuration) accounts.Notifier
	notifier                accounts.Notifier
	offline                 bool
	onEvent                 func(Event)

	initialized bool
	// enqueueUpdateCh is used to invoke an account update outside of the regular poll update
	// interval.
	enqueueUpdateCh chan struct{}

	address     Address
	balance     coin.Amount
	blockNumber *big.Int

	nextNonce    uint64
	transactions []accounts.Transaction

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
	onEvent func(Event),
	log *logrus.Entry,
) *Account {
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

		log: log,
	}
	account.synchronizer = synchronizer.NewSynchronizer(
		func() { onEvent(Event(accounts.EventSyncStarted)) },
		func() {
			if !account.initialized {
				account.initialized = true
				onEvent(Event(accounts.EventStatusChanged))
			}
			onEvent(Event(accounts.EventSyncDone))
		},
		log,
	)
	return account
}

// Info implements accounts.Interface.
func (account *Account) Info() *accounts.Info {
	return nil
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

	account.address = Address{
		Address: crypto.PubkeyToAddress(*account.signingConfiguration.PublicKeys()[0].ToECDSA()),
	}
	account.coin.Initialize()
	go account.poll()
	return nil
}

func (account *Account) poll() {
	timer := time.After(0)
	for {
		select {
		case <-timer:
		case <-account.enqueueUpdateCh:
			account.log.Info("extraordinary account update invoked")
		}
		if err := account.update(); err != nil {
			account.log.WithError(err).Error("error updating account")
			if !account.offline {
				account.offline = true
				account.onEvent(Event(accounts.EventStatusChanged))
			}
		} else if account.offline {
			account.offline = false
			account.onEvent(Event(accounts.EventStatusChanged))
		}
		timer = time.After(pollInterval)
	}
}

// pendingOutgoingTransactions gets all locally stored pending outgoing transactions. It filters out
// already confirmed ones.
func (account *Account) pendingOutgoingTransactions(confirmedTxs []accounts.Transaction) (
	[]accounts.Transaction, error) {
	dbTx, err := account.db.Begin()
	if err != nil {
		return nil, err
	}
	defer dbTx.Rollback()
	pendingOutgoingTransactions, err := dbTx.PendingOutgoingTransactions()
	if err != nil {
		return nil, err
	}

	confirmedTxHashes := map[string]struct{}{}
	for _, confirmedTx := range confirmedTxs {
		confirmedTxHashes[confirmedTx.ID()] = struct{}{}
	}

	transactions := []accounts.Transaction{}
	for _, tx := range pendingOutgoingTransactions {
		wrappedTx := wrappedTransaction{tx: tx}
		// Skip already confirmed tx. TODO: remove from db if 12+ confirmations.
		if _, ok := confirmedTxHashes[wrappedTx.ID()]; ok {
			account.log.Infof("pending tx: skipping already confirmed tx with nonce %d", tx.Nonce())
			continue
		}
		transactions = append(transactions, wrappedTx)
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

	// Get confirmed transactions from EtherScan.
	confirmedTansactions, err := account.coin.EtherScan().Transactions(
		account.address.Address, account.blockNumber)
	if err != nil {
		return err
	}

	// Get our stored pending outgoing transactions. Filter out all confirmed transactions.
	pendingOutgoingTransactions, err := account.pendingOutgoingTransactions(confirmedTansactions)
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
	if len(pendingOutgoingTransactions) > 0 {
		localNonce := pendingOutgoingTransactions[len(pendingOutgoingTransactions)-1].(wrappedTransaction).tx.Nonce() + 1
		if localNonce > account.nextNonce {
			account.nextNonce = localNonce
		}
	}
	account.transactions = append(pendingOutgoingTransactions, confirmedTansactions...)
	for _, transaction := range account.transactions {
		if err := account.notifier.Put([]byte(transaction.ID())); err != nil {
			return err
		}
	}

	balance, err := account.coin.client.BalanceAt(context.TODO(),
		account.address.Address, account.blockNumber)
	if err != nil {
		return errp.WithStack(err)
	}
	account.balance = coin.NewAmount(balance)

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

// Close implements accounts.Interface.
func (account *Account) Close() {

}

// Notifier implements accounts.Interface.
func (account *Account) Notifier() accounts.Notifier {
	return account.notifier
}

// Transactions implements accounts.Interface.
func (account *Account) Transactions() []accounts.Transaction {
	return account.transactions
}

// Balance implements accounts.Interface.
func (account *Account) Balance() *accounts.Balance {
	account.synchronizer.WaitSynchronized()
	return accounts.NewBalance(account.balance, coin.NewAmountFromInt64(0))
}

// TxProposal holds all info needed to create and sign a transacstion.
type TxProposal struct {
	Tx  *types.Transaction
	Fee *big.Int
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
	message := ethereum.CallMsg{
		From:     account.address.Address,
		To:       &address,
		Gas:      0,
		GasPrice: suggestedGasPrice,
		Value:    value,
		Data:     data,
	}
	gasLimit, err := account.coin.client.EstimateGas(context.TODO(), message)
	if err != nil {
		account.log.WithError(err).Error("Could not estimate the gas limit.")
		return nil, errp.WithStack(errors.ErrInvalidData)
	}

	fee := new(big.Int).Mul(new(big.Int).SetUint64(gasLimit), suggestedGasPrice)

	if amount.SendAll() {
		// Set the value correctly and check that the fee is smaller than or equal to the balance.
		value = new(big.Int).Sub(account.balance.BigInt(), fee)
		if value.Sign() < 0 {
			return nil, errp.WithStack(errors.ErrInsufficientFunds)
		}
	} else {
		// Check that the entered value and the estimated fee are not greater than the balance.
		total := new(big.Int).Add(value, fee)
		if total.Cmp(account.balance.BigInt()) == 1 {
			return nil, errp.WithStack(errors.ErrInsufficientFunds)
		}
	}
	tx := types.NewTransaction(account.nextNonce,
		common.HexToAddress(recipientAddress),
		value, gasLimit, suggestedGasPrice, data)
	return &TxProposal{
		Tx:      tx,
		Fee:     fee,
		Signer:  types.MakeSigner(account.coin.Net(), account.blockNumber),
		Keypath: account.signingConfiguration.AbsoluteKeypath(),
	}, nil
}

func (account *Account) storePendingOutgoingTransaction(transaction *types.Transaction) error {
	dbTx, err := account.db.Begin()
	if err != nil {
		return err
	}
	defer dbTx.Rollback()
	if err := dbTx.PutPendingOutgoingTransaction(transaction); err != nil {
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

	value := txProposal.Tx.Value()
	total := new(big.Int).Add(value, txProposal.Fee)
	return coin.NewAmount(value), coin.NewAmount(txProposal.Fee), coin.NewAmount(total), nil
}

// GetUnusedReceiveAddresses implements accounts.Interface.
func (account *Account) GetUnusedReceiveAddresses() []accounts.Address {
	return []accounts.Address{account.address}
}

// VerifyAddress implements accounts.Interface.
func (account *Account) VerifyAddress(addressID string) (bool, error) {
	return true, nil
}

// ConvertToLegacyAddress implements accounts.Interface.
func (account *Account) ConvertToLegacyAddress(string) (btcutil.Address, error) {
	panic("not used")
}

// Keystores implements accounts.Interface.
func (account *Account) Keystores() *keystore.Keystores {
	return account.keystores
}
