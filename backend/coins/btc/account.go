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
	InitialSyncDone() bool
	KeystoreAvailable() bool
	Offline() bool
	Close()
	Transactions() []*transactions.TxInfo
	Balance() *transactions.Balance
	SendTx(string, SendAmount, FeeTargetCode) error
	FeeTargets() ([]*FeeTarget, FeeTargetCode)
	TxProposal(string, SendAmount, FeeTargetCode) (
		btcutil.Amount, btcutil.Amount, btcutil.Amount, error)
	GetUnusedReceiveAddresses() []*addresses.AccountAddress
	VerifyAddress(blockchain.ScriptHashHex) (bool, error)
	Keystores() keystore.Keystores
	HeadersStatus() (*headers.Status, error)
}

// Account is a account whose addresses are derived from an xpub.
type Account struct {
	locker.Locker

	coin                    *Coin
	dbFolder                string
	code                    string
	name                    string
	db                      transactions.DBInterface
	getSigningConfiguration func() (*signing.Configuration, error)
	signingConfiguration    *signing.Configuration
	keystores               keystore.Keystores
	blockchain              blockchain.Interface

	receiveAddresses *addresses.AddressChain
	changeAddresses  *addresses.AddressChain

	transactions *transactions.Transactions
	headers      headers.Interface

	synchronizer *synchronizer.Synchronizer

	feeTargets []*FeeTarget

	initialSyncDone   bool
	offline           bool
	keystoreAvailable bool
	onEvent           func(Event)
	log               *logrus.Entry
}

// MarshalJSON implements json.Marshaler.
func (account *Account) MarshalJSON() ([]byte, error) {
	return json.Marshal(struct {
		CoinCode              string `json:"coinCode"`
		Code                  string `json:"code"`
		Name                  string `json:"name"`
		BlockExplorerTxPrefix string `json:"blockExplorerTxPrefix"`
	}{
		CoinCode: account.coin.Name(),
		Code:     account.code,
		Name:     account.name,
		BlockExplorerTxPrefix: account.coin.blockExplorerTxPrefix,
	})
}

// Status indicates the connection and initialization status.
type Status string

const (
	// AccountSynced indicates that the account is synced.
	AccountSynced Status = "accountSynced"

	// AccountNotSynced indicates that the account is initialized, but not yet fully synced.
	AccountNotSynced Status = "accountNotSynced"

	// AccountDisabled indicates that the account has not yet been initialized.
	AccountDisabled Status = "accountDisabled"

	// KeystoreAvailable indicates that whether the hardware wallet is plugged in.
	KeystoreAvailable Status = "keystoreAvailable"

	// OfflineMode indicates that the connection to the blockchain network could not be established.
	OfflineMode Status = "offlineMode"
)

// NewAccount creats a new Account.
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
	log = log.WithField("group", "btc").
		WithFields(logrus.Fields{"coin": coin.String(), "code": code, "name": name})
	log.Debug("Creating new account")

	account := &Account{
		coin:     coin,
		dbFolder: dbFolder,
		code:     code,
		name:     name,
		getSigningConfiguration: getSigningConfiguration,
		signingConfiguration:    nil,
		keystores:               keystores,

		// feeTargets must be sorted by ascending priority.
		feeTargets: []*FeeTarget{
			{Blocks: 24, Code: FeeTargetCodeEconomy},
			{Blocks: 12, Code: FeeTargetCodeLow},
			{Blocks: 6, Code: FeeTargetCodeNormal},
			{Blocks: 2, Code: FeeTargetCodeHigh},
		},
		// initializing to false, to prevent flashing of offline notification in the frontend
		offline:           false,
		keystoreAvailable: true,
		initialSyncDone:   false,
		onEvent:           onEvent,
		log:               log,
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
	dbName := fmt.Sprintf("account-%s-%s.db", account.signingConfiguration.Hash(), account.code)
	account.log.Debugf("Opening the database '%s' to persist the transactions.", dbName)
	db, err := transactionsdb.NewDB(path.Join(account.dbFolder, dbName))
	if err != nil {
		return err
	}
	account.db = db
	account.log.Debugf("Opened the database '%s' to persist the transactions.", dbName)

	onConnectionStatusChanged := func(status blockchain.Status) {
		if status == blockchain.DISCONNECTED {
			account.log.Warn("Connection to blockchain backend lost")
			account.offline = true
			account.onEvent(EventStatusChanged)
		} else if status == blockchain.CONNECTED {
			// when we have previously been offline, the initial sync status is set back
			// as we need to synchronize with the new backend.
			account.initialSyncDone = false
			account.offline = false
			account.onEvent(EventStatusChanged)

			account.log.Debug("Connection to blockchain backend established")

		} else {
			account.log.Panicf("Status %d is unknown.", status)
		}
	}
	account.blockchain = account.coin.Blockchain()
	account.offline = account.blockchain.ConnectionStatus() == blockchain.DISCONNECTED
	account.onEvent(EventStatusChanged)
	account.blockchain.RegisterOnConnectionStatusChangedEvent(onConnectionStatusChanged)

	theHeaders := account.coin.Headers()
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
		account.signingConfiguration, account.coin.Net(), gapLimit, 0, account.log)

	fixChangeGapLimit := changeGapLimit
	if account.signingConfiguration.Singlesig() && account.signingConfiguration.ScriptType() == signing.ScriptTypeP2PKH {
		// usually 6, but BWS uses 20, so for legacy accounts, we have to do that too.
		account.log.Warning("increased change gap limit to 20 for BWS compatibility")
		fixChangeGapLimit = 20
	}
	account.log.Debug("creating change address chain structure")
	account.changeAddresses = addresses.NewAddressChain(
		account.signingConfiguration, account.coin.Net(), fixChangeGapLimit, 1, account.log)
	account.ensureAddresses()
	account.blockchain.HeadersSubscribe(func() func() { return func() {} }, account.onNewHeader)
	return nil
}

func (account *Account) onNewHeader(header *blockchain.Header) error {
	account.log.WithField("block-height", header.BlockHeight).Debug("Received new header")
	// Fee estimates change with each block.
	account.updateFeeTargets()
	return nil
}

// Offline returns true if the account is disconnected from the blockchain.
func (account *Account) Offline() bool {
	return account.offline
}

// KeystoreAvailable returns true if the keystore is available (e.g. BitBox is plugged in)
func (account *Account) KeystoreAvailable() bool {
	return account.keystoreAvailable
}

// InitialSyncDone indicates whether the account has loaded and finished the initial sync of the
// addresses.
func (account *Account) InitialSyncDone() bool {
	return account.initialSyncDone
}

// Close stops the account.
func (account *Account) Close() {
	account.log.Info("Closed account")
	if account.db != nil {
		if err := account.db.Close(); err != nil {
			account.log.WithError(err).Error("couldn't close db")
		}
		account.log.Info("Closed DB")
	}
	// TODO: deregister from json RPC client. The client can be closed when no account uses
	// the client any longer.
	account.initialSyncDone = false
	account.keystoreAvailable = false
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

			account.blockchain.EstimateFee(
				feeTarget.Blocks,
				func(feeRatePerKb *btcutil.Amount) error {
					if feeRatePerKb == nil {
						if account.code != "tltc" {
							account.log.WithField("fee-target", feeTarget.Blocks).
								Warning("Fee could not be estimated. Taking the minimum relay fee instead")
						}
						account.blockchain.RelayFee(setFee, func() {})
						return nil
					}
					return setFee(*feeRatePerKb)
				},
				func() {},
			)
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
func (account *Account) onAddressStatus(address *addresses.AccountAddress, status string) {
	if status == address.HistoryStatus {
		// Address didn't change.
		return
	}

	account.log.Debug("Address status changed, fetching history.")

	done := account.synchronizer.IncRequestsCounter()
	account.blockchain.ScriptHashGetHistory(
		address.PubkeyScriptHashHex(),
		func(history blockchain.TxHistory) error {
			func() {
				defer account.Lock()()
				address.HistoryStatus = history.Status()
				if address.HistoryStatus != status {
					account.log.Warning("client status should match after sync")
				}
				err := account.transactions.UpdateAddressHistory(address.PubkeyScriptHashHex(), history)
				if err != nil {
					account.log.WithField("error", err).Error("Updating address history failed")
					// connection errors are handled in the backend client ()
					account.Close()
				}
			}()
			account.ensureAddresses()
			return nil
		},
		func() { done() },
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

	account.blockchain.ScriptHashSubscribe(
		account.synchronizer.IncRequestsCounter,
		address.PubkeyScriptHashHex(),
		func(status string) error { account.onAddressStatus(address, status); return nil },
	)
	return nil
}

// Transactions wraps transaction.Transactions.Transactions()
func (account *Account) Transactions() []*transactions.TxInfo {
	return account.transactions.Transactions(
		func(scriptHashHex blockchain.ScriptHashHex) bool {
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
func (account *Account) VerifyAddress(scriptHashHex blockchain.ScriptHashHex) (bool, error) {
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
