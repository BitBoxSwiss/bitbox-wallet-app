package eth

import (
	"context"
	"math/big"
	"time"

	"github.com/btcsuite/btcd/wire"
	"github.com/btcsuite/btcutil"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/headers"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/synchronizer"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/transactions"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/coin"
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
	code                    string
	name                    string
	getSigningConfiguration func() (*signing.Configuration, error)
	signingConfiguration    *signing.Configuration
	keystores               keystore.Keystores

	initialSyncDone bool

	address      Address
	balance      coin.Amount
	blockNumber  *big.Int
	transactions []coin.Transaction

	log *logrus.Entry
}

// NewAccount creates a new account.
func NewAccount(
	coin *Coin,
	dbFolder string,
	code string,
	name string,
	getSigningConfiguration func() (*signing.Configuration, error),
	keystores keystore.Keystores,
	onEvent func(Event),
	log *logrus.Entry,
) *Account {
	account := &Account{
		coin:                    coin,
		code:                    code,
		name:                    name,
		getSigningConfiguration: getSigningConfiguration,
		signingConfiguration:    nil,
		keystores:               keystores,

		initialSyncDone: false,

		log: log,
	}
	account.synchronizer = synchronizer.NewSynchronizer(
		func() { onEvent(Event(btc.EventSyncStarted)) },
		func() {
			if !account.initialSyncDone {
				account.initialSyncDone = true
				onEvent(Event(btc.EventStatusChanged))
			}
			onEvent(Event(btc.EventSyncDone))
		},
		log,
	)
	return account
}

// Info implements btc.Interface.
func (account *Account) Info() *btc.Info {
	return &btc.Info{}
}

// Code implements btc.Interface.
func (account *Account) Code() string {
	return account.code
}

// Name implements btc.Interface.
func (account *Account) Name() string {
	return account.name
}

// Coin implements btc.Interface.
func (account *Account) Coin() coin.Coin {
	return account.coin
}

// Init implements btc.Interface.
func (account *Account) Init() error {
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
		return false, nil
	}()
	if err != nil {
		return err
	}
	if alreadyInitialized {
		account.log.Debug("Account has already been initialized")
		return nil
	}
	account.address = Address{
		Address: crypto.PubkeyToAddress(*account.signingConfiguration.PublicKeys()[0].ToECDSA()),
	}
	account.coin.Init()
	go account.poll()
	return nil
}

func (account *Account) poll() {
	timer := time.After(0)
	for {
		<-timer
		if err := account.update(); err != nil {
			account.log.WithError(err).Error("error updating account")
		}
		timer = time.After(pollInterval)
	}
}

func (account *Account) update() error {
	defer account.synchronizer.IncRequestsCounter()()
	balance, err := account.coin.client.BalanceAt(context.TODO(), account.address.Address, nil)
	if err != nil {
		return errp.WithStack(err)
	}
	account.balance = coin.NewAmount(balance)

	header, err := account.coin.client.HeaderByNumber(context.TODO(), nil)
	if err != nil {
		return errp.WithStack(err)
	}
	account.blockNumber = header.Number

	transactions, err := account.coin.EtherScan().Transactions(
		account.address.Address, account.blockNumber)
	if err != nil {
		return err
	}
	account.transactions = transactions
	return nil
}

// InitialSyncDone implements btc.Interface.
func (account *Account) InitialSyncDone() bool {
	return account.initialSyncDone
}

// Offline implements btc.Interface.
func (account *Account) Offline() bool {
	return false
}

// Close implements btc.Interface.
func (account *Account) Close() {

}

// Transactions implements btc.Interface.
func (account *Account) Transactions() []coin.Transaction {
	return account.transactions
}

// Balance implements btc.Interface.
func (account *Account) Balance() *transactions.Balance {
	account.synchronizer.WaitSynchronized()
	return &transactions.Balance{
		Available: account.balance,
		Incoming:  coin.NewAmountFromInt64(0),
	}
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
	amount coin.SendAmount) (*TxProposal, error) {
	if !common.IsHexAddress(recipientAddress) {
		return nil, errp.WithStack(coin.ErrInvalidAddress)
	}
	const gasLimit = 21000 // simple transaction gas cost

	nonce, err := account.coin.client.PendingNonceAt(context.TODO(), account.address.Address)
	if err != nil {
		return nil, err
	}
	suggestedGasPrice, err := account.coin.client.SuggestGasPrice(context.TODO())
	if err != nil {
		return nil, err
	}
	fee := new(big.Int).Mul(big.NewInt(gasLimit), suggestedGasPrice)

	var value *big.Int
	if amount.SendAll() {
		value = new(big.Int).Sub(account.balance.BigInt(), fee)
		if value.Sign() <= 0 {
			return nil, errp.WithStack(coin.ErrInsufficientFunds)
		}
	} else {
		parsedAmount, err := amount.Amount(big.NewInt(params.Ether))
		if err != nil {
			return nil, err
		}
		value = parsedAmount.BigInt()
		total := new(big.Int).Add(value, fee)
		if total.Cmp(account.balance.BigInt()) == 1 {
			return nil, errp.WithStack(coin.ErrInsufficientFunds)
		}
	}
	tx := types.NewTransaction(nonce,
		common.HexToAddress(recipientAddress),
		value, gasLimit, suggestedGasPrice, nil)
	return &TxProposal{
		Tx:      tx,
		Fee:     fee,
		Signer:  types.MakeSigner(account.coin.Net(), account.blockNumber),
		Keypath: account.signingConfiguration.AbsoluteKeypath(),
	}, nil
}

// SendTx implements btc.Interface.
func (account *Account) SendTx(
	recipientAddress string,
	amount coin.SendAmount,
	feeTargetCode btc.FeeTargetCode,
	_ map[wire.OutPoint]struct{}) error {
	account.log.Info("Signing and sending transaction")
	txProposal, err := account.newTx(recipientAddress, amount)
	if err != nil {
		return err
	}
	if err := account.keystores.SignTransaction(txProposal); err != nil {
		return err
	}
	return account.coin.client.SendTransaction(context.TODO(), txProposal.Tx)
}

// FeeTargets implements btc.Interface.
func (account *Account) FeeTargets() ([]*btc.FeeTarget, btc.FeeTargetCode) {
	return []*btc.FeeTarget{{Blocks: 2, Code: "low"}}, "low"
}

// TxProposal implements btc.Interface.
func (account *Account) TxProposal(
	recipientAddress string,
	amount coin.SendAmount,
	feeTargetCode btc.FeeTargetCode,
	_ map[wire.OutPoint]struct{}) (coin.Amount, coin.Amount, coin.Amount, error) {

	txProposal, err := account.newTx(recipientAddress, amount)
	if err != nil {
		return coin.Amount{}, coin.Amount{}, coin.Amount{}, err
	}

	value := txProposal.Tx.Value()
	total := new(big.Int).Add(value, txProposal.Fee)
	return coin.NewAmount(value), coin.NewAmount(txProposal.Fee), coin.NewAmount(total), nil
}

// GetUnusedReceiveAddresses implements btc.Interface.
func (account *Account) GetUnusedReceiveAddresses() []coin.Address {
	return []coin.Address{account.address}
}

// VerifyAddress implements btc.Interface.
func (account *Account) VerifyAddress(addressID string) (bool, error) {
	return true, nil
}

// ConvertToLegacyAddress implements btc.Interface.
func (account *Account) ConvertToLegacyAddress(string) (btcutil.Address, error) {
	panic("not used")
}

// Keystores implements btc.Interface.
func (account *Account) Keystores() keystore.Keystores {
	return account.keystores
}

// HeadersStatus implements btc.Interface.
func (account *Account) HeadersStatus() (*headers.Status, error) {
	return nil, nil
}

// SpendableOutputs implements btc.Interface.
func (account *Account) SpendableOutputs() []*btc.SpendableOutput {
	return nil
}
