package btc

import (
	"encoding/json"
	"fmt"
	"path"

	"github.com/shiftdevices/godbb/backend/signing"

	"github.com/btcsuite/btcutil"
	"github.com/sirupsen/logrus"

	"github.com/shiftdevices/godbb/backend/coins/btc/addresses"
	"github.com/shiftdevices/godbb/backend/coins/btc/blockchain"
	"github.com/shiftdevices/godbb/backend/coins/btc/electrum/client"
	"github.com/shiftdevices/godbb/backend/coins/btc/headers"
	"github.com/shiftdevices/godbb/backend/coins/btc/synchronizer"
	"github.com/shiftdevices/godbb/backend/coins/btc/transactions"
	"github.com/shiftdevices/godbb/backend/db/transactionsdb"
	"github.com/shiftdevices/godbb/backend/keystore"
	"github.com/shiftdevices/godbb/util/errp"
	"github.com/shiftdevices/godbb/util/locker"
)

const (
	gapLimit       = 20
	changeGapLimit = 6
)

// Interface is the API of a Account.
type Interface interface {
	Code() string
	Coin() *Coin
	Init() error
	Initialized() bool
	Close()
	Transactions() []*transactions.TxInfo
	Balance() *transactions.Balance
	SendTx(string, SendAmount, FeeTargetCode) error
	FeeTargets() ([]*FeeTarget, FeeTargetCode)
	TxProposal(string, SendAmount, FeeTargetCode) (
		btcutil.Amount, btcutil.Amount, btcutil.Amount, error)
	GetUnusedReceiveAddresses() []*addresses.AccountAddress
	VerifyAddress(client.ScriptHashHex) (bool, error)
	Keystores() keystore.Keystores
	HeadersStatus() (*headers.Status, error)
}

// Account is a account whose addresses are derived from an xpub.
type Account struct {
	locker.Locker

	coin             *Coin
	dbFolder         string
	code             string
	name             string
	db               transactions.DBInterface
	getConfiguration func() (*signing.Configuration, error)
	configuration    *signing.Configuration
	keystores        keystore.Keystores
	blockchain       blockchain.Interface

	receiveAddresses *addresses.AddressChain
	changeAddresses  *addresses.AddressChain

	transactions *transactions.Transactions
	headers      headers.Interface

	synchronizer *synchronizer.Synchronizer

	feeTargets []*FeeTarget

	initialSyncDone bool
	onEvent         func(Event)
	log             *logrus.Entry
}

// MarshalJSON implements json.Marshaler.
func (account *Account) MarshalJSON() ([]byte, error) {
	return json.Marshal(struct {
		Code                  string `json:"code"`
		Name                  string `json:"name"`
		BlockExplorerTxPrefix string `json:"blockExplorerTxPrefix"`
	}{
		Code: account.code,
		Name: account.name,
		BlockExplorerTxPrefix: account.coin.blockExplorerTxPrefix,
	})
}

// Status indicates the connection and initialization status.
type Status string

const (
	// Initialized indicates that the account is synced.
	Initialized Status = "initialized"

	// Connected indicates that the connection to the blockchain node is established, but the account
	// is not yet fully synced.
	Connected Status = "connected"

	// Disconnected indicates that the connection to the blockchain node could not be established or
	// is lost.
	Disconnected Status = "disconnected"
)

// NewAccount creats a new Account.
func NewAccount(
	coin *Coin,
	dbFolder string,
	code string,
	name string,
	getConfiguration func() (*signing.Configuration, error),
	keystores keystore.Keystores,
	onEvent func(Event),
	log *logrus.Entry,
) *Account {
	log = log.WithField("group", "btc").
		WithFields(logrus.Fields{"coin": coin.String(), "code": code, "name": name})
	log.Debug("Creating new account")

	account := &Account{
		coin:             coin,
		dbFolder:         dbFolder,
		code:             code,
		name:             name,
		getConfiguration: getConfiguration,
		keystores:        keystores,

		// feeTargets must be sorted by ascending priority.
		feeTargets: []*FeeTarget{
			{Blocks: 24, Code: FeeTargetCodeEconomy},
			{Blocks: 12, Code: FeeTargetCodeLow},
			{Blocks: 6, Code: FeeTargetCodeNormal},
			{Blocks: 2, Code: FeeTargetCodeHigh},
		},
		initialSyncDone: false,
		onEvent:         onEvent,
		log:             log,
	}
	account.synchronizer = synchronizer.NewSynchronizer(
		func() { onEvent(EventSyncStarted) },
		func() {
			if !account.initialSyncDone {
				account.initialSyncDone = true
				onEvent(EventStatusChanged)
			}
			onEvent(EventSyncDone)
		},
		log,
	)
	return account
}

// String returns a representation of the account for logging.
func (account *Account) String() string {
	return fmt.Sprintf("%s-%s", account.Coin().String(), account.code)
}

// Code returns the code of the account.
func (account *Account) Code() string {
	return account.code
}

// Coin returns the coin of the account.
func (account *Account) Coin() *Coin {
	return account.coin
}

// Init initializes the account.
func (account *Account) Init() error {
	alreadyInitialized, err := func() (bool, error) {
		defer account.Lock()()
		if account.configuration != nil {
			// Already initialized.
			return true, nil
		}
		configuration, err := account.getConfiguration()
		if err != nil {
			return false, err
		}
		account.configuration = configuration
		return false, nil
	}()
	if err != nil {
		return err
	}
	if alreadyInitialized {
		return nil
	}
	dbName := fmt.Sprintf("account-%s-%s.db", account.configuration.Hash(), account.code)
	account.log.Debugf("Using the database '%s' to persist the transactions.", dbName)
	db, err := transactionsdb.NewDB(path.Join(account.dbFolder, dbName))
	if err != nil {
		return err
	}
	account.db = db

	account.log.Debug("getting electrum client")
	electrumClient, err := account.coin.ElectrumClient()
	if err != nil {
		return err
	}
	account.blockchain = electrumClient

	account.log.Debug("getting headers")
	theHeaders, err := account.coin.GetHeaders(account.dbFolder)
	if err != nil {
		return err
	}
	account.headers = theHeaders
	account.headers.SubscribeEvent(func(event headers.Event) {
		if event == headers.EventSynced {
			account.onEvent(EventHeadersSynced)
		}
	})
	account.transactions = transactions.NewTransactions(
		account.coin.Net(), account.db, account.headers, account.synchronizer,
		account.blockchain, account.log)

	account.receiveAddresses = addresses.NewAddressChain(
		account.configuration, account.coin.Net(), gapLimit, 0, account.log)

	fixChangeGapLimit := changeGapLimit
	if account.configuration.Singlesig() && account.configuration.ScriptType() == signing.ScriptTypeP2PKH {
		// usually 6, but BWS uses 20, so for legacy accounts, we have to do that too.
		account.log.Warning("increased change gap limit to 20 for BWS compatibility")
		fixChangeGapLimit = 20
	}
	account.changeAddresses = addresses.NewAddressChain(
		account.configuration, account.coin.Net(), fixChangeGapLimit, 1, account.log)
	account.ensureAddresses()
	return account.blockchain.HeadersSubscribe(account.onNewHeader, func(error) {})
}

func (account *Account) onNewHeader(header *client.Header) error {
	account.log.WithField("block-height", header.BlockHeight).Debug("Received new header")
	// Fee estimates change with each block.
	account.updateFeeTargets()
	return nil
}

// Initialized indicates whether the account has loaded and finished the initial sync of the
// addresses.
func (account *Account) Initialized() bool {
	return account.initialSyncDone
}

// Close stops the account.
func (account *Account) Close() {
	if account.db != nil {
		if err := account.db.Close(); err != nil {
			account.log.WithError(err).Error("couldn't close db")
		}
	}
	account.initialSyncDone = false
	if account.transactions != nil {
		account.transactions.Close()
	}
	account.onEvent(EventStatusChanged)
}

func (account *Account) updateFeeTargets() {
	defer account.RLock()()
	for _, feeTarget := range account.feeTargets {
		func(feeTarget *FeeTarget) {
			setFee := func(feeRatePerKb btcutil.Amount) error {
				defer account.Lock()()
				feeTarget.FeeRatePerKb = &feeRatePerKb
				account.log.WithFields(logrus.Fields{"blocks": feeTarget.Blocks,
					"fee-rate-per-kb": feeRatePerKb}).Debug("Fee estimate per kb")
				account.onEvent(EventFeeTargetsChanged)
				return nil
			}

			err := account.blockchain.EstimateFee(
				feeTarget.Blocks,
				func(feeRatePerKb *btcutil.Amount) error {
					if feeRatePerKb == nil {
						if account.code != "tltc" {
							account.log.WithField("fee-target", feeTarget.Blocks).
								Warning("Fee could not be estimated. Taking the minimum relay fee instead")
						}
						return account.blockchain.RelayFee(setFee, func(error) {})
					}
					return setFee(*feeRatePerKb)
				},
				func(error) {},
			)
			if err != nil {
				account.log.WithField("error", err).Error("Failed to update fee targets")
			}
		}(feeTarget)
	}
}

// FeeTargets returns the fee targets and the default fee target.
func (account *Account) FeeTargets() ([]*FeeTarget, FeeTargetCode) {
	// Return only fee targets with a valid fee rate (drop if fee could not be estimated). Also
	// remove all duplicate fee rates.
	feeTargets := []*FeeTarget{}
	defaultAvailable := false
outer:
	for i := len(account.feeTargets) - 1; i >= 0; i-- {
		feeTarget := account.feeTargets[i]
		if feeTarget.FeeRatePerKb == nil {
			continue
		}
		for j := i - 1; j >= 0; j-- {
			checkFeeTarget := account.feeTargets[j]
			if checkFeeTarget.FeeRatePerKb != nil && *checkFeeTarget.FeeRatePerKb == *feeTarget.FeeRatePerKb {
				continue outer
			}
		}
		if feeTarget.Code == defaultFeeTarget {
			defaultAvailable = true
		}
		feeTargets = append(feeTargets, feeTarget)
	}
	// If the default fee level was dropped, use the cheapest.
	defaultFee := defaultFeeTarget
	if !defaultAvailable && len(feeTargets) != 0 {
		defaultFee = feeTargets[0].Code
	}
	return feeTargets, defaultFee
}

// Balance wraps transaction.Transactions.Balance()
func (account *Account) Balance() *transactions.Balance {
	return account.transactions.Balance()
}

func (account *Account) addresses(change bool) *addresses.AddressChain {
	if change {
		return account.changeAddresses
	}
	return account.receiveAddresses
}

// onAddressStatus is called when the status (tx history) of an address might have changed. It is
// called when the address is initialized, and when the backend notifies us of changes to it. If
// there was indeed change, the tx history is downloaded and processed.
func (account *Account) onAddressStatus(address *addresses.AccountAddress, status string) error {
	if status == address.HistoryStatus {
		// Address didn't change.
		return nil
	}

	account.log.Debug("Address status changed, fetching history.")

	done := account.synchronizer.IncRequestsCounter()
	return account.blockchain.ScriptHashGetHistory(
		address.PubkeyScriptHashHex(),
		func(history client.TxHistory) error {
			func() {
				defer account.Lock()()
				address.HistoryStatus = history.Status()
				if address.HistoryStatus != status {
					account.log.Warning("client status should match after sync")
				}
				account.transactions.UpdateAddressHistory(address.PubkeyScriptHashHex(), history)
			}()
			account.ensureAddresses()
			return nil
		},
		func(error) { done() },
	)
}

// ensureAddresses is the entry point of syncing up the account. It extends the receive and change
// address chains to discover all funds, with respect to the gap limit. In the end, there are
// `gapLimit` unused addresses in the tail. It is also called whenever the status (tx history) of
// changes, to keep the gapLimit tail.
func (account *Account) ensureAddresses() {
	defer account.Lock()()
	defer account.synchronizer.IncRequestsCounter()()

	dbTx, err := account.db.Begin()
	if err != nil {
		// TODO
		panic(err)
	}
	defer dbTx.Rollback()

	syncSequence := func(change bool) error {
		for {
			newAddresses := account.addresses(change).EnsureAddresses()
			if len(newAddresses) == 0 {
				break
			}
			for _, address := range newAddresses {
				if err := account.subscribeAddress(dbTx, address); err != nil {
					return errp.Wrap(err, "Failed to subscribe to address")
				}
			}
		}
		return nil
	}
	if err := syncSequence(false); err != nil {
		account.log.WithField("error", err).Panic(err)
		// TODO
		panic(err)
	}
	if err := syncSequence(true); err != nil {
		account.log.WithField("error", err).Panic(err)
		// TODO
		panic(err)
	}
}

func (account *Account) subscribeAddress(
	dbTx transactions.DBTxInterface, address *addresses.AccountAddress) error {
	addressHistory, err := dbTx.AddressHistory(address.PubkeyScriptHashHex())
	if err != nil {
		return err
	}
	address.HistoryStatus = addressHistory.Status()

	done := account.synchronizer.IncRequestsCounter()
	return account.blockchain.ScriptHashSubscribe(
		address.PubkeyScriptHashHex(),
		func(status string) error { return account.onAddressStatus(address, status) },
		func(error) { done() },
	)
}

// Transactions wraps transaction.Transactions.Transactions()
func (account *Account) Transactions() []*transactions.TxInfo {
	return account.transactions.Transactions(
		func(scriptHashHex client.ScriptHashHex) bool {
			return account.changeAddresses.LookupByScriptHashHex(scriptHashHex) != nil
		})
}

// GetUnusedReceiveAddresses returns a number of unused addresses.
func (account *Account) GetUnusedReceiveAddresses() []*addresses.AccountAddress {
	account.synchronizer.WaitSynchronized()
	defer account.RLock()()
	account.log.Debug("Get unused receive address")
	return account.receiveAddresses.GetUnused()
}

// VerifyAddress verifies a receive address on a keystore. Returns false, nil if no secure output
// exists.
func (account *Account) VerifyAddress(scriptHashHex client.ScriptHashHex) (bool, error) {
	account.synchronizer.WaitSynchronized()
	defer account.RLock()()
	address := account.receiveAddresses.LookupByScriptHashHex(scriptHashHex)
	if address == nil {
		return false, errp.New("unknown address not found")
	}
	if account.Keystores().HaveSecureOutput() {
		return true, account.Keystores().OutputAddress(address.Configuration, account.Coin())
	}
	return false, nil
}

// Keystores returns the keystores of the account.
func (account *Account) Keystores() keystore.Keystores {
	return account.keystores
}

// HeadersStatus returns the status of the headers.
func (account *Account) HeadersStatus() (*headers.Status, error) {
	return account.headers.Status()
}
