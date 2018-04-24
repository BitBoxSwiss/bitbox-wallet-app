package btc

import (
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

// Interface is the API of a Wallet.
type Interface interface {
	Init()
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

// Wallet is a wallet whose addresses are derived from an xpub.
type Wallet struct {
	locker.Locker

	net        *chaincfg.Params
	db         transactions.DBInterface
	keyStore   keystore.Keystore
	blockchain blockchain.Interface

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

// Status indicates the connection and initialization status.
type Status string

const (
	// Initialized indicates that the wallet is synced.
	Initialized Status = "initialized"

	// Connected indicates that the connection to the blockchain node is established, but the wallet
	// is not yet fully synced.
	Connected Status = "connected"

	// Disconnected indicates that the connection to the blockchain node could not be established or
	// is lost.
	Disconnected Status = "disconnected"
)

// NewWallet creats a new Wallet.
func NewWallet(
	net *chaincfg.Params,
	db *transactionsdb.DB,
	walletDerivationPath signing.AbsoluteKeypath,
	keyStore keystore.Keystore,
	blockchain blockchain.Interface,
	theHeaders headers.Interface,
	addressType addresses.AddressType,
	onEvent func(Event),
	log *logrus.Entry,
) (*Wallet, error) {
	log = log.WithField("group", "btc")
	log.Debug("Creating new wallet")

	xpub, err := keyStore.ExtendedPublicKey(walletDerivationPath)
	if err != nil {
		return nil, errp.WithMessage(err, "Failed to fetch the xPub")
	}
	xpub.SetNet(net)

	if xpub.IsPrivate() {
		return nil, errp.New("Extended key is private! Only public keys are accepted")
	}
	wallet := &Wallet{
		net:        net,
		db:         db,
		keyStore:   keyStore,
		blockchain: blockchain,

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
	wallet.synchronizer = synchronizer.NewSynchronizer(
		func() { onEvent(EventSyncStarted) },
		func() {
			if !wallet.initialSyncDone {
				wallet.initialSyncDone = true
				onEvent(EventStatusChanged)
			}
			onEvent(EventSyncDone)
		},
		log,
	)
	wallet.receiveAddresses = addresses.NewAddressChain(walletDerivationPath, xpub, net, gapLimit, 0, addressType, log)
	wallet.changeAddresses = addresses.NewAddressChain(walletDerivationPath, xpub, net, changeGapLimit, 1, addressType, log)
	wallet.headers = theHeaders
	wallet.headers.SubscribeEvent(func(event headers.Event) {
		if event == headers.EventSynced {
			onEvent(EventHeadersSynced)
		}
	})
	wallet.transactions = transactions.NewTransactions(
		net, wallet.db, wallet.headers, wallet.synchronizer, blockchain, log)
	return wallet, nil
}

// Init initializes the wallet.
func (wallet *Wallet) Init() {
	wallet.ensureAddresses()
	if err := wallet.blockchain.HeadersSubscribe(
		wallet.onNewHeader,
		func() {},
	); err != nil {
		// TODO
		panic(err)
	}
}

func (wallet *Wallet) onNewHeader(header *client.Header) error {
	wallet.log.WithField("block-height", header.BlockHeight).Info("Received new header")
	// Fee estimates change with each block.
	wallet.updateFeeTargets()
	return nil
}

// Initialized indicates whether the wallet has loaded and finished the initial sync of the
// addresses.
func (wallet *Wallet) Initialized() bool {
	return wallet.initialSyncDone
}

// Close stops the wallet.
func (wallet *Wallet) Close() {
	wallet.initialSyncDone = false
	wallet.onEvent(EventStatusChanged)
}

func (wallet *Wallet) updateFeeTargets() {
	defer wallet.RLock()()
	for _, feeTarget := range wallet.feeTargets {
		func(feeTarget *FeeTarget) {
			setFee := func(feeRatePerKb btcutil.Amount) error {
				defer wallet.Lock()()
				feeTarget.FeeRatePerKb = &feeRatePerKb
				wallet.log.WithFields(logrus.Fields{"blocks": feeTarget.Blocks,
					"fee-rate-per-kb": feeRatePerKb}).Info("Fee estimate per kb")
				wallet.onEvent(EventFeeTargetsChanged)
				return nil
			}

			err := wallet.blockchain.EstimateFee(
				feeTarget.Blocks,
				func(feeRatePerKb *btcutil.Amount) error {
					if feeRatePerKb == nil {
						wallet.log.WithField("fee-target", feeTarget.Blocks).
							Warning("Fee could not be estimated. Taking the minimum relay fee instead")
						return wallet.blockchain.RelayFee(setFee, func() {})
					}
					return setFee(*feeRatePerKb)
				},
				func() {},
			)
			if err != nil {
				wallet.log.WithField("error", err).Error("Failed to update fee targets")
			}
		}(feeTarget)
	}
}

// FeeTargets returns the fee targets and the default fee target.
func (wallet *Wallet) FeeTargets() ([]*FeeTarget, FeeTargetCode) {
	// Return only fee targets with a valid fee rate (drop if fee could not be estimated). Also
	// remove all duplicate fee rates.
	feeTargets := []*FeeTarget{}
	defaultAvailable := false
outer:
	for i := len(wallet.feeTargets) - 1; i >= 0; i-- {
		feeTarget := wallet.feeTargets[i]
		if feeTarget.FeeRatePerKb == nil {
			continue
		}
		for j := i - 1; j >= 0; j-- {
			checkFeeTarget := wallet.feeTargets[j]
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
func (wallet *Wallet) Balance() *transactions.Balance {
	return wallet.transactions.Balance()
}

func (wallet *Wallet) addresses(change bool) *addresses.AddressChain {
	if change {
		return wallet.changeAddresses
	}
	return wallet.receiveAddresses
}

// onAddressStatus is called when the status (tx history) of an address might have changed. It is
// called when the address is initialized, and when the backend notifies us of changes to it. If
// there was indeed change, the tx history is downloaded and processed.
func (wallet *Wallet) onAddressStatus(address *addresses.Address, status string) error {
	if status == address.HistoryStatus {
		// Address didn't change.
		return nil
	}

	wallet.log.Info("Address status changed, fetching history.")

	done := wallet.synchronizer.IncRequestsCounter()
	return wallet.blockchain.ScriptHashGetHistory(
		address.ScriptHashHex(),
		func(history client.TxHistory) error {
			func() {
				defer wallet.Lock()()
				address.HistoryStatus = history.Status()
				if address.HistoryStatus != status {
					log.Println("client status should match after sync")
				}
				wallet.transactions.UpdateAddressHistory(address, history)
			}()
			wallet.ensureAddresses()
			return nil
		},
		done,
	)
}

// ensureAddresses is the entry point of syncing up the wallet. It extends the receive and change
// address chains to discover all funds, with respect to the gap limit. In the end, there are
// `gapLimit` unused addresses in the tail. It is also called whenever the status (tx history) of
// changes, to keep the gapLimit tail.
func (wallet *Wallet) ensureAddresses() {
	defer wallet.Lock()()
	defer wallet.synchronizer.IncRequestsCounter()()

	dbTx, err := wallet.db.Begin()
	if err != nil {
		// TODO
		panic(err)
	}
	defer dbTx.Rollback()

	syncSequence := func(change bool) error {
		for {
			newAddresses := wallet.addresses(change).EnsureAddresses()
			if len(newAddresses) == 0 {
				break
			}
			for _, address := range newAddresses {
				if err := wallet.subscribeAddress(dbTx, address); err != nil {
					return errp.Wrap(err, "Failed to subscribe to address")
				}
			}
		}
		return nil
	}
	if err := syncSequence(false); err != nil {
		wallet.log.WithField("error", err).Panic(err)
		// TODO
		panic(err)
	}
	if err := syncSequence(true); err != nil {
		wallet.log.WithField("error", err).Panic(err)
		// TODO
		panic(err)
	}
}

func (wallet *Wallet) subscribeAddress(
	dbTx transactions.DBTxInterface, address *addresses.Address) error {
	addressHistory, err := dbTx.AddressHistory(address)
	if err != nil {
		return err
	}
	address.HistoryStatus = addressHistory.Status()

	done := wallet.synchronizer.IncRequestsCounter()
	return wallet.blockchain.ScriptHashSubscribe(
		address.ScriptHashHex(),
		func(status string) error { return wallet.onAddressStatus(address, status) },
		done,
	)
}

// Transactions wraps transaction.Transactions.Transactions()
func (wallet *Wallet) Transactions() []*transactions.TxInfo {
	return wallet.transactions.Transactions(
		func(scriptHashHex client.ScriptHashHex) bool {
			return wallet.changeAddresses.LookupByScriptHashHex(scriptHashHex) != nil
		})
}

// GetUnusedReceiveAddress returns a fresh receive address.
func (wallet *Wallet) GetUnusedReceiveAddress() *addresses.Address {
	wallet.synchronizer.WaitSynchronized()
	defer wallet.RLock()()
	wallet.log.Debug("Get unused receive address")
	return wallet.receiveAddresses.GetUnused()
}

// KeyStore returns the key store of the wallet.
func (wallet *Wallet) KeyStore() keystore.Keystore {
	return wallet.keyStore
}

// HeadersStatus returns the status of the headers.
func (wallet *Wallet) HeadersStatus() (*headers.Status, error) {
	return wallet.headers.Status()
}
