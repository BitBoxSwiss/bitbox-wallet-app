// Copyright 2018 Shift Devices AG
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package btc

import (
	"fmt"
	"path"
	"sort"

	"github.com/btcsuite/btcd/chaincfg"
	"github.com/btcsuite/btcd/chaincfg/chainhash"
	"github.com/btcsuite/btcd/wire"
	"github.com/btcsuite/btcutil"
	"github.com/btcsuite/btcutil/hdkeychain"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/accounts"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/addresses"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/blockchain"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/db/transactionsdb"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/headers"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/synchronizer"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/transactions"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/coin"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/ltc"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/keystore"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/rates"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/signing"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
	"github.com/digitalbitbox/bitbox-wallet-app/util/locker"
	"github.com/sirupsen/logrus"
)

const (
	gapLimit       = 20
	changeGapLimit = 6
)

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
	keystores               *keystore.Keystores
	getNotifier             func(*signing.Configuration) accounts.Notifier
	notifier                accounts.Notifier
	blockchain              blockchain.Interface

	receiveAddresses AddressChain
	changeAddresses  AddressChain

	transactions *transactions.Transactions

	synchronizer *synchronizer.Synchronizer

	feeTargets []*FeeTarget

	initialized bool
	offline     bool
	fatalError  bool
	onEvent     func(accounts.Event)
	log         *logrus.Entry
	rateUpdater *rates.RateUpdater
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

	// OfflineMode indicates that the connection to the blockchain network could not be established.
	OfflineMode Status = "offlineMode"

	// FatalError indicates that there was a fatal error in handling the account. When this happens,
	// an error is shown to the user and the account is made unusable.
	FatalError Status = "fatalError"
)

// NewAccount creates a new account.
func NewAccount(
	coin *Coin,
	dbFolder string,
	code string,
	name string,
	getSigningConfiguration func() (*signing.Configuration, error),
	keystores *keystore.Keystores,
	getNotifier func(*signing.Configuration) accounts.Notifier,
	onEvent func(accounts.Event),
	log *logrus.Entry,
	rateUpdater *rates.RateUpdater,
) *Account {
	log = log.WithField("group", "btc").
		WithFields(logrus.Fields{"coin": coin.String(), "code": code, "name": name})
	log.Debug("Creating new account")

	account := &Account{
		coin:                    coin,
		dbFolder:                dbFolder,
		code:                    code,
		name:                    name,
		getSigningConfiguration: getSigningConfiguration,
		signingConfiguration:    nil,
		keystores:               keystores,
		getNotifier:             getNotifier,

		// feeTargets must be sorted by ascending priority.
		feeTargets: []*FeeTarget{
			{blocks: 24, code: accounts.FeeTargetCodeEconomy},
			{blocks: 12, code: accounts.FeeTargetCodeLow},
			{blocks: 6, code: accounts.FeeTargetCodeNormal},
			{blocks: 2, code: accounts.FeeTargetCodeHigh},
		},
		// initializing to false, to prevent flashing of offline notification in the frontend
		offline:     false,
		initialized: false,
		onEvent:     onEvent,
		log:         log,
		rateUpdater: rateUpdater,
	}
	account.synchronizer = synchronizer.NewSynchronizer(
		func() { onEvent(accounts.EventSyncStarted) },
		func() {
			if !account.initialized {
				account.initialized = true
				onEvent(accounts.EventStatusChanged)
			}
			onEvent(accounts.EventSyncDone)
		},
		log,
	)
	return account
}

// String returns a representation of the account for logging.
func (account *Account) String() string {
	return fmt.Sprintf("%s-%s", account.Coin().Code(), account.code)
}

// Code returns the code of the account.
func (account *Account) Code() string {
	return account.code
}

// Name returns the name of the account.
func (account *Account) Name() string {
	return account.name
}

// Coin returns the coin of the account.
func (account *Account) Coin() coin.Coin {
	return account.coin
}

// Initialize initializes the account.
func (account *Account) Initialize() error {
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
		account.notifier = account.getNotifier(signingConfiguration)
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
		switch status {
		case blockchain.DISCONNECTED:
			account.log.Warn("Connection to blockchain backend lost")
			account.offline = true
			account.onEvent(accounts.EventStatusChanged)
		case blockchain.CONNECTED:
			// when we have previously been offline, the initial sync status is set back
			// as we need to synchronize with the new backend.
			account.initialized = false
			account.offline = false
			account.onEvent(accounts.EventStatusChanged)
			account.log.Debug("Connection to blockchain backend established")
		default:
			account.log.Panicf("Status %d is unknown.", status)
		}
	}
	account.coin.Initialize()
	account.blockchain = account.coin.Blockchain()
	account.offline = account.blockchain.ConnectionStatus() == blockchain.DISCONNECTED
	if account.offline {
		account.onEvent(accounts.EventStatusChanged)
	}
	account.blockchain.RegisterOnConnectionStatusChangedEvent(onConnectionStatusChanged)

	theHeaders := account.coin.Headers()
	theHeaders.SubscribeEvent(func(event headers.Event) {
		if event == headers.EventSynced {
			account.onEvent(accounts.EventHeadersSynced)
		}
	})
	account.transactions = transactions.NewTransactions(
		account.coin.Net(), account.db, theHeaders, account.synchronizer,
		account.blockchain, account.notifier, account.log)

	fixGapLimit := gapLimit
	fixChangeGapLimit := changeGapLimit
	if account.signingConfiguration.Singlesig() &&
		account.signingConfiguration.ScriptType() == signing.ScriptTypeP2PKH {
		// usually 6, but BWS uses 20, so for legacy accounts, we have to do that too.
		fixChangeGapLimit = 20

		// usually 20, but BWS used to not have any limit. We put it fairly high to cover most
		// outliers.
		fixGapLimit = 60
		account.log.Warning("increased change gap limit to 20 and gap limit to 60 for BWS compatibility")
	}

	if account.signingConfiguration.IsAddressBased() {
		account.receiveAddresses = addresses.NewSingleAddress(
			account.signingConfiguration, account.coin.Net(), account.log)
		account.log.Debug("creating single change address for address based account")
		account.changeAddresses = addresses.NewSingleAddress(
			account.signingConfiguration, account.coin.Net(), account.log)
	} else {
		account.receiveAddresses = addresses.NewAddressChain(
			account.signingConfiguration, account.coin.Net(), fixGapLimit, 0, account.log)
		account.log.Debug("creating change address chain structure")
		account.changeAddresses = addresses.NewAddressChain(
			account.signingConfiguration, account.coin.Net(), fixChangeGapLimit, 1, account.log)
	}
	account.ensureAddresses()
	account.blockchain.HeadersSubscribe(func() func(error) { return func(error) {} }, account.onNewHeader)
	return nil
}

// RateUpdater implements interface
func (account *Account) RateUpdater() *rates.RateUpdater {
	return account.rateUpdater
}

// XPubVersionForScriptType returns the xpub version bytes for the given coin and script type.
func XPubVersionForScriptType(coin *Coin, scriptType signing.ScriptType) [4]byte {
	switch coin.Net().Net {
	case chaincfg.MainNetParams.Net, ltc.MainNetParams.Net:
		versions := map[signing.ScriptType][4]byte{
			signing.ScriptTypeP2PKH:      {0x04, 0x88, 0xb2, 0x1e}, // xpub
			signing.ScriptTypeP2WPKHP2SH: {0x04, 0x9d, 0x7c, 0xb2}, // ypub
			signing.ScriptTypeP2WPKH:     {0x04, 0xb2, 0x47, 0x46}, // zpub
		}
		version, ok := versions[scriptType]
		if !ok {
			return versions[signing.ScriptTypeP2PKH]
		}
		return version
	case chaincfg.TestNet3Params.Net:
		return chaincfg.TestNet3Params.HDPublicKeyID
	case ltc.TestNet4Params.Net:
		return ltc.TestNet4Params.HDPublicKeyID
	default:
		return chaincfg.MainNetParams.HDPublicKeyID
	}
}

// Info returns account info, such as the signing configuration (xpubs).
func (account *Account) Info() *accounts.Info {
	// The internal extended key representation always uses he same version bytes (prefix xpub). We
	// convert it here to the account-specific version (zpub, ypub, tpub, ...).
	xpubs := []*hdkeychain.ExtendedKey{}
	for _, xpub := range account.signingConfiguration.ExtendedPublicKeys() {
		if xpub.IsPrivate() {
			panic("xpub can't be private")
		}
		xpubStr := xpub.String()
		xpubCopy, err := hdkeychain.NewKeyFromString(xpubStr)
		if err != nil {
			panic(err)
		}
		xpubCopy.SetNet(
			&chaincfg.Params{
				HDPublicKeyID: XPubVersionForScriptType(account.
					coin, account.signingConfiguration.ScriptType()),
			},
		)
		xpubs = append(xpubs, xpubCopy)
	}
	return &accounts.Info{
		SigningConfiguration: signing.NewConfiguration(
			account.signingConfiguration.ScriptType(),
			account.signingConfiguration.AbsoluteKeypath(),
			xpubs,
			account.signingConfiguration.Address(),
			account.signingConfiguration.SigningThreshold(),
		),
	}
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

// Initialized indicates whether the account has loaded and finished the initial sync of the
// addresses.
func (account *Account) Initialized() bool {
	return account.initialized
}

// FatalError returns true if the account had a fatal error.
func (account *Account) FatalError() bool {
	// Wait until synchronized, to include server errors without manually dealing with sync status.
	if !account.offline {
		account.synchronizer.WaitSynchronized()
	}
	return account.fatalError
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
	account.initialized = false
	if account.transactions != nil {
		account.transactions.Close()
	}
	account.onEvent(accounts.EventStatusChanged)
}

// Notifier implements accounts.Interface.
func (account *Account) Notifier() accounts.Notifier {
	return account.notifier
}

func (account *Account) updateFeeTargets() {
	defer account.RLock()()
	for _, feeTarget := range account.feeTargets {
		func(feeTarget *FeeTarget) {
			setFee := func(feeRatePerKb btcutil.Amount) {
				defer account.Lock()()
				feeTarget.feeRatePerKb = &feeRatePerKb
				account.log.WithFields(logrus.Fields{"blocks": feeTarget.blocks,
					"fee-rate-per-kb": feeRatePerKb}).Debug("Fee estimate per kb")
				account.onEvent(accounts.EventFeeTargetsChanged)
			}

			account.blockchain.EstimateFee(
				feeTarget.blocks,
				func(feeRatePerKb *btcutil.Amount) error {
					if feeRatePerKb == nil {
						if account.code != "tltc" {
							account.log.WithField("fee-target", feeTarget.blocks).
								Warning("Fee could not be estimated. Taking the minimum relay fee instead")
						}
						account.blockchain.RelayFee(setFee, func(error) {})
						return nil
					}
					setFee(*feeRatePerKb)
					return nil
				},
				func(error) {},
			)
		}(feeTarget)
	}
}

// FeeTargets returns the fee targets and the default fee target.
func (account *Account) FeeTargets() ([]accounts.FeeTarget, accounts.FeeTargetCode) {
	// Return only fee targets with a valid fee rate (drop if fee could not be estimated). Also
	// remove all duplicate fee rates.
	feeTargets := []accounts.FeeTarget{}
	defaultAvailable := false
outer:
	for i := len(account.feeTargets) - 1; i >= 0; i-- {
		feeTarget := account.feeTargets[i]
		if feeTarget.feeRatePerKb == nil {
			continue
		}
		for j := i - 1; j >= 0; j-- {
			checkFeeTarget := account.feeTargets[j]
			if checkFeeTarget.feeRatePerKb != nil && *checkFeeTarget.feeRatePerKb == *feeTarget.feeRatePerKb {
				continue outer
			}
		}
		if feeTarget.code == accounts.DefaultFeeTarget {
			defaultAvailable = true
		}
		feeTargets = append(feeTargets, feeTarget)
	}
	// If the default fee level was dropped, use the cheapest.
	defaultFee := accounts.DefaultFeeTarget
	if !defaultAvailable && len(feeTargets) != 0 {
		defaultFee = feeTargets[0].Code()
	}
	return feeTargets, defaultFee
}

// Balance implements the interface.
func (account *Account) Balance() (*accounts.Balance, error) {
	if account.fatalError {
		return nil, errp.New("can't call Balance() after a fatal error")
	}
	return account.transactions.Balance(), nil
}

func (account *Account) addresses(change bool) AddressChain {
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
				account.transactions.UpdateAddressHistory(address.PubkeyScriptHashHex(), history)
			}()
			account.ensureAddresses()
			return nil
		},
		func(err error) {
			done()
			if err != nil {
				// We are not closing client.blockchain here, as it is reused per coin with
				// different accounts.
				account.fatalError = true
				account.onEvent(accounts.EventStatusChanged)
			}
		},
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
		account.log.WithError(err).Panic(err)
		// TODO
		panic(err)
	}
	if err := syncSequence(true); err != nil {
		account.log.WithError(err).Panic(err)
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
		func() func(error) {
			done := account.synchronizer.IncRequestsCounter()
			return func(err error) {
				done()
				if err != nil {
					panic(err)
				}
			}
		},
		address.PubkeyScriptHashHex(),
		func(status string) error { account.onAddressStatus(address, status); return nil },
	)
	return nil
}

// Transactions wraps transaction.Transactions.Transactions()
func (account *Account) Transactions() ([]accounts.Transaction, error) {
	if account.fatalError {
		return nil, errp.New("can't call Transactions() after a fatal error")
	}
	transactions := account.transactions.Transactions(
		func(scriptHashHex blockchain.ScriptHashHex) bool {
			return account.changeAddresses.LookupByScriptHashHex(scriptHashHex) != nil
		})
	cast := make([]accounts.Transaction, len(transactions))
	for index, transaction := range transactions {
		cast[index] = transaction
	}
	return cast, nil
}

// GetUnusedReceiveAddresses returns a number of unused addresses.
func (account *Account) GetUnusedReceiveAddresses() []accounts.Address {
	account.synchronizer.WaitSynchronized()
	defer account.RLock()()
	account.log.Debug("Get unused receive address")
	addresses := []accounts.Address{}
	if account.signingConfiguration.IsAddressBased() {
		addresses = append(addresses, account.receiveAddresses.GetUnused()[0])
		return addresses
	}
	// Limit to `gapLimit` receive addresses, even if the actual limit is higher when scanning.
	for _, address := range account.receiveAddresses.GetUnused()[:gapLimit] {
		addresses = append(addresses, address)
	}
	return addresses
}

// VerifyAddress verifies a receive address on a keystore. Returns false, nil if no secure output
// exists.
func (account *Account) VerifyAddress(addressID string) (bool, error) {
	if account.signingConfiguration == nil {
		return false, errp.New("account must be initialized")
	}
	account.synchronizer.WaitSynchronized()
	defer account.RLock()()
	scriptHashHex := blockchain.ScriptHashHex(addressID)
	address := account.receiveAddresses.LookupByScriptHashHex(scriptHashHex)
	if address == nil {
		return false, errp.New("unknown address not found")
	}
	canVerifyAddress, _, err := account.Keystores().CanVerifyAddresses(account.signingConfiguration, account.Coin())
	if err != nil {
		return false, err
	}
	if canVerifyAddress {
		return true, account.Keystores().VerifyAddress(address.Configuration, account.Coin())
	}
	return false, nil
}

// CanVerifyAddresses wraps Keystores().CanVerifyAddresses(), see that function for documentation.
func (account *Account) CanVerifyAddresses() (bool, bool, error) {
	if account.signingConfiguration == nil {
		return false, false, errp.New("account must be initialized")
	}
	return account.Keystores().CanVerifyAddresses(account.signingConfiguration, account.Coin())
}

// ConvertToLegacyAddress converts a ltc p2sh address to the legacy format (starting with
// '3'). Returns an error for non litecoin p2sh accounts.
func (account *Account) ConvertToLegacyAddress(addressID string) (btcutil.Address, error) {
	account.synchronizer.WaitSynchronized()
	defer account.RLock()()
	scriptHashHex := blockchain.ScriptHashHex(addressID)
	address := account.receiveAddresses.LookupByScriptHashHex(scriptHashHex)
	if address == nil {
		return nil, errp.New("unknown address not found")
	}
	if account.coin.Net() != &ltc.MainNetParams || address.Configuration.ScriptType() != signing.ScriptTypeP2WPKHP2SH {
		return nil, errp.New("must be an ltc p2sh address")
	}
	hash := address.Address.(*btcutil.AddressScriptHash).Hash160()
	return btcutil.NewAddressScriptHashFromHash(hash[:], &chaincfg.MainNetParams)
}

// Keystores returns the keystores of the account.
func (account *Account) Keystores() *keystore.Keystores {
	return account.keystores
}

type byValue struct {
	outputs []*SpendableOutput
}

func (p *byValue) Len() int { return len(p.outputs) }
func (p *byValue) Less(i, j int) bool {
	if p.outputs[i].TxOut.Value == p.outputs[j].TxOut.Value {
		// Secondary sort to make coin selection deterministic.
		return chainhash.HashH(p.outputs[i].TxOut.PkScript).String() < chainhash.HashH(p.outputs[j].TxOut.PkScript).String()
	}
	return p.outputs[i].TxOut.Value < p.outputs[j].TxOut.Value
}
func (p *byValue) Swap(i, j int) { p.outputs[i], p.outputs[j] = p.outputs[j], p.outputs[i] }

// SpendableOutput is an unspent coin.
type SpendableOutput struct {
	*transactions.SpendableOutput
	OutPoint wire.OutPoint
}

// SpendableOutputs returns the utxo set, sorted by the value descending.
func (account *Account) SpendableOutputs() []*SpendableOutput {
	account.synchronizer.WaitSynchronized()
	defer account.RLock()()
	result := []*SpendableOutput{}
	for outPoint, txOut := range account.transactions.SpendableOutputs() {
		result = append(result, &SpendableOutput{OutPoint: outPoint, SpendableOutput: txOut})
	}
	sort.Sort(sort.Reverse(&byValue{result}))
	return result
}

// CanVerifyExtendedPublicKey returns the indices of the keystores that support secure verification
func (account *Account) CanVerifyExtendedPublicKey() []int {
	return account.Keystores().CanVerifyExtendedPublicKeys()
}

// VerifyExtendedPublicKey verifies an account's public key. Returns false, nil if no secure output exists.
// index is the position of an xpub in the []*hdkeychain which corresponds to the particular keystore in []Keystore
func (account *Account) VerifyExtendedPublicKey(index int) (bool, error) {
	keystore := account.Keystores().Keystores()[index]
	if keystore.CanVerifyExtendedPublicKey() {
		return true, keystore.VerifyExtendedPublicKey(account.Coin(), account.signingConfiguration.AbsoluteKeypath(), account.signingConfiguration)
	}
	return false, nil
}
