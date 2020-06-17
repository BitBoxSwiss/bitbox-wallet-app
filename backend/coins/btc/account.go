// Copyright 2018 Shift Devices AG
// Copyright 2020 Shift Crypto AG
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
	"os"
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
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/maketx"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/synchronizer"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/transactions"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/btc/types"
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
	// receiveAddressesLimit must be <= the receive scan gap limit, otherwise the outputs might not
	// be found.
	receiveAddressesLimit = 20

	// maxGapLimit limits the maximum gap limit that can be used. It is an arbitrary number with the
	// goal that the scanning will stop in a reasonable amount of time.
	maxGapLimit = 2000
)

type subaccount struct {
	signingConfiguration *signing.Configuration
	receiveAddresses     AddressChain
	changeAddresses      AddressChain
}

// Account is a account whose addresses are derived from an xpub.
type Account struct {
	locker.Locker

	coin *Coin
	// folder for all accounts. Full path.
	dbFolder string
	// folder for this specific account. It is a subfolder of dbFolder. Full path.
	dbSubfolder              string
	code                     string
	name                     string
	db                       transactions.DBInterface
	forceGapLimits           *types.GapLimits
	getSigningConfigurations func() (signing.Configurations, error)
	keystores                *keystore.Keystores
	getNotifier              func(signing.Configurations) accounts.Notifier
	notifier                 accounts.Notifier
	blockchain               blockchain.Interface

	subaccounts []subaccount

	transactions *transactions.Transactions

	// if not nil, SendTx() will sign and send this transaction. Set by TxProposal().
	activeTxProposal     *maketx.TxProposal
	activeTxProposalLock locker.Locker

	synchronizer *synchronizer.Synchronizer

	feeTargets []*FeeTarget

	// true when initialized (Initialize() was called).
	initialized bool
	// synced indicates whether the account has loaded and finished the initial sync of the
	// addresses.
	synced      bool
	offline     bool
	fatalError  bool
	onEvent     func(accounts.Event)
	log         *logrus.Entry
	rateUpdater *rates.RateUpdater

	closed     bool
	closedLock locker.Locker
}

// Status indicates the connection and initialization status.
type Status string

const (
	// AccountSynced indicates that the account is synced.
	AccountSynced Status = "accountSynced"

	// AccountDisabled indicates that the account has not yet been initialized.
	AccountDisabled Status = "accountDisabled"

	// OfflineMode indicates that the connection to the blockchain network could not be established.
	OfflineMode Status = "offlineMode"

	// FatalError indicates that there was a fatal error in handling the account. When this happens,
	// an error is shown to the user and the account is made unusable.
	FatalError Status = "fatalError"
)

// NewAccount creates a new account.
// forceGaplimits: if not nil, these limits will be used and persisted for future use.
func NewAccount(
	coin *Coin,
	dbFolder string,
	code string,
	name string,
	forceGapLimits *types.GapLimits,
	getSigningConfigurations func() (signing.Configurations, error),
	keystores *keystore.Keystores,
	getNotifier func(signing.Configurations) accounts.Notifier,
	onEvent func(accounts.Event),
	log *logrus.Entry,
	rateUpdater *rates.RateUpdater,
) *Account {
	log = log.WithField("group", "btc").
		WithFields(logrus.Fields{"coin": coin.String(), "code": code, "name": name})
	log.Debug("Creating new account")

	account := &Account{
		coin:                     coin,
		dbFolder:                 dbFolder,
		dbSubfolder:              "", // set in Initialize()
		code:                     code,
		name:                     name,
		forceGapLimits:           forceGapLimits,
		getSigningConfigurations: getSigningConfigurations,
		keystores:                keystores,
		getNotifier:              getNotifier,

		// feeTargets must be sorted by ascending priority.
		feeTargets: []*FeeTarget{
			{blocks: 24, code: accounts.FeeTargetCodeEconomy},
			{blocks: 12, code: accounts.FeeTargetCodeLow},
			{blocks: 6, code: accounts.FeeTargetCodeNormal},
			{blocks: 2, code: accounts.FeeTargetCodeHigh},
		},
		// initializing to false, to prevent flashing of offline notification in the frontend
		offline:     false,
		synced:      false,
		onEvent:     onEvent,
		log:         log,
		rateUpdater: rateUpdater,
	}
	account.synchronizer = synchronizer.NewSynchronizer(
		func() { onEvent(accounts.EventSyncStarted) },
		func() {
			if !account.synced {
				account.synced = true
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

// Code implements accounts.Interface.
func (account *Account) Code() string {
	return account.code
}

// FilesFolder implements accounts.Interface.
func (account *Account) FilesFolder() string {
	if account.dbSubfolder == "" {
		panic("Initialize() must be run first")
	}
	return account.dbSubfolder
}

// Name implements accounts.Interface.
func (account *Account) Name() string {
	return account.name
}

// Coin implements accounts.Interface.
func (account *Account) Coin() coin.Coin {
	return account.coin
}

// defaultGapLimits returns the default gap limits for this account.
func (account *Account) defaultGapLimits(signingConfiguration *signing.Configuration) types.GapLimits {
	limits := types.GapLimits{
		Receive: 20,
		Change:  6,
	}

	if signingConfiguration.Singlesig() &&
		signingConfiguration.ScriptType() == signing.ScriptTypeP2PKH {
		// Usually 6, but BWS uses 20, so for legacy accounts, we have to do that too.
		// We increase it a bit more as some users still had change buried a bit deeper.
		limits.Change = 25

		// Usually 20, but BWS used to not have any limit. We put it fairly high to cover most
		// outliers.
		limits.Receive = 60
		account.log.Warning("increased change gap limit to 20 and gap limit to 60 for BWS compatibility")
	}

	return limits
}

// gapLimits gets the gap limits as stored in the account configuration, and defaults to
// `defaultGapLimits()` if there is no configuration or the configuration limits are smaller than
// the default limits.
func (account *Account) gapLimits(
	signingConfiguration *signing.Configuration) (types.GapLimits, error) {
	dbTx, err := account.db.Begin()
	if err != nil {
		return types.GapLimits{}, err
	}
	defer dbTx.Rollback()

	if account.forceGapLimits != nil {
		account.log.Infof(
			"persisting gap limits: receive=%d, change=%d",
			account.forceGapLimits.Receive,
			account.forceGapLimits.Change,
		)
		if err := dbTx.PutGapLimits(*account.forceGapLimits); err != nil {
			return types.GapLimits{}, err
		}
		defer func() {
			if err := dbTx.Commit(); err != nil {
				account.log.WithError(err).Error("failed to persist gap limits")
			}
		}()
	}

	defaultLimits := account.defaultGapLimits(signingConfiguration)

	limits, err := dbTx.GapLimits()
	if err != nil {
		return types.GapLimits{}, err
	}
	if limits.Receive < defaultLimits.Receive {
		if account.forceGapLimits != nil { // log only when it's interesting
			account.log.Infof("receive gap limit increased to minimum of %d", defaultLimits.Receive)
		}
		limits.Receive = defaultLimits.Receive
	}
	if limits.Receive > maxGapLimit {
		if account.forceGapLimits != nil { // log only when it's interesting
			account.log.Infof("receive gap limit decreased to maximum of %d", maxGapLimit)
		}
		limits.Receive = maxGapLimit
	}
	if limits.Change < defaultLimits.Change {
		if account.forceGapLimits != nil { // log only when it's interesting
			account.log.Infof("change gap limit increased to minimum of %d", defaultLimits.Change)
		}
		limits.Change = defaultLimits.Change
	}
	if limits.Change > maxGapLimit {
		if account.forceGapLimits != nil { // log only when it's interesting
			account.log.Infof("change gap limit decreased to maximum of %d", maxGapLimit)
		}
		limits.Change = maxGapLimit
	}
	if receiveAddressesLimit > limits.Receive {
		panic("receive address limit must be smaller")
	}
	return limits, nil
}

// Initialize initializes the account.
func (account *Account) Initialize() error {
	if account.isClosed() {
		return errp.New("Initialize: account was closed, init only works once.")
	}
	defer account.Lock()()
	if account.initialized {
		account.log.Debug("Account has already been initialized")
		return nil
	}
	account.initialized = true

	signingConfigurations, err := account.getSigningConfigurations()
	if err != nil {
		return err
	}
	if len(signingConfigurations) == 0 {
		return errp.New("There must be a least one signing configuration")
	}
	account.notifier = account.getNotifier(signingConfigurations)

	accountIdentifier := fmt.Sprintf("account-%s-%s", signingConfigurations.Hash(), account.code)
	account.dbSubfolder = path.Join(account.dbFolder, accountIdentifier)
	if err := os.MkdirAll(account.dbSubfolder, 0700); err != nil {
		return errp.WithStack(err)
	}

	dbName := fmt.Sprintf("%s.db", accountIdentifier)
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
			account.synced = false
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

	// TODO: unified-accounts
	gapLimits, err := account.gapLimits(signingConfigurations[0])
	if err != nil {
		return err
	}

	account.log.Infof("gap limits: receive=%d, change=%d", gapLimits.Receive, gapLimits.Change)

	for _, signingConfiguration := range signingConfigurations {
		signingConfiguration := signingConfiguration

		var subacc subaccount
		subacc.signingConfiguration = signingConfiguration
		if signingConfiguration.IsAddressBased() {
			subacc.receiveAddresses = addresses.NewSingleAddress(
				signingConfiguration, account.coin.Net(), account.log)
			account.log.Debug("creating single change address for address based account")
			subacc.changeAddresses = addresses.NewSingleAddress(
				signingConfiguration, account.coin.Net(), account.log)
		} else {
			subacc.receiveAddresses = addresses.NewAddressChain(
				signingConfiguration, account.coin.Net(), int(gapLimits.Receive), 0, account.log)
			subacc.changeAddresses = addresses.NewAddressChain(
				signingConfiguration, account.coin.Net(), int(gapLimits.Change), 1, account.log)
		}
		account.subaccounts = append(account.subaccounts, subacc)
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
	// TODO unified-accounts
	for _, xpub := range account.subaccounts[0].signingConfiguration.ExtendedPublicKeys() {
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
					coin, account.subaccounts[0].signingConfiguration.ScriptType()),
			},
		)
		xpubs = append(xpubs, xpubCopy)
	}
	return &accounts.Info{
		SigningConfiguration: signing.NewConfiguration(
			account.subaccounts[0].signingConfiguration.ScriptType(),
			account.subaccounts[0].signingConfiguration.AbsoluteKeypath(),
			xpubs,
			account.subaccounts[0].signingConfiguration.Address(),
			account.subaccounts[0].signingConfiguration.SigningThreshold(),
		),
	}
}

func (account *Account) onNewHeader(header *blockchain.Header) error {
	if account.isClosed() {
		account.log.Debug("Ignoring new header after the account was closed")
		return nil
	}
	account.log.WithField("block-height", header.BlockHeight).Debug("Received new header")
	// Fee estimates change with each block.
	account.updateFeeTargets()
	return nil
}

// Offline returns true if the account is disconnected from the blockchain.
func (account *Account) Offline() bool {
	return account.offline
}

// Synced implements accounts.Interface.
func (account *Account) Synced() bool {
	return account.synced
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
	defer account.closedLock.Lock()()
	if account.closed {
		account.log.Debug("account aleady closed")
		return
	}
	account.log.Info("Closed account")
	if account.db != nil {
		if err := account.db.Close(); err != nil {
			account.log.WithError(err).Error("couldn't close db")
		}
		account.log.Info("Closed DB")
	}
	// TODO: deregister from json RPC client. The client can be closed when no account uses
	// the client any longer.
	account.synced = false
	if account.transactions != nil {
		account.transactions.Close()
	}
	account.onEvent(accounts.EventStatusChanged)
	account.closed = true
}

func (account *Account) isClosed() bool {
	defer account.closedLock.RLock()()
	return account.closed
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
				func(feeRatePerKb *btcutil.Amount) {
					if feeRatePerKb == nil {
						if account.coin.Code() != coin.CodeTLTC {
							account.log.WithField("fee-target", feeTarget.blocks).
								Warning("Fee could not be estimated. Taking the minimum relay fee instead")
						}
						account.blockchain.RelayFee(setFee, func(error) {})
					} else {
						setFee(*feeRatePerKb)
					}
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

// onAddressStatus is called when the status (tx history) of an address might have changed. It is
// called when the address is initialized, and when the backend notifies us of changes to it. If
// there was indeed change, the tx history is downloaded and processed.
func (account *Account) onAddressStatus(address *addresses.AccountAddress, status string) {
	if account.isClosed() {
		account.log.Debug("Ignoring result of ScriptHashGetHistory after the account was closed")
		return
	}
	if status == address.HistoryStatus {
		// Address didn't change.
		return
	}

	account.log.Debug("Address status changed, fetching history.")

	done := account.synchronizer.IncRequestsCounter()
	account.blockchain.ScriptHashGetHistory(
		address.PubkeyScriptHashHex(),
		func(history blockchain.TxHistory) {
			if account.isClosed() {
				account.log.Debug("Ignoring result of ScriptHashGetHistory after the account was closed")
				return
			}

			defer account.Lock()()
			address.HistoryStatus = history.Status()
			if address.HistoryStatus != status {
				account.log.Warning("client status should match after sync")
			}
			account.transactions.UpdateAddressHistory(address.PubkeyScriptHashHex(), history)
			account.ensureAddresses()
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
	defer account.synchronizer.IncRequestsCounter()()

	dbTx, err := account.db.Begin()
	if err != nil {
		// TODO
		panic(err)
	}
	defer dbTx.Rollback()

	syncSequence := func(addressChain AddressChain) error {
		for {
			newAddresses := addressChain.EnsureAddresses()
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
	// TODO unified-accounts
	if err := syncSequence(account.subaccounts[0].receiveAddresses); err != nil {
		account.log.WithError(err).Panic(err)
		// TODO
		panic(err)
	}
	if err := syncSequence(account.subaccounts[0].changeAddresses); err != nil {
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
		func(status string) {
			account.onAddressStatus(address, status)
		},
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
			// TODO unified-accounts
			return account.subaccounts[0].changeAddresses.LookupByScriptHashHex(scriptHashHex) != nil
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
	var addresses []accounts.Address
	// TODO unified-accounts
	for idx, address := range account.subaccounts[0].receiveAddresses.GetUnused() {
		if idx >= receiveAddressesLimit {
			// Limit to gap limit for receive addresses, even if the actual limit is higher when
			// scanning.
			break
		}

		addresses = append(addresses, address)
	}
	return addresses
}

// VerifyAddress verifies a receive address on a keystore. Returns false, nil if no secure output
// exists.
func (account *Account) VerifyAddress(addressID string) (bool, error) {
	if !account.initialized {
		return false, errp.New("account must be initialized")
	}
	account.synchronizer.WaitSynchronized()
	defer account.RLock()()
	scriptHashHex := blockchain.ScriptHashHex(addressID)
	// TODO unified-accounts
	address := account.subaccounts[0].receiveAddresses.LookupByScriptHashHex(scriptHashHex)
	if address == nil {
		return false, errp.New("unknown address not found")
	}
	canVerifyAddress, _, err := account.Keystores().CanVerifyAddresses(account.Coin())
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
	if !account.initialized {
		return false, false, errp.New("account must be initialized")
	}
	return account.Keystores().CanVerifyAddresses(account.Coin())
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
		// TODO unified-accounts
		return true, keystore.VerifyExtendedPublicKey(account.Coin(), account.subaccounts[0].signingConfiguration.AbsoluteKeypath(), account.subaccounts[0].signingConfiguration)
	}
	return false, nil
}
