package btc

import (
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/btcsuite/btcutil"
	"github.com/sirupsen/logrus"

	"github.com/shiftdevices/godbb/coins/btc/addresses"
	"github.com/shiftdevices/godbb/coins/btc/blockchain"
	"github.com/shiftdevices/godbb/coins/btc/electrum/client"
	"github.com/shiftdevices/godbb/coins/btc/synchronizer"
	"github.com/shiftdevices/godbb/coins/btc/transactions"
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
	GetUnusedReceiveAddress() btcutil.Address
}

// Wallet is a wallet whose addresses are derived from an xpub.
type Wallet struct {
	locker.Locker

	net        *chaincfg.Params
	keyStore   KeyStoreWithoutKeyDerivation
	blockchain blockchain.Interface

	receiveAddresses *addresses.AddressChain
	changeAddresses  *addresses.AddressChain

	transactions *transactions.Transactions

	synchronizer *synchronizer.Synchronizer

	feeTargets []*FeeTarget

	initialSyncDone bool
	onEvent         func(Event)
	logEntry        *logrus.Entry
}

// NewWallet creats a new Wallet.
func NewWallet(
	net *chaincfg.Params,
	keyStore KeyStoreWithoutKeyDerivation,
	blockchain blockchain.Interface,
	addressType addresses.AddressType,
	onEvent func(Event),
	logEntry *logrus.Entry,
) (*Wallet, error) {
	logEntry = logEntry.WithField("group", "btc")
	logEntry.Debug("Creating new wallet")
	xpub := keyStore.XPub()
	xpub.SetNet(net)
	if xpub.IsPrivate() {
		return nil, errp.New("Extended key is private! Only public keys are accepted")
	}
	wallet := &Wallet{
		net:        net,
		keyStore:   keyStore,
		blockchain: blockchain,

		feeTargets: []*FeeTarget{
			{Blocks: 25, Code: FeeTargetCodeEconomy},
			{Blocks: 10, Code: FeeTargetCodeLow},
			{Blocks: 5, Code: FeeTargetCodeNormal},
			{Blocks: 2, Code: FeeTargetCodeHigh},
		},
		initialSyncDone: false,
		onEvent:         onEvent,
		logEntry:        logEntry,
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
		logEntry,
	)
	wallet.receiveAddresses = addresses.NewAddressChain(xpub, net, gapLimit, 0, addressType, logEntry)
	wallet.changeAddresses = addresses.NewAddressChain(xpub, net, changeGapLimit, 1, addressType, logEntry)
	wallet.transactions = transactions.NewTransactions(net, wallet.synchronizer, blockchain, logEntry)

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
	wallet.logEntry.WithField("block-height", header.BlockHeight).Info("Received new header")
	// Fee estimates change with each block.
	wallet.updateFeeTargets()
	return nil
}

// Initialized indicates whether the wallet has loaded and finished the initial sync of the
// addresses.
func (wallet *Wallet) Initialized() bool {
	return wallet.initialSyncDone
}

// Close stops the wallet, including the blockchain connection.
func (wallet *Wallet) Close() {
	wallet.blockchain.Close()
	wallet.initialSyncDone = false
	wallet.onEvent(EventStatusChanged)
}

func (wallet *Wallet) updateFeeTargets() {
	defer wallet.RLock()()
	for _, feeTarget := range wallet.feeTargets {
		func(feeTarget *FeeTarget) {
			err := wallet.blockchain.EstimateFee(
				feeTarget.Blocks,
				func(feeRatePerKb btcutil.Amount) error {
					defer wallet.Lock()()
					feeTarget.FeeRatePerKb = &feeRatePerKb
					wallet.logEntry.WithFields(logrus.Fields{"blocks": feeTarget.Blocks,
						"fee-rate-per-kb": feeRatePerKb}).Info("Fee estimate per kb")
					return nil
				},
				func() {},
			)
			if err != nil {
				wallet.logEntry.WithField("error", err).Panic("Failed to update fee targets")
				// TODO
				panic(err)
			}
		}(feeTarget)
	}
}

// FeeTargets returns the fee targets and the default fee target.
func (wallet *Wallet) FeeTargets() ([]*FeeTarget, FeeTargetCode) {
	return wallet.feeTargets, defaultFeeTarget
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

// onAddressStatus is called when the staytus (tx history) of an address might have changed. It is
// called when the address is initialized, and when the backend notifies us of changes to it. If
// there was indeed change, the tx history is downloaded and processed.
func (wallet *Wallet) onAddressStatus(address *addresses.Address, status string) error {
	if status == address.History.Status() {
		// Address didn't change.
		return nil
	}

	done := wallet.synchronizer.IncRequestsCounter()
	return wallet.blockchain.ScriptHashGetHistory(
		address.ScriptHash(),
		func(history client.TxHistory) error {
			func() {
				defer wallet.Lock()()
				address.History = history
				if address.History.Status() != status {
					wallet.logEntry.Debug("Client status should match after sync")
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
	syncSequence := func(change bool) error {
		for _, address := range wallet.addresses(change).EnsureAddresses() {
			if err := wallet.subscribeAddress(address); err != nil {
				return errp.WithMessage(errp.WithStack(err), "Failed to subscribe to address")
			}
		}
		return nil
	}
	if err := syncSequence(false); err != nil {
		wallet.logEntry.WithField("error", err).Panic(err)
		// TODO
		panic(err)
	}
	if err := syncSequence(true); err != nil {
		wallet.logEntry.WithField("error", err).Panic(err)
		// TODO
		panic(err)
	}
}

func (wallet *Wallet) subscribeAddress(address *addresses.Address) error {
	done := wallet.synchronizer.IncRequestsCounter()
	return wallet.blockchain.ScriptHashSubscribe(
		address.ScriptHash(),
		func(status string) error { return wallet.onAddressStatus(address, status) },
		done,
	)
}

// Transactions wraps transaction.Transactions.Transactions()
func (wallet *Wallet) Transactions() []*transactions.TxInfo {
	return wallet.transactions.Transactions(wallet.changeAddresses.Contains)
}

// GetUnusedReceiveAddress returns a fresh receive address.
func (wallet *Wallet) GetUnusedReceiveAddress() btcutil.Address {
	wallet.synchronizer.WaitSynchronized()
	defer wallet.RLock()()
	wallet.logEntry.Debug("Get unused receive address")
	return wallet.receiveAddresses.GetUnused().Address
}
