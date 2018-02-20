package btc

import (
	"errors"
	"log"

	"github.com/btcsuite/btcd/btcec"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/btcsuite/btcutil"
	"github.com/btcsuite/btcutil/hdkeychain"

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

// Event instances are sent to the onEvent callback.
type Event string

const (
	// EventStatusChanged is fired when the status changes. Check the status using Initialized().
	EventStatusChanged Event = "statusChanged"
	// EventSyncStarted is fired when syncing with the blockchain starts. This happens in the very
	// beginning for the initial sync, and repeatedly afterwards when the wallet is updated (new
	// transactions, confirmations, etc.).
	EventSyncStarted Event = "syncstarted"
	// EventSyncDone follows EventSyncStarted.
	EventSyncDone Event = "syncdone"
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
	TxProposal(SendAmount, FeeTargetCode) (
		btcutil.Amount, btcutil.Amount, error)
	GetUnusedReceiveAddress() btcutil.Address
}

// ErrUserAborted is returned when a signing operation is aborted by the user. See
// HDKeyStoreInterface.
var ErrUserAborted = errors.New("aborted")

// HDKeyStoreInterface is the interface needed to sign hashes based on derivations from an xpub.
//go:generate mockery -name HDKeyStoreInterface
type HDKeyStoreInterface interface {
	XPub() *hdkeychain.ExtendedKey
	// Sign signs every hash with a private key at the corresponding keypath.
	// If the user aborts the signing process, ErrUserAborted is returned.
	Sign(hashes [][]byte, keyPaths []string) ([]btcec.Signature, error)
}

// FeeTargetCode is the ID of a fee target. See the FeeTargetCode* constants.x
type FeeTargetCode string

// NewFeeTargetCode checks if the code is valid and returns a FeeTargetCode in that case.
func NewFeeTargetCode(code string) (FeeTargetCode, error) {
	switch code {
	case string(FeeTargetCodeLow):
	case string(FeeTargetCodeEconomy):
	case string(FeeTargetCodeNormal):
	case string(FeeTargetCodeHigh):
	default:
		return "", errp.Newf("unrecognized fee code %s", code)
	}
	return FeeTargetCode(code), nil
}

const (
	// FeeTargetCodeLow is the low priority fee target.
	FeeTargetCodeLow FeeTargetCode = "low"
	// FeeTargetCodeEconomy is the economy priority fee target.
	FeeTargetCodeEconomy = "economy"
	// FeeTargetCodeNormal is the normal priority fee target.
	FeeTargetCodeNormal = "normal"
	// FeeTargetCodeHigh is the high priority fee target.
	FeeTargetCodeHigh = "high"

	defaultFeeTarget = FeeTargetCodeNormal
)

// FeeTarget contains the fee rate for a specific fee target.
type FeeTarget struct {
	// Blocks is the target number of blocks in which the tx should be confirmed.
	Blocks int
	// Code is the identifier for the UI.
	Code FeeTargetCode
	// FeeRatePerKb is the fee rate needed for this target. Can be nil until populated.
	FeeRatePerKb *btcutil.Amount
}

// Wallet is a wallet whose addresses are derived from an xpub.
type Wallet struct {
	locker.Locker

	net        *chaincfg.Params
	keystore   HDKeyStoreInterface
	blockchain blockchain.Interface

	receiveAddresses *addresses.AddressChain
	changeAddresses  *addresses.AddressChain

	transactions *transactions.Transactions

	synchronizer *synchronizer.Synchronizer

	feeTargets []*FeeTarget

	initialSyncDone bool
	onEvent         func(Event)
}

// NewWallet creats a new Wallet.
func NewWallet(
	net *chaincfg.Params,
	keystore HDKeyStoreInterface,
	blockchain blockchain.Interface,
	addressType addresses.AddressType,
	onEvent func(Event),
) (*Wallet, error) {
	xpub := keystore.XPub()
	if xpub.IsPrivate() {
		return nil, errp.New("Extended key is private! Only public keys are accepted")
	}
	if !xpub.IsForNet(net) {
		return nil, errp.New("xpub does not match provided net")
	}
	wallet := &Wallet{
		net:        net,
		keystore:   keystore,
		blockchain: blockchain,

		feeTargets: []*FeeTarget{
			{Blocks: 25, Code: FeeTargetCodeEconomy},
			{Blocks: 10, Code: FeeTargetCodeLow},
			{Blocks: 5, Code: FeeTargetCodeNormal},
			{Blocks: 2, Code: FeeTargetCodeHigh},
		},
		initialSyncDone: false,
		onEvent:         onEvent,
	}
	synchronizer := synchronizer.NewSynchronizer(
		func() { onEvent(EventSyncStarted) },
		func() {
			if !wallet.initialSyncDone {
				wallet.initialSyncDone = true
				onEvent(EventStatusChanged)
			}
			onEvent(EventSyncDone)
		},
	)
	wallet.synchronizer = synchronizer
	wallet.receiveAddresses = addresses.NewAddressChain(
		wallet.keystore.XPub(), net, gapLimit, 0, addressType)
	wallet.changeAddresses = addresses.NewAddressChain(wallet.keystore.XPub(), net, changeGapLimit, 1, addressType)
	wallet.transactions = transactions.NewTransactions(
		net, synchronizer, blockchain)

	return wallet, nil
}

// Init initializes the wallet.
func (wallet *Wallet) Init() {
	wallet.updateFeeTargets()
	wallet.ensureAddresses()
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
	for _, feeTarget := range wallet.feeTargets {
		func(feeTarget *FeeTarget) {
			err := wallet.blockchain.EstimateFee(
				feeTarget.Blocks,
				func(feeRatePerKb btcutil.Amount) error {
					feeTarget.FeeRatePerKb = &feeRatePerKb
					log.Printf("fee estimate per kb for %d blocks: %s", feeTarget.Blocks, feeRatePerKb)
					return nil
				},
				func(err error) {},
			)
			if err != nil {
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
					log.Println("client status should match after sync")
				}
				wallet.transactions.UpdateAddressHistory(address, history)
			}()
			wallet.ensureAddresses()
			return nil
		},
		func(error) { done() },
	)
}

// ensureAddresses is the entry point of syncing up the wallet. It extends the receive and change
// address chains to discover all funds, with respect to the gap limit. In the end, there are
// `gapLimit` unused addresses in the tail. It is also called whenever the status (tx history) of
// changes, to keep the gapLimit tail.
func (wallet *Wallet) ensureAddresses() {
	defer wallet.Lock()()
	syncSequence := func(change bool) error {
		for _, address := range wallet.addresses(change).EnsureAddresses() {
			if err := wallet.subscribeAddress(address); err != nil {
				return err
			}
		}
		return nil
	}
	if err := syncSequence(false); err != nil {
		// TODO
		panic(err)
	}
	if err := syncSequence(true); err != nil {
		// TODO
		panic(err)
	}
}

func (wallet *Wallet) subscribeAddress(address *addresses.Address) error {
	done := wallet.synchronizer.IncRequestsCounter()
	return wallet.blockchain.ScriptHashSubscribe(
		address.ScriptHash(),
		func(status string) error { return wallet.onAddressStatus(address, status) },
		func(error) { done() },
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
	return wallet.receiveAddresses.GetUnused().Address
}
