package btc

import (
	"encoding/json"
	"log"

	"github.com/btcsuite/btcd/chaincfg"
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
	"github.com/shiftdevices/godbb/backend/signing"
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
	Init() error
	Initialized() bool
	Close()
	Transactions() []*transactions.TxInfo
	Balance() *transactions.Balance
	SendTx(string, SendAmount, FeeTargetCode) error
	FeeTargets() ([]*FeeTarget, FeeTargetCode)
	TxProposal(SendAmount, FeeTargetCode) (btcutil.Amount, btcutil.Amount, error)
	GetUnusedReceiveAddress() *addresses.Address
	KeyStore() keystore.Keystore
	HeadersStatus() (*headers.Status, error)
}

// Account is a account whose addresses are derived from an xpub.
type Account struct {
	locker.Locker

	coin                  *Coin
	dbFolder              string
	code                  string
	name                  string
	net                   *chaincfg.Params
	db                    transactions.DBInterface
	accountDerivationPath signing.AbsoluteKeypath
	keyStore              keystore.Keystore
	blockchain            blockchain.Interface

	receiveAddresses *addresses.AddressChain
	changeAddresses  *addresses.AddressChain

	transactions *transactions.Transactions
	headers      headers.Interface
	addressType  addresses.AddressType

	synchronizer *synchronizer.Synchronizer

	feeTargets []*FeeTarget

	initialSyncDone bool
	onEvent         func(Event)
	log             *logrus.Entry
}

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
	net *chaincfg.Params,
	db *transactionsdb.DB,
	accountDerivationPath signing.AbsoluteKeypath,
	keyStore keystore.Keystore,
	addressType addresses.AddressType,
	onEvent func(Event),
	log *logrus.Entry,
) (*Account, error) {
	log = log.WithField("group", "btc")
	log.Debug("Creating new account")

	account := &Account{
		coin:     coin,
		dbFolder: dbFolder,
		code:     code,
		name:     name,
		net:      net,
		db:       db,
		accountDerivationPath: accountDerivationPath,
		keyStore:              keyStore,
		addressType:           addressType,

		// feeTargets must be sorted by ascending priority.
		feeTargets: []*FeeTarget{
			{Blocks: 25, Code: FeeTargetCodeEconomy},
			{Blocks: 10, Code: FeeTargetCodeLow},
			{Blocks: 5, Code: FeeTargetCodeNormal},
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
	return account, nil
}

func (account *Account) Code() string {
	return account.code
}

// Init initializes the acconut.
func (account *Account) Init() error {
	electrumClient, err := account.coin.ElectrumClient()
	if err != nil {
		return err
	}
	account.blockchain = electrumClient

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
		account.net, account.db, account.headers, account.synchronizer, account.blockchain, account.log)

	xpub, err := account.keyStore.ExtendedPublicKey(account.accountDerivationPath)
	if err != nil {
		return errp.WithMessage(err, "Failed to fetch the xPub")
	}
	xpub.SetNet(account.net)

	if xpub.IsPrivate() {
		return errp.New("Extended key is private! Only public keys are accepted")
	}

	account.receiveAddresses = addresses.NewAddressChain(account.accountDerivationPath, xpub, account.net, gapLimit, 0, account.addressType, account.log)
	account.changeAddresses = addresses.NewAddressChain(account.accountDerivationPath, xpub, account.net, changeGapLimit, 1, account.addressType, account.log)

	account.ensureAddresses()
	return account.blockchain.HeadersSubscribe(account.onNewHeader, func() {})
}

func (account *Account) onNewHeader(header *client.Header) error {
	account.log.WithField("block-height", header.BlockHeight).Info("Received new header")
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
	account.initialSyncDone = false
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
					"fee-rate-per-kb": feeRatePerKb}).Info("Fee estimate per kb")
				account.onEvent(EventFeeTargetsChanged)
				return nil
			}

			err := account.blockchain.EstimateFee(
				feeTarget.Blocks,
				func(feeRatePerKb *btcutil.Amount) error {
					if feeRatePerKb == nil {
						account.log.WithField("fee-target", feeTarget.Blocks).
							Warning("Fee could not be estimated. Taking the minimum relay fee instead")
						return account.blockchain.RelayFee(setFee, func() {})
					}
					return setFee(*feeRatePerKb)
				},
				func() {},
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
func (account *Account) onAddressStatus(address *addresses.Address, status string) error {
	if status == address.HistoryStatus {
		// Address didn't change.
		return nil
	}

	account.log.Info("Address status changed, fetching history.")

	done := account.synchronizer.IncRequestsCounter()
	return account.blockchain.ScriptHashGetHistory(
		address.ScriptHashHex(),
		func(history client.TxHistory) error {
			func() {
				defer account.Lock()()
				address.HistoryStatus = history.Status()
				if address.HistoryStatus != status {
					log.Println("client status should match after sync")
				}
				account.transactions.UpdateAddressHistory(address, history)
			}()
			account.ensureAddresses()
			return nil
		},
		done,
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
	dbTx transactions.DBTxInterface, address *addresses.Address) error {
	addressHistory, err := dbTx.AddressHistory(address)
	if err != nil {
		return err
	}
	address.HistoryStatus = addressHistory.Status()

	done := account.synchronizer.IncRequestsCounter()
	return account.blockchain.ScriptHashSubscribe(
		address.ScriptHashHex(),
		func(status string) error { return account.onAddressStatus(address, status) },
		done,
	)
}

// Transactions wraps transaction.Transactions.Transactions()
func (account *Account) Transactions() []*transactions.TxInfo {
	return account.transactions.Transactions(
		func(scriptHashHex client.ScriptHashHex) bool {
			return account.changeAddresses.LookupByScriptHashHex(scriptHashHex) != nil
		})
}

// GetUnusedReceiveAddress returns a fresh receive address.
func (account *Account) GetUnusedReceiveAddress() *addresses.Address {
	account.synchronizer.WaitSynchronized()
	defer account.RLock()()
	account.log.Debug("Get unused receive address")
	return account.receiveAddresses.GetUnused()
}

// KeyStore returns the key store of the account.
func (account *Account) KeyStore() keystore.Keystore {
	return account.keyStore
}

// HeadersStatus returns the status of the headers.
func (account *Account) HeadersStatus() (*headers.Status, error) {
	return account.headers.Status()
}
