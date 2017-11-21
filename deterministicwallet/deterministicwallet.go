package deterministicwallet

import (
	"bytes"
	"log"
	"math/rand"
	"sync"
	"time"

	"github.com/btcsuite/btcd/btcec"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/btcsuite/btcd/txscript"
	"github.com/btcsuite/btcd/wire"
	"github.com/btcsuite/btcutil"
	"github.com/btcsuite/btcutil/hdkeychain"
	"github.com/davecgh/go-spew/spew"

	"github.com/shiftdevices/godbb/deterministicwallet/addresses"
	"github.com/shiftdevices/godbb/deterministicwallet/blockchain"
	"github.com/shiftdevices/godbb/deterministicwallet/maketx"
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

type SignInterface interface {
	Sign([][]byte, []string) ([]btcec.Signature, error)
}

type HDKeyStoreInterface interface {
	XPub() *hdkeychain.ExtendedKey
	SignInterface
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
	// Synchronous for now. TODO: make async to not block the UI.
	wg := sync.WaitGroup{}
	for _, feeTarget := range wallet.feeTargets {
		func(feeTarget *FeeTarget) {
			wg.Add(1)
			err := wallet.blockchain.EstimateFee(
				feeTarget.Blocks,
				func(feeRatePerKb btcutil.Amount) error {
					feeTarget.FeeRatePerKb = &feeRatePerKb
					log.Printf("fee estimate per kb for %d blocks: %s", feeTarget.Blocks, feeRatePerKb)
					wg.Done()
					return nil
				},
				func(error) {},
			)
			if err != nil {
				// TODO
				panic(err)
			}
		}(feeTarget)
	}
	wg.Wait()
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

// SendTx creates, signs and sends tx which sends `amount` to the recipient.
func (wallet *DeterministicWallet) SendTx(
	recipientAddress string, amount btcutil.Amount, feeTargetCode FeeTargetCode) error {

	var feeTarget *FeeTarget
	for _, target := range wallet.feeTargets {
		if target.Code == feeTargetCode {
			feeTarget = target
			break
		}
	}
	if feeTarget == nil || feeTarget.FeeRatePerKb == nil {
		panic("fee target must exist")
	}

	address, err := btcutil.DecodeAddress(recipientAddress, wallet.net)
	if err != nil {
		return errp.WithStack(err)
	}
	pkScript, err := txscript.PayToAddrScript(address)
	if err != nil {
		return errp.WithStack(err)
	}

	transaction, selectedOutPoints, err := maketx.NewTx(
		wallet.transactions.UnspentOutputs(),
		wire.NewTxOut(int64(amount), pkScript),
		*feeTarget.FeeRatePerKb,
		func() ([]byte, error) {
			return wallet.changeAddresses.GetUnused().PkScript(), nil
		},
		random,
	)
	if err != nil {
		return err
	}
	previousOutputs := make([]*transactions.TxOut, len(selectedOutPoints))
	for i, outPoint := range selectedOutPoints {
		previousOutputs[i] = wallet.transactions.Output(outPoint)
	}
	if err := SignTransaction(wallet.keystore, transaction, previousOutputs); err != nil {
		return err
	}
	rawTX := &bytes.Buffer{}
	_ = transaction.SerializeNoWitness(rawTX)
	return wallet.blockchain.TransactionBroadcast(rawTX.Bytes())
}

// TxFees returns the fee that will be paid for a transaction of a certain amount and fee target.
func (wallet *DeterministicWallet) TxFees(amount btcutil.Amount, feeTargetCode FeeTargetCode) (
	btcutil.Amount, error) {

	var feeTarget *FeeTarget
	for _, target := range wallet.feeTargets {
		if target.Code == feeTargetCode {
			feeTarget = target
			break
		}
	}
	if feeTarget == nil || feeTarget.FeeRatePerKb == nil {
		panic("fee target must exist")
	}

	// Dummy recipient, we won't sent the tx, just return the fee.
	pkScript := wallet.receiveAddresses.GetUnused().PkScript()
	transaction, _, err := maketx.NewTx(
		wallet.transactions.UnspentOutputs(),
		wire.NewTxOut(int64(amount), pkScript),
		*feeTarget.FeeRatePerKb,
		func() ([]byte, error) {
			return wallet.changeAddresses.GetUnused().PkScript(), nil
		},
		random,
	)
	if err != nil {
		return 0, err
	}
	txType, sentAmount, fee := wallet.ClassifyTransaction(transaction)
	if txType != transactions.TxTypeSend || fee == nil {
		spew.Dump(txType, sentAmount, amount, fee)
		panic("wrong tx format")
	}
	return *fee, nil
}
