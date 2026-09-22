// SPDX-License-Identifier: Apache-2.0

package eth

import (
	"cmp"
	"context"
	"encoding/hex"
	"fmt"
	"maps"
	"math/big"
	"slices"
	"strings"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/errors"
	accountsTypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/types"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/erc20"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/etherscan"
	ethtypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth/types"
	keystorePkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/keystore"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/paymentrequest"
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
	unprefixedAddr := strings.TrimPrefix(strings.TrimPrefix(addr, "0x"), "0X")
	// Validate checksum if the address is mixed case, see https://github.com/ethereum/EIPs/blob/master/EIPS/eip-55.md
	if isMixedCase(unprefixedAddr) && "0x"+unprefixedAddr != ethcommon.HexToAddress(addr).Hex() {
		return false
	}
	return true
}

// Account is an Ethereum account, with one address.
type Account struct {
	*accounts.BaseAccount

	coin                 *Coin
	outgoing             *OutgoingTransactions
	signingConfiguration *signing.Configuration
	notifier             accounts.Notifier

	// true when initialized (Initialize() was called).
	initialized     bool
	initializedLock locker.Locker

	closed bool

	// enqueueUpdateCh is used to invoke an account update outside of the regular poll update
	// interval.
	enqueueUpdateCh chan struct{}

	address Address

	// updateLock covers balance, blockNumber, transactions and activeTxProposal.
	updateLock   locker.Locker
	balance      coin.Amount
	blockNumber  *big.Int
	transactions []*accounts.TransactionData

	// if not nil, SendTx() will sign and send this transaction. Set by TxProposal().
	activeTxProposal *pendingTxProposal

	log *logrus.Entry

	// initDone is called when the account is initialized for the first time
	initDone func()
}

// NewAccount creates a new account.
func NewAccount(
	config *accounts.AccountConfig,
	accountCoin *Coin,
	outgoing *OutgoingTransactions,
	log *logrus.Entry,
	enqueueUpdateCh chan struct{},
) *Account {
	log = log.WithField("group", "eth").
		WithFields(logrus.Fields{"coin": accountCoin.String(), "code": config.Code})
	log.Debug("Creating new account")

	account := &Account{
		BaseAccount:          accounts.NewBaseAccount(config, accountCoin, log),
		coin:                 accountCoin,
		outgoing:             outgoing,
		signingConfiguration: nil,
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

	signingConfigurations := account.Config().SigningConfigurations
	if len(signingConfigurations) != 1 {
		return errp.New("Ethereum only supports one signing config")
	}
	signingConfiguration := signingConfigurations[0]

	account.signingConfiguration = signingConfiguration
	account.notifier = account.Config().GetNotifier(signingConfigurations)

	accountIdentifier := fmt.Sprintf("account-%s", account.Config().Code)

	account.address = Address{
		Address:         crypto.PubkeyToAddress(*account.signingConfiguration.PublicKey().ToECDSA()),
		absoluteKeypath: account.signingConfiguration.AbsoluteKeypath(),
	}

	account.signingConfiguration = signing.NewEthereumConfiguration(
		account.signingConfiguration.EthereumSimple.KeyInfo.RootFingerprint,
		account.signingConfiguration.AbsoluteKeypath(),
		account.signingConfiguration.ExtendedPublicKey(),
	)

	if err := account.coin.Initialize(); err != nil {
		return err
	}
	account.initDone = account.Synchronizer.IncRequestsCounter()
	if !account.Config().SkipInitialSync {
		account.EnqueueUpdate()
	}

	return account.BaseAccount.Initialize(accountIdentifier)
}

// outgoingTransactionIsFinal checks if the transaction is final, meaning it has at least
// NumConfirmationsComplete confirmations and has been checked at least once after reaching
// that threshold.
// If the transaction is not yet included in a block, or if the tipHeight is lower than the
// transaction's block, it is not final.
func outgoingTransactionIsFinal(tx *ethtypes.TransactionWithMetadata, tipHeight uint64) bool {
	if tx.Height == 0 || tipHeight < tx.Height {
		return false
	}
	if tipHeight-tx.Height+1 < ethtypes.NumConfirmationsComplete {
		return false
	}
	if tx.LastReceiptCheckHeight < tx.Height {
		return false
	}
	return tx.LastReceiptCheckHeight-tx.Height+1 >= ethtypes.NumConfirmationsComplete
}

func (account *Account) updateOutgoingTransactions(tipHeight uint64) ([]*ethtypes.TransactionWithMetadata, error) {
	sender, unlock, err := account.outgoing.lock(account.coin.ChainID(), account.address.Address)
	if err != nil {
		return nil, err
	}
	defer unlock()
	if err := sender.reconcile(account.coin.client, tipHeight); err != nil {
		return nil, err
	}
	sender.rebroadcast(account.coin.client, account.log)
	// Reconciliation replaces metadata, so these records remain a snapshot after unlocking.
	return slices.Collect(maps.Values(sender.records)), nil
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

func (account *Account) outgoingTransactions(allTxs []*accounts.TransactionData, records []*ethtypes.TransactionWithMetadata) (
	[]*accounts.TransactionData, *big.Int, error) {
	sender, unlock, err := account.outgoing.lock(account.coin.ChainID(), account.address.Address)
	if err != nil {
		return nil, nil, err
	}
	defer unlock()
	confirmed := make(map[string]*accounts.TransactionData, len(allTxs))
	for _, tx := range allTxs {
		confirmed[tx.TxID] = tx
	}
	var transactions []*accounts.TransactionData
	reserved := pendingAmounts(slices.Values(records), account.address.Address, account.coin.erc20Token, confirmed)
	var prune []ethcommon.Hash
	for _, record := range records {
		hash := record.Transaction.Hash()
		isToken := account.coin.erc20Token != nil
		data := record.TransactionData(account.blockNumber.Uint64(), account.coin.erc20Token, account.address.Hex())
		if data == nil {
			continue
		}
		if history := confirmed[record.TxID()]; history != nil {
			_, _, isTransfer := record.TokenTransfer()
			if history.NumConfirmations >= ethtypes.NumConfirmationsComplete && (isToken || !isTransfer) {
				prune = append(prune, hash)
			}
			continue
		}
		if record.NonceConsumed && record.Height == 0 {
			continue
		}
		transactions = append(transactions, data)
	}
	if len(prune) > 0 {
		if err := sender.save(nil, prune); err != nil {
			return nil, nil, err
		}
	}
	pending := new(big.Int)
	for _, amount := range reserved {
		pending.Add(pending, amount)
	}
	slices.SortFunc(transactions, func(a, b *accounts.TransactionData) int {
		return cmp.Compare(*b.Nonce, *a.Nonce)
	})
	return transactions, pending, nil
}

// PendingTransactions returns access to this account's native-chain outgoing transactions.
func (account *Account) PendingTransactions() *PendingTransactions {
	return &PendingTransactions{
		chainID: account.coin.ChainID(), sender: account.address.Address,
		outgoing: account.outgoing, enqueueUpdate: account.EnqueueUpdate, log: account.log,
	}
}

// Update performs an Update of the account's transactions,
// as well as its balance and the chain's latest blockNumber,
// with outgoing records reconciled at that block. If prefetchedConfirmedTransactions is not nil,
// confirmed transactions are taken from it instead of querying the transactions source.
func (account *Account) Update(
	balance *big.Int,
	blockNumber *big.Int,
	prefetchedConfirmedTransactions []*accounts.TransactionData,
	outgoingRecords []*ethtypes.TransactionWithMetadata,
) error {
	defer account.updateLock.Lock()()
	defer account.Synchronizer.IncRequestsCounter()()

	account.blockNumber = blockNumber

	// Get confirmed transactions.
	var confirmedTransactions []*accounts.TransactionData
	if prefetchedConfirmedTransactions == nil {
		var err error
		confirmedTransactions, err = account.confirmedTransactions()
		if err != nil {
			return errp.WithStack(err)
		}
	} else {
		confirmedTransactions = prefetchedConfirmedTransactions
	}

	// Get our stored outgoing transactions. Filter out all transactions from the transactions
	// source, which should contain all confirmed tx.
	outgoingTransactionsData, pendingAmount, err := account.outgoingTransactions(confirmedTransactions, outgoingRecords)
	if err != nil {
		return err
	}

	outgoingTransactionsData = append(outgoingTransactionsData, confirmedTransactions...)
	account.transactions = outgoingTransactionsData
	for _, transaction := range account.transactions {
		if err := account.notifier.Put([]byte(transaction.TxID)); err != nil {
			return err
		}
	}

	account.balance = coin.NewAmount(new(big.Int).Sub(balance, pendingAmount))

	if account.initDone != nil {
		account.initDone()
		account.initDone = nil
	}

	return nil
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

type pendingTxProposal struct {
	txData   types.TxData
	signedTx *types.Transaction
	fee      *big.Int
	// For ERC20 transfers, value is the token amount encoded in the transaction data.
	value            *big.Int
	recipientAddress string
	paymentRequest   *paymentrequest.Request
}

// TxProposal holds all information needed to sign a transaction.
type TxProposal struct {
	ChainID uint64
	Tx      *types.Transaction
	// KeyPath is the location of this account's address/pubkey/privkey.
	Keypath signing.AbsoluteKeypath
	// Address of the ETH recipient (or ERC-20 address in case of an ERC-20 transaction).  This is
	// not used in the transaction or signing except for making sure the BitBox displays the address
	// with the same case (lowercase/uppercase/mixed) as the user entered.
	RecipientAddress string
	PaymentRequest   *paymentrequest.Request
}

// Signer returns the transaction signer for the proposal's chain.
func (txProposal *TxProposal) Signer() types.Signer {
	return types.LatestSignerForChainID(new(big.Int).SetUint64(txProposal.ChainID))
}

func (account *Account) newTx(args *accounts.TxProposalArgs) (*pendingTxProposal, error) {
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
	if account.coin.erc20Token != nil && value.BitLen() > 256 {
		return nil, errp.WithStack(errors.ErrInvalidAmount)
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

	var txData types.TxData

	// The final nonce is assigned under the sender lock before signing.
	if keystore.SupportsEIP1559() {
		txData = &types.DynamicFeeTx{
			ChainID:   new(big.Int).SetUint64(account.coin.ChainID()),
			GasTipCap: suggestedGasTipCap,
			GasFeeCap: suggestedGasFeeCap,
			Gas:       gasLimit,
			To:        message.To,
			Value:     message.Value,
			Data:      message.Data,
		}
	} else {
		txData = &types.LegacyTx{
			To:    message.To,
			Value: message.Value,
			Gas:   gasLimit,
			// use the maxFeePerGas (aka gasFeeCap) as gasPrice for legacy transactions
			// the estimated maxFeePerGas is base fee + priority fee, and so is the appropriate
			// legacy gasPrice setting for current network conditions
			GasPrice: suggestedGasFeeCap,
			Data:     message.Data,
		}
	}

	return &pendingTxProposal{
		txData:           txData,
		fee:              fee,
		value:            value,
		recipientAddress: args.RecipientAddress,
		paymentRequest:   args.PaymentRequest,
	}, nil
}

// SendTx implements accounts.Interface.
func (account *Account) SendTx(txNote string) (string, error) {
	unlock := account.updateLock.RLock()
	pending := account.activeTxProposal
	unlock()
	if pending == nil {
		return "", errp.New("No active tx proposal")
	}

	keystore, err := account.Config().ConnectKeystore()
	if err != nil {
		return "", err
	}

	defer account.updateLock.Lock()()
	if account.activeTxProposal != pending {
		return "", errp.New("No active tx proposal")
	}

	sender, release, err := account.outgoing.lock(account.coin.ChainID(), account.address.Address)
	if err != nil {
		return "", err
	}
	defer release()
	if pending.signedTx == nil {
		if err := sender.refresh(account.coin.client); err != nil {
			return "", err
		}
		nonce, err := sender.nextNonce(account.coin.client)
		if err != nil {
			return "", err
		}
		switch txData := pending.txData.(type) {
		case *types.LegacyTx:
			txData.Nonce = nonce
		case *types.DynamicFeeTx:
			txData.Nonce = nonce
		default:
			return "", errp.New("unsupported transaction type")
		}
		txProposal := &TxProposal{
			ChainID:          account.coin.ChainID(),
			Tx:               types.NewTx(pending.txData),
			Keypath:          account.signingConfiguration.AbsoluteKeypath(),
			RecipientAddress: pending.recipientAddress,
			PaymentRequest:   pending.paymentRequest,
		}
		if err := sender.checkFunds(account.coin.client, txProposal.Tx, account.coin.erc20Token); err != nil {
			return "", err
		}
		account.log.Info("Signing and sending transaction")
		if err := keystore.SignTransaction(txProposal); err != nil {
			return "", err
		}
		// A timeout can leave the transaction accepted; retries must use these exact bytes.
		pending.signedTx = txProposal.Tx
	}

	transaction := pending.signedTx
	if err := account.coin.client.SendTransaction(context.TODO(), transaction); err != nil {
		known, _, lookupErr := account.coin.client.TransactionByHash(context.TODO(), transaction.Hash())
		if lookupErr != nil || known == nil {
			return "", errp.WithStack(err)
		}
	}
	account.activeTxProposal = nil
	account.PendingTransactions().track(sender, transaction)

	if err := account.SetTxNote(transaction.Hash().Hex(), txNote); err != nil {
		// Not critical.
		account.log.WithError(err).Error("Failed to save transaction note when sending a tx")
	}
	return transaction.Hash().String(), nil
}

// FeeTargets implements accounts.Interface.
func (account *Account) FeeTargets() ([]accounts.FeeTarget, accounts.FeeTargetCode) {
	feeTargets := []accounts.FeeTarget{}
	for _, t := range feeTargetsForChain(account.coin.ChainID(), account.coin.client, account.log) {
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
	for _, t := range feeTargetsForChain(account.coin.ChainID(), account.coin.client, account.log) {
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
		total = txProposal.value
	} else {
		total = new(big.Int).Add(txProposal.value, txProposal.fee)
	}
	return coin.NewAmount(txProposal.value), coin.NewAmount(txProposal.fee), coin.NewAmount(total), nil
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

// SignMsg signs an EIP-191 message with the account's native chain as device context.
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
	signature, err := keystore.SignETHMessage(
		account.coin.ChainID(),
		bytesMessage,
		account.signingConfiguration.AbsoluteKeypath(),
	)
	if err != nil {
		return "", err
	}
	return "0x" + hex.EncodeToString(signature), nil
}

// SignETHMessage signs a plain text message with the account's Ethereum address.
// Returns the address used for signing and the signature (hex-encoded with 0x prefix).
func (account *Account) SignETHMessage(message string) (string, string, error) {
	if !account.isInitialized() {
		return "", "", errp.New("account must be initialized")
	}
	if len(message) == 0 {
		return "", "", errp.New("message cannot be empty")
	}

	keystore, err := account.Config().ConnectKeystore()
	if err != nil {
		return "", "", err
	}
	if !keystore.CanSignMessage(account.Coin().Code()) {
		return "", "", errp.Newf("The connected device or keystore cannot sign messages for %s",
			account.Coin().Code())
	}
	signature, err := keystore.SignETHMessage(
		account.coin.ChainID(),
		[]byte(message),
		account.signingConfiguration.AbsoluteKeypath(),
	)
	if err != nil {
		if errp.Cause(err) == keystorePkg.ErrSigningAborted || errp.Cause(err) == errp.ErrUserAbort {
			return "", "", errp.ErrUserAbort
		}
		return "", "", err
	}
	return account.address.Address.Hex(), "0x" + hex.EncodeToString(signature), nil
}

// Address returns the account's single Ethereum address.
func (account *Account) Address() (*Address, error) {
	if !account.isInitialized() {
		return nil, errp.New("account must be initialized")
	}
	return &account.address, nil
}

// IsERC20 checks whether an account is an ERC20 token account.
func IsERC20(account accounts.Interface) bool {
	coin, isETH := account.Coin().(*Coin)
	return isETH && coin.erc20Token != nil
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
	select {
	case account.enqueueUpdateCh <- struct{}{}:
	default:
	}
}

// ETHCoin returns the eth.Coin of the account.
func (account *Account) ETHCoin() *Coin {
	return account.coin
}
