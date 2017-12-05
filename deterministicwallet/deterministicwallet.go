package deterministicwallet

import (
	"errors"
	"log"
	"math/rand"
	"time"

	"github.com/btcsuite/btcd/btcec"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/btcsuite/btcd/wire"
	"github.com/btcsuite/btcutil"
	"github.com/btcsuite/btcutil/hdkeychain"

	"github.com/shiftdevices/godbb/deterministicwallet/addresses"
	"github.com/shiftdevices/godbb/deterministicwallet/blockchain"
	"github.com/shiftdevices/godbb/deterministicwallet/synchronizer"
	"github.com/shiftdevices/godbb/deterministicwallet/transactions"
	"github.com/shiftdevices/godbb/electrum/client"
	"github.com/shiftdevices/godbb/util/errp"
	"github.com/shiftdevices/godbb/util/locker"
)

const (
	gapLimit       = 20
	changeGapLimit = 6
)

var random *rand.Rand

func init() {
	random = rand.New(rand.NewSource(time.Now().UnixNano()))
}

// Interface is the API of a DeterministicWallet.
type Interface interface {
	Init()
	Close()
	Transactions() []*transactions.Transaction
	ClassifyTransaction(*wire.MsgTx) (
		transactions.TxType, btcutil.Amount, *btcutil.Amount)
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

// DeterministicWallet is a wallet whose addresses are derived from an xpub.
type DeterministicWallet struct {
	locker.Locker

	net        *chaincfg.Params
	keystore   HDKeyStoreInterface
	blockchain blockchain.Interface

	minRelayFee btcutil.Amount

	receiveAddresses *addresses.AddressChain
	changeAddresses  *addresses.AddressChain

	transactions *transactions.Transactions

	synchronizer *synchronizer.Synchronizer

	feeTargets []*FeeTarget

	onEvent func(interface{})
}

// NewDeterministicWallet creats a new DeterministicWallet.
func NewDeterministicWallet(
	net *chaincfg.Params,
	keystore HDKeyStoreInterface,
	blockchain blockchain.Interface,
	onEvent func(interface{}),
) (*DeterministicWallet, error) {
	xpub := keystore.XPub()
	if xpub.IsPrivate() {
		return nil, errp.New("Extended key is private! Only public keys are accepted")
	}
	if !xpub.IsForNet(net) {
		return nil, errp.New("xpub does not match provided net")
	}
	minRelayFee, err := blockchain.RelayFee()
	if err != nil {
		return nil, err
	}
	synchronizer := synchronizer.NewSynchronizer(
		func() { onEvent("syncstarted") },
		func() { onEvent("syncdone") },
	)
	wallet := &DeterministicWallet{
		net:          net,
		keystore:     keystore,
		blockchain:   blockchain,
		minRelayFee:  minRelayFee,
		synchronizer: synchronizer,
		feeTargets: []*FeeTarget{
			{Blocks: 25, Code: FeeTargetCodeEconomy},
			{Blocks: 10, Code: FeeTargetCodeLow},
			{Blocks: 5, Code: FeeTargetCodeNormal},
			{Blocks: 2, Code: FeeTargetCodeHigh},
		},
		onEvent: onEvent,
	}

	wallet.receiveAddresses = addresses.NewAddressChain(wallet.keystore.XPub(), net, gapLimit, 0)
	wallet.changeAddresses = addresses.NewAddressChain(wallet.keystore.XPub(), net, changeGapLimit, 1)
	wallet.transactions = transactions.NewTransactions(
		net, synchronizer, blockchain, wallet.changeAddresses.Contains)

	return wallet, nil
}

// Init initializes the wallet.
func (wallet *DeterministicWallet) Init() {
	wallet.updateFeeTargets()
	wallet.onEvent("initialized")
	wallet.EnsureAddresses()
}

// Close stops the wallet, including the blockchain connection.
func (wallet *DeterministicWallet) Close() {
	wallet.blockchain.Close()
	wallet.onEvent("uninitialized")
}

func (wallet *DeterministicWallet) updateFeeTargets() {
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
func (wallet *DeterministicWallet) FeeTargets() ([]*FeeTarget, FeeTargetCode) {
	return wallet.feeTargets, defaultFeeTarget
}

// Balance wraps transaction.Transactions.Balance()
func (wallet *DeterministicWallet) Balance() *transactions.Balance {
	return wallet.transactions.Balance()
}

func (wallet *DeterministicWallet) addresses(change bool) *addresses.AddressChain {
	if change {
		return wallet.changeAddresses
	}
	return wallet.receiveAddresses
}

// onAddressStatus is called when the status (tx history) of an address might have changed. It is
// called when the address is initialized, and when the backend notifies us of changes to it. If
// there was indeed change, the tx history is downloaded and processed.
func (wallet *DeterministicWallet) onAddressStatus(address *addresses.Address, status string) error {
	if status == address.Status() {
		// Address didn't change.
		return nil
	}

	done := wallet.synchronizer.IncRequestsCounter()
	return wallet.blockchain.ScriptHashGetHistory(
		address.ScriptHash(),
		func(history []*client.TX) error {
			func() {
				defer wallet.RLock()()
				address.History = history
				if address.Status() != status {
					log.Println("client status should match after sync")
				}
				wallet.transactions.UpdateAddressHistory(address, history)
			}()
			wallet.EnsureAddresses()
			return nil
		},
		func(error) { done() },
	)
}

// EnsureAddresses is the entry point of syncing up the wallet. It extends the receive and change
// address chains to discover all funds, with respect to the gap limit. In the end, there are
// `gapLimit` unused addresses in the tail. It is also called whenever the status (tx history) of
// changes, to keep the gapLimit tail.
func (wallet *DeterministicWallet) EnsureAddresses() {
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

func (wallet *DeterministicWallet) subscribeAddress(address *addresses.Address) error {
	done := wallet.synchronizer.IncRequestsCounter()
	return wallet.blockchain.ScriptHashSubscribe(
		address.ScriptHash(),
		func(status string) error { return wallet.onAddressStatus(address, status) },
		func(error) { done() },
	)
}

// Transactions wraps transaction.Transactions.Transactions()
func (wallet *DeterministicWallet) Transactions() []*transactions.Transaction {
	return wallet.transactions.Transactions()
}

// ClassifyTransaction wraps transaction.Transactions.ClassifyTransaction()
func (wallet *DeterministicWallet) ClassifyTransaction(tx *wire.MsgTx) (
	transactions.TxType, btcutil.Amount, *btcutil.Amount) {
	return wallet.transactions.ClassifyTransaction(tx)
}

// GetUnusedReceiveAddress returns a fresh receive address.
func (wallet *DeterministicWallet) GetUnusedReceiveAddress() btcutil.Address {
	defer wallet.RLock()()
	return wallet.receiveAddresses.GetUnused().Address
}
