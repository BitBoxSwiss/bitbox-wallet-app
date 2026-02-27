// SPDX-License-Identifier: Apache-2.0

package eth

import (
	"context"
	"encoding/hex"
	"fmt"
	"math/big"
	"net/http"
	"os"
	"path"
	"strconv"
	"strings"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/errors"
	accountsTypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/types"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/db"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/erc20"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/etherscan"
	ethtypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/types"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/signing"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/locker"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/observable"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/observable/action"
	ethereum "github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	ethcommon "github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/rlp"
	"github.com/sirupsen/logrus"
)

func isMixedCase(s string) bool {
	return strings.ToLower(s) != s && strings.ToUpper(s) != s
}

// IsValidEthAddress checks if a string is a valid 20 byte ETH address and validates checksum when present.
func IsValidEthAddress(addr string) bool {
	if !ethcommon.IsHexAddress(addr) {
		return false
	}
	// Validate checksum if the address is mixed case, see https://github.com/ethereum/EIPs/blob/master/EIPS/eip-55.md
	if isMixedCase(addr) && addr != ethcommon.HexToAddress(addr).Hex() {
		return false
	}
	return true
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

	closed bool

	// enqueueUpdateCh is used to invoke an account update outside of the regular poll update
	// interval.
	enqueueUpdateCh chan *Account

	address Address

	// updateLock covers balance, blockNumber, nextNonce, transactions and activeTxProposal.
	updateLock   locker.Locker
	balance      coin.Amount
	blockNumber  *big.Int
	transactions []*accounts.TransactionData

	// if not nil, SendTx() will sign and send this transaction. Set by TxProposal().
	activeTxProposal *TxProposal

	log *logrus.Entry

	// initDone is called when the account is initialized for the first time
	initDone func()
}

// NewAccount creates a new account.
func NewAccount(
	config *accounts.AccountConfig,
	accountCoin *Coin,
	httpClient *http.Client,
	log *logrus.Entry,
	enqueueUpdateCh chan *Account,
) *Account {
	log = log.WithField("group", "eth").
		WithFields(logrus.Fields{"coin": accountCoin.String(), "code": config.Config.Code})
	log.Debug("Creating new account")

	account := &Account{
		BaseAccount:          accounts.NewBaseAccount(config, accountCoin, log),
		coin:                 accountCoin,
		dbSubfolder:          "", // set in Initialize()
		signingConfiguration: nil,
		httpClient:           httpClient,
		balance:              coin.NewAmountFromInt64(0),

		enqueueUpdateCh: enqueueUpdateCh,

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

func (account *Account) isClosed() bool {
	defer account.initializedLock.RLock()()
	return account.closed
}

func (account *Account) isInitialized() bool {
	defer account.initializedLock.RLock()()
	return account.initialized
}

// Initialize implements accounts.Interface.
func (account *Account) Initialize() error {
	// Early returns that do not require a write-lock.
	if account.isClosed() {
		return errp.New("Initialize: account was closed, init only works once.")
	}
	if account.isInitialized() {
		return nil
	}

	defer account.initializedLock.Lock()()
	if account.closed {
		return errp.New("Initialize: account was closed, init only works once.")
	}
	if account.initialized {
		return nil
	}
	account.initialized = true

	signingConfigurations := account.Config().Config.SigningConfigurations
	if len(signingConfigurations) != 1 {
		return errp.New("Ethereum only supports one signing config")
	}
	signingConfiguration := signingConfigurations[0]

	account.signingConfiguration = signingConfiguration
	account.notifier = account.Config().GetNotifier(signingConfigurations)

	accountIdentifier := fmt.Sprintf("account-%s", account.Config().Config.Code)
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
	account.initDone = account.Synchronizer.IncRequestsCounter()
	go account.EnqueueUpdate()

	return account.BaseAccount.Initialize(accountIdentifier)
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

func (account *Account) confirmedTransactions() ([]*accounts.TransactionData, error) {
	var confirmedTransactions []*accounts.TransactionData
	transactionsSource := account.coin.TransactionsSource()
	if transactionsSource != nil {
		var err error
		confirmedTransactions, err = transactionsSource.Transactions(
			account.blockNumber,
			account.address.Address, account.blockNumber, account.coin.erc20Token)
		if err != nil {
			return nil, err
		}
	}
	return confirmedTransactions, nil
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

func (account *Account) nextNonce() (uint64, error) {
	var nextNonce uint64

	// Nonce to be used for the next tx, fetched from the ETH node. It might be out of date due to
	// latency, which is addressed below by using the locally stored nonce.
	nodeNonce, err := account.coin.client.PendingNonceAt(context.TODO(), account.address.Address)
	if err != nil {
		return 0, err
	}
	nextNonce = nodeNonce

	// In case the nodeNonce is not up to date, we fall back to our stored last nonce to compute the
	// next nonce.
	outgoingTransactions, err := account.outgoingTransactions(nil)
	if err != nil {
		return 0, errp.WithStack(err)
	}

	if len(outgoingTransactions) > 0 {
		localNonce := outgoingTransactions[0].Transaction.Nonce() + 1
		if localNonce > nextNonce {
			nextNonce = localNonce
		}
	}
	return nextNonce, nil
}

// Update performs an Update of the account's transactions,
// as well as its balance and the chain's latest blockNumber,
// both of which must be provided as an argument.
func (account *Account) Update(balance *big.Int, blockNumber *big.Int) error {
	defer account.updateLock.Lock()()
	defer account.Synchronizer.IncRequestsCounter()()

	account.blockNumber = blockNumber

	go account.updateOutgoingTransactions(account.blockNumber.Uint64())

	// Get confirmed transactions.
	confirmedTransactions, err := account.confirmedTransactions()
	if err != nil {
		return errp.WithStack(err)
	}

	// Get our stored outgoing transactions. Filter out all transactions from the transactions
	// source, which should contain all confirmed tx.
	outgoingTransactions, err := account.outgoingTransactions(confirmedTransactions)
	if err != nil {
		return err
	}

	outgoingTransactionsData := make([]*accounts.TransactionData, len(outgoingTransactions))
	for i, tx := range outgoingTransactions {
		outgoingTransactionsData[i] = tx.TransactionData(
			account.blockNumber.Uint64(),
			account.coin.erc20Token,
			account.address.Address.Hex(),
		)
	}
	outgoingTransactionsData = append(outgoingTransactionsData, confirmedTransactions...)
	account.transactions = outgoingTransactionsData
	for _, transaction := range account.transactions {
		if err := account.notifier.Put([]byte(transaction.TxID)); err != nil {
			return err
		}
	}

	pendingAmount := pendingTxsAmount(outgoingTransactionsData, account.coin.erc20Token != nil)
	account.balance = coin.NewAmount(balance.Sub(balance, pendingAmount))

	if account.initDone != nil {
		account.initDone()
		account.initDone = nil
	}

	return nil
}

// pendingTxsAmount returns the total amount of pending transactions. Fees are not included for erc20 txs.
func pendingTxsAmount(outgoingTransactionsData []*accounts.TransactionData, isErc20 bool) *big.Int {
	pendingTxAmount := big.NewInt(0)
	for _, tx := range outgoingTransactionsData {
		if tx.Status == accounts.TxStatusPending {
			// Skip sendSelf txs
			if tx.Type == accounts.TxTypeSend {
				pendingTxAmount = pendingTxAmount.Add(pendingTxAmount, tx.Amount.BigInt())
			}
			if !isErc20 {
				// tx Fee is considered only for ETH transactions. For ERC20 tokens it should
				// be subtracted to the balance of the related ETH account. This is not done at
				// the moment, could be possibly fixed in the future migrating to BlockBook.
				pendingTxAmount = pendingTxAmount.Add(pendingTxAmount, tx.Fee.BigInt())
			}
		}
	}

	return pendingTxAmount
}

// FatalError implements accounts.Interface.
func (account *Account) FatalError() bool {
	return false
}

// Close implements accounts.Interface.
func (account *Account) Close() {
	defer account.initializedLock.Lock()()
	account.BaseAccount.Close()
	account.log.Info("Closed account")
	if account.db != nil {
		if err := account.db.Close(); err != nil {
			account.log.WithError(err).Error("couldn't close db")
		}
		account.log.Info("Closed DB")
	}
	account.closed = true
	account.Notify(observable.Event{
		Subject: string(accountsTypes.EventStatusChanged),
		Action:  action.Reload,
		Object:  nil,
	})
}

// Notifier implements accounts.Interface.
func (account *Account) Notifier() accounts.Notifier {
	return account.notifier
}

// Transactions implements accounts.Interface.
func (account *Account) Transactions() (accounts.OrderedTransactions, error) {
	if err := account.Offline(); err != nil {
		return nil, err
	}
	if !account.Synced() {
		return nil, accounts.ErrSyncInProgress
	}
	return accounts.NewOrderedTransactions(account.transactions), nil
}

// Balance implements accounts.Interface.
func (account *Account) Balance() (*accounts.Balance, error) {
	if err := account.Offline(); err != nil {
		return nil, err
	}
	if !account.Synced() {
		return nil, accounts.ErrSyncInProgress
	}
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
	// Address of the ETH recipient (or ERC-20 address in case of an ERC-20 transaction).  This is
	// not used in the transaction or signing except for making sure the BitBox displays the address
	// with the same case (lowercase/uppercase/mixed) as the user entered.
	RecipientAddress string
}

func (account *Account) newTx(args *accounts.TxProposalArgs) (*TxProposal, error) {
	if !IsValidEthAddress(args.RecipientAddress) {
		return nil, errp.WithStack(errors.ErrInvalidAddress)
	}
	address := ethcommon.HexToAddress(args.RecipientAddress)

	suggestedGasFeeCap, suggestedGasTipCap, err := account.gasFees(args)
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
			// Gas price has to be 0 for the Etherscan EstimateGas call to succeed.
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

	fee := new(big.Int).Mul(new(big.Int).SetUint64(gasLimit), suggestedGasFeeCap)

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

	keystore, err := account.Config().ConnectKeystore()
	if err != nil {
		return nil, err
	}

	var tx *types.Transaction

	nextNonce, err := account.nextNonce()
	if err != nil {
		return nil, err
	}

	if keystore.SupportsEIP1559() {
		txData := &types.DynamicFeeTx{
			Nonce:     nextNonce,
			GasTipCap: suggestedGasTipCap,
			GasFeeCap: suggestedGasFeeCap,
			Gas:       gasLimit,
			To:        message.To,
			Value:     message.Value,
			Data:      message.Data,
		}
		tx = types.NewTx(txData)
	} else {
		tx = types.NewTransaction(
			nextNonce,
			*message.To,
			message.Value,
			gasLimit,
			// use the maxFeePerGas (aka gasFeeCap) as gasPrice for legacy transactions
			// the estimated maxFeePerGas is base fee + priority fee, and so is the appropriate
			// legacy gasPrice setting for current network conditions
			suggestedGasFeeCap,
			message.Data)
	}

	return &TxProposal{
		Coin:             account.coin,
		Tx:               tx,
		Fee:              fee,
		Value:            value,
		Signer:           types.NewLondonSigner(account.coin.net.ChainID),
		Keypath:          account.signingConfiguration.AbsoluteKeypath(),
		RecipientAddress: args.RecipientAddress,
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
func (account *Account) SendTx(txNote string) (string, error) {
	unlock := account.updateLock.RLock()
	txProposal := account.activeTxProposal
	unlock()
	if txProposal == nil {
		return "", errp.New("No active tx proposal")
	}

	keystore, err := account.Config().ConnectKeystore()
	if err != nil {
		return "", err
	}

	account.log.Info("Signing and sending transaction")
	if err := keystore.SignTransaction(txProposal); err != nil {
		return "", err
	}
	// By experience, at least with the Etherscan backend, this can succeed and still the
	// transaction will be lost (not in any block explorer, the node does not know about it, etc.).
	// We do an attempt here and more attempts if needed in `updateOutgoingTransactions()`.
	if err := account.coin.client.SendTransaction(context.TODO(), txProposal.Tx); err != nil {
		return "", errp.WithStack(err)
	}
	if err := account.storePendingOutgoingTransaction(txProposal.Tx); err != nil {
		return "", err
	}

	if err := account.SetTxNote(txProposal.Tx.Hash().Hex(), txNote); err != nil {
		// Not critical.
		account.log.WithError(err).Error("Failed to save transaction note when sending a tx")
	}
	account.EnqueueUpdate()
	return txProposal.Tx.Hash().String(), nil
}

// feeTargets returns three priorities with fee targets estimated by Etherscan
// https://docs.etherscan.io/api-endpoints/gas-tracker#get-gas-oracle
// If the service should not be reachable, we fallback to only one priority, estimated by
// the ETH RPC eth_gasPrice endpoint.
func (account *Account) feeTargets() []*ethtypes.FeeTarget {
	if account.coin.code != coin.CodeSEPETH {
		etherscanFeeTargets, err := account.coin.client.FeeTargets(context.TODO())
		if err == nil {
			return etherscanFeeTargets
		}
		account.log.WithError(err).Error("Could not get fee targets from eth gas station, falling back to RPC eth_gasPrice")
	}
	suggestedGasPrice, err := account.coin.client.SuggestGasPrice(context.TODO())
	if err != nil {
		account.log.WithError(err).Error("Fallback to RPC eth_gasPrice failed")
		return nil
	}
	return []*ethtypes.FeeTarget{
		{
			TargetCode: accounts.FeeTargetCodeNormal,
			GasFeeCap:  suggestedGasPrice,
			GasTipCap:  suggestedGasPrice,
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

// gasFees returns the currently suggested maxFeePerGas and maxPriorityFee for the given fee target, or a custom fee
// if the fee target is `FeeTargetCodeCustom`. The custom fee sets both maxFeePerGas and maxPriorityFee to the same value.
// TODO: The UI should have and advanced setting to allow the user to set maxFeePerGas and maxPriorityFee separately.
func (account *Account) gasFees(args *accounts.TxProposalArgs) (*big.Int, *big.Int, error) {
	if args.FeeTargetCode == accounts.FeeTargetCodeCustom {
		// Convert from Gwei to Wei.
		amount, err := coin.NewAmountFromString(args.CustomFee, big.NewInt(1e9))
		if err != nil {
			return nil, nil, err
		}
		gasPrice := amount.BigInt()
		if gasPrice.Cmp(big.NewInt(0)) <= 0 {
			return nil, nil, errors.ErrFeeTooLow
		}
		return gasPrice, gasPrice, nil
	}
	for _, t := range account.feeTargets() {
		if t.TargetCode == args.FeeTargetCode {
			if t.GasTipCap.Cmp(big.NewInt(0)) <= 0 || t.GasFeeCap.Cmp(big.NewInt(0)) <= 0 {
				return nil, nil, errors.ErrFeeTooLow
			}
			return t.GasFeeCap, t.GasTipCap, nil
		}
	}
	return nil, nil, errp.Newf("Could not find fee target %s", args.FeeTargetCode)
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
func (account *Account) GetUnusedReceiveAddresses() ([]accounts.AddressList, error) {
	if !account.isInitialized() {
		return nil, errp.New("uninitialized")
	}
	return []accounts.AddressList{{
		Addresses: []accounts.Address{account.address},
	}}, nil
}

// VerifyAddress implements accounts.Interface.
func (account *Account) VerifyAddress(addressID string) (bool, error) {
	if !account.isInitialized() {
		return false, errp.New("account must be initialized")
	}
	keystore, err := account.Config().ConnectKeystore()
	if err != nil {
		return false, err
	}
	canVerifyAddress, _, err := keystore.CanVerifyAddress(account.Coin())
	if err != nil {
		return false, err
	}
	if canVerifyAddress {
		return true, keystore.VerifyAddressETH(account.signingConfiguration, account.Coin())
	}
	return false, nil
}

// CanVerifyAddresses implements accounts.Interface.
func (account *Account) CanVerifyAddresses() (bool, bool, error) {
	keystore, err := account.Config().ConnectKeystore()
	if err != nil {
		return false, false, err
	}

	return keystore.CanVerifyAddress(account.Coin())
}

// SignMsg is used for personal_sign and eth_sign messages in BBApp via WalletConnect.
func (account *Account) SignMsg(
	message string,
) (string, error) {
	bytesMessage, err := hex.DecodeString(strings.TrimPrefix(message, "0x"))
	if err != nil {
		return "", err
	}

	keystore, err := account.Config().ConnectKeystore()
	if err != nil {
		return "", err
	}
	signedMessage, err := keystore.SignETHMessage(bytesMessage, account.signingConfiguration.AbsoluteKeypath())
	if err != nil {
		return "", err
	}
	return "0x" + hex.EncodeToString(signedMessage), nil
}

// SignTypedMsg signs an Ethereum EIP-712 typed message in BBApp via WalletConnect.
func (account *Account) SignTypedMsg(
	chainId uint64,
	data string,
) (string, error) {
	keystore, err := account.Config().ConnectKeystore()
	if err != nil {
		return "", err
	}
	signedMessage, err := keystore.SignETHTypedMessage(chainId, []byte(data), account.signingConfiguration.AbsoluteKeypath())
	if err != nil {
		return "", err
	}
	return "0x" + hex.EncodeToString(signedMessage), nil
}

// SignETHMessage signs a plain text message with the account's Ethereum address.
// Returns the address used for signing and the signature (hex-encoded with 0x prefix).
func (account *Account) SignETHMessage(message string) (string, string, error) {
	if len(message) == 0 {
		return "", "", errp.New("message cannot be empty")
	}

	keystore, err := account.Config().ConnectKeystore()
	if err != nil {
		return "", "", err
	}
	signedMessage, err := keystore.SignETHMessage([]byte(message), account.signingConfiguration.AbsoluteKeypath())
	if err != nil {
		return "", "", err
	}
	return account.address.Address.Hex(), "0x" + hex.EncodeToString(signedMessage), nil
}

// WalletConnectArgs are the tx proposal arguments received from Wallet Connect with Gas, GasPrice,
// Value and Nonce being optional.
type WalletConnectArgs struct {
	From     string `json:"from"`
	To       string `json:"to"`
	Data     string `json:"data"`
	Gas      string `json:"gas,omitempty"`
	GasPrice string `json:"gasPrice,omitempty"`
	Value    string `json:"value,omitempty"`
	Nonce    string `json:"nonce,omitempty"`
}

// EthSignWalletConnectTx signs an Ethereum Tx received from WalletConnect.
func (account *Account) EthSignWalletConnectTx(
	// send: whether transaction should be broadcast after signing
	send bool,
	// chainId: allow specifying other IDs than 1 (ETH mainnet) for other EVM networks
	// TODO L#940 we also need to connect to an appropriate RPC for each L2 network/sidechain
	chainId uint64,
	proposedTx WalletConnectArgs,
) (string, string, error) {
	var nonce uint64
	var message ethereum.CallMsg
	var gasPrice *big.Int
	var value *big.Int

	// Error if chaindId != account.coin.ChainID() (i.e. 1) until L2 RPCs and proper support are added
	if chainId != account.coin.ChainID() {
		return "", "", errp.New("Unsupported EVM Network. BBApp only supports Ethereum Mainnet at the moment.")
	}

	if !IsValidEthAddress(proposedTx.To) {
		return "", "", errp.WithStack(errors.ErrInvalidAddress)
	}
	address := ethcommon.HexToAddress(proposedTx.To)

	if proposedTx.Nonce != "" {
		parsed, err := strconv.ParseUint(strings.TrimPrefix(proposedTx.Nonce, "0x"), 16, 64)
		if err != nil {
			return "", "", err
		}
		nonce = parsed
	} else {
		var err error
		if nonce, err = account.nextNonce(); err != nil {
			return "", "", err
		}
	}

	if proposedTx.Value != "" {
		bigIntValue, ok := new(big.Int).SetString(strings.TrimPrefix(proposedTx.Value, "0x"), 16)
		if !ok {
			return "", "", errp.New("error setting transaction value")
		}
		value = bigIntValue
	}

	data, err := hex.DecodeString(strings.TrimPrefix(proposedTx.Data, "0x"))
	if err != nil {
		return "", "", err
	}

	message = ethereum.CallMsg{
		From:     account.address.Address,
		To:       &address,
		Gas:      0,
		GasPrice: big.NewInt(0),
		Value:    value,
		Data:     data,
	}

	gasLimit, err := account.coin.client.EstimateGas(context.TODO(), message)
	if err != nil {
		if strings.Contains(err.Error(), etherscan.ERC20GasErr) {
			return "", "", errp.WithStack(errors.ErrInsufficientFunds)
		}
		account.log.WithError(err).Error("Could not estimate the gas limit.")
		return "", "", errp.WithStack(errors.TxValidationError(err.Error()))
	}

	for _, t := range account.feeTargets() {
		// TODO Let user choose gas price/priority
		if t.TargetCode == accounts.FeeTargetCodeNormal {
			if t.GasFeeCap.Cmp(big.NewInt(0)) <= 0 {
				return "", "", errors.ErrFeeTooLow
			}
			gasPrice = t.GasFeeCap
		}
	}

	tx := types.NewTransaction(nonce,
		*message.To,
		message.Value, gasLimit, gasPrice, message.Data)

	keystore, err := account.Config().ConnectKeystore()
	if err != nil {
		return "", "", err
	}
	signature, err := keystore.SignETHWalletConnectTransaction(chainId, tx, account.signingConfiguration.AbsoluteKeypath())
	if err != nil {
		return "", "", err
	}
	// TODO edit signer to match chainID proposed by wallet connect
	// account.coin.Net() will only incude ChainID 1 in its current *params.ChainConfig
	// Needs to be set to the appropriuate chain id for each supported network
	// TODO we also need to connect to an appropriate RPC for each L2 network/sidechain

	// BlockTime needed to decide whether to use the Cancun signer. We don't need that for now.
	blockTime := uint64(0)
	signer := types.MakeSigner(account.coin.Net(), account.blockNumber, blockTime)
	signedTx, err := tx.WithSignature(signer, signature)
	if err != nil {
		return "", "", err
	}
	txHash := signedTx.Hash()
	if send {
		if err := account.coin.client.SendTransaction(context.TODO(), signedTx); err != nil {
			return "", "", errp.WithStack(err)
		}
	}
	rawTx, err := rlp.EncodeToBytes(signedTx)
	if err != nil {
		return "", "", err
	}
	return "0x" + hex.EncodeToString(txHash[:]), "0x" + hex.EncodeToString(rawTx), nil
}

// Address returns the account's single Ethereum address.
func (account *Account) Address() (*Address, error) {
	if !account.isInitialized() {
		return nil, errp.New("account must be initialized")
	}
	return &account.address, nil
}

// IsERC20 checks whether an account is an ERC20 token account.
func IsERC20(account *Account) bool {
	return account.coin.erc20Token != nil
}

// MatchesAddress checks whether the provided address matches the account.
func (account *Account) MatchesAddress(address string) (bool, error) {
	if !IsValidEthAddress(address) {
		return false, errp.WithStack(errors.ErrInvalidAddress)
	}
	accountAddress, err := account.Address()
	if err != nil {
		return false, errp.WithStack(err)
	}
	if ethcommon.HexToAddress(address).Hex() == accountAddress.Hex() {
		return true, nil
	}
	return false, nil
}

// EnqueueUpdate enqueues an update for the account.
func (account *Account) EnqueueUpdate() {
	account.enqueueUpdateCh <- account
}

// ETHCoin returns the eth.Coin of the account.
func (account *Account) ETHCoin() *Coin {
	return account.coin
}
