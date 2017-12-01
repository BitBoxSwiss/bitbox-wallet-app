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

type Interface interface {
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

var ErrUserAborted = errors.New("aborted")

type HDKeyStoreInterface interface {
	XPub() *hdkeychain.ExtendedKey
	// Sign signs every hash with a private key at the corresponding keypath.
	// If the user aborts the signing process, ErrUserAborted is returned.
	Sign(hashes [][]byte, keyPaths []string) ([]btcec.Signature, error)
}

type FeeTargetCode string

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
	FeeTargetCodeLow     FeeTargetCode = "low"
	FeeTargetCodeEconomy               = "economy"
	FeeTargetCodeNormal                = "normal"
	FeeTargetCodeHigh                  = "high"

	defaultFeeTarget = FeeTargetCodeNormal
)

type FeeTarget struct {
	// Blocks is the target number of blocks in which the tx should be confirmed.
	Blocks int
	// Code is the identifier for the UI.
	Code FeeTargetCode
	// FeeRatePerKb is the fee rate needed for this target. Can be nil until populated.
	FeeRatePerKb *btcutil.Amount
}

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

	// The
	feeTargets []*FeeTarget
}

func NewDeterministicWallet(
	net *chaincfg.Params,
	keystore HDKeyStoreInterface,
	blockchain blockchain.Interface,
	onSyncStarted func(),
	onSyncFinished func(),
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
	synchronizer := synchronizer.NewSynchronizer(onSyncStarted, onSyncFinished)
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
	}

	wallet.receiveAddresses = addresses.NewAddressChain(wallet.keystore.XPub(), gapLimit, 0)
	wallet.changeAddresses = addresses.NewAddressChain(wallet.keystore.XPub(), changeGapLimit, 1)
	wallet.transactions = transactions.NewTransactions(
		net, synchronizer, blockchain, wallet.changeAddresses.Contains)

	wallet.updateFeeTargets()

	return wallet, nil
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

func (wallet *DeterministicWallet) FeeTargets() ([]*FeeTarget, FeeTargetCode) {
	return wallet.feeTargets, defaultFeeTarget
}

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

// addAddress adds a new address to the wallet and subscribes to changes to it (see
// onAddressStatus).
func (wallet *DeterministicWallet) addAddress(change bool) error {
	address := wallet.addresses(change).AddAddress(wallet.net)
	done := wallet.synchronizer.IncRequestsCounter()
	return wallet.blockchain.ScriptHashSubscribe(
		address.ScriptHash(),
		func(status string) error { return wallet.onAddressStatus(address, status) },
		func(error) { done() },
	)
}

// EnsureAddresses is the entry point of syncing up the wallet. It extends the receive and change
// address chains to discover all funds, with respect to the gap limit. In the end, there are
// `gapLimit` unused addresses in the tail. It is also called whenever the status (tx history) of
// changes, to keep the gapLimit tail.
func (wallet *DeterministicWallet) EnsureAddresses() {
	defer wallet.Lock()()
	if err := wallet.ensureAddresses(); err != nil {
		// TODO
		panic(err)
	}
}

func (wallet *DeterministicWallet) ensureAddresses() error {
	// TODO: move into addresses.AddressChain
	syncSequence := func(change bool, gapLimit int) error {
		unusedAddressCount := wallet.addresses(change).UnusedTailCount()
		for i := 0; i < gapLimit-unusedAddressCount; i++ {
			if err := wallet.addAddress(change); err != nil {
				return err
			}
		}
		return nil
	}
	if err := syncSequence(false, gapLimit); err != nil {
		return err
	}
	return syncSequence(true, changeGapLimit)
}

func (wallet *DeterministicWallet) Transactions() []*transactions.Transaction {
	return wallet.transactions.Transactions()
}

func (wallet *DeterministicWallet) ClassifyTransaction(tx *wire.MsgTx) (
	transactions.TxType, btcutil.Amount, *btcutil.Amount) {
	return wallet.transactions.ClassifyTransaction(tx)
}

func (wallet *DeterministicWallet) GetUnusedReceiveAddress() btcutil.Address {
	return wallet.receiveAddresses.GetUnused().Address
}
