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
	"encoding/base64"
	"fmt"
	"net/http"
	"os"
	"path"
	"sort"
	"sync/atomic"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	accountsTypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/types"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/bitsurance"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/addresses"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/blockchain"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/db/transactionsdb"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/headers"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/maketx"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/transactions"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/types"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/ltc"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/signing"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/util"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/locker"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/observable"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/observable/action"
	electrumTypes "github.com/BitBoxSwiss/block-client-go/electrum/types"
	"github.com/btcsuite/btcd/btcutil"
	"github.com/btcsuite/btcd/btcutil/hdkeychain"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/btcsuite/btcd/wire"
	"github.com/sirupsen/logrus"
)

const (
	// receiveAddressesLimit must be <= the receive scan gap limit, otherwise the outputs might not
	// be found.
	receiveAddressesLimit = 20

	// maxGapLimit limits the maximum gap limit that can be used. It is an arbitrary number with the
	// goal that the scanning will stop in a reasonable amount of time.
	maxGapLimit = 2000

	// mempoolSpaceMirror is Shift server that mirrors "https://mempool.space/api/v1/fees/recommended"
	// rest call.
	mempoolSpaceMirror = "https://fees1.shiftcrypto.io"
)

type subaccount struct {
	signingConfiguration *signing.Configuration
	receiveAddresses     *addresses.AddressChain
	changeAddresses      *addresses.AddressChain
}

type subaccounts []subaccount

func (sa subaccounts) signingConfigurations() signing.Configurations {
	result := signing.Configurations{}
	for _, subacc := range sa {
		result = append(result, subacc.signingConfiguration)
	}
	return result
}

// Account is a account whose addresses are derived from an xpub.
type Account struct {
	*accounts.BaseAccount

	coin *Coin
	// folder for this specific account. It is a subfolder of dbFolder. Full path.
	dbSubfolder    string
	db             transactions.DBInterface
	forceGapLimits *types.GapLimits
	notifier       accounts.Notifier

	// Once the account is initialized, this variable is only read.
	subaccounts subaccounts
	// How many addresses were synced already during the initial sync. This value is emitted as an
	// event when it changes. This counter can overshoot if an address is updated more than once
	// during initial sync (e.g. if there is a tx touching it). This should be rare and have no bad
	// consequence, as the counter is only used to display absolute progress in the frontend. If you
	// need an accurate count of addresses synced, this should probably be turned into a map (set)
	// instead.
	syncedAddressesCount uint32

	transactions *transactions.Transactions

	// if not nil, SendTx() will sign and send this transaction. Set by TxProposal().
	activeTxProposal     *maketx.TxProposal
	activeTxProposalLock locker.Locker

	// Access this only via getMinRelayFeeRate(). sat/kB.
	minRelayFeeRate     *btcutil.Amount
	minRelayFeeRateLock locker.Locker

	// true when initialized (Initialize() was called).
	initialized     bool
	initializedLock locker.Locker

	fatalError atomic.Bool

	closed bool

	log *logrus.Entry

	httpClient *http.Client
}

// NewAccount creates a new account.
//
// forceGaplimits: if not nil, these limits will be used and persisted for future use.
func NewAccount(
	config *accounts.AccountConfig,
	coin *Coin,
	forceGapLimits *types.GapLimits,
	log *logrus.Entry,
	httpClient *http.Client,
) *Account {
	log = log.WithField("group", "btc").
		WithFields(logrus.Fields{"coin": coin.String(), "code": config.Config.Code, "name": config.Config.Name})
	log.Debug("Creating new account")

	account := &Account{
		BaseAccount:    accounts.NewBaseAccount(config, coin, log),
		coin:           coin,
		dbSubfolder:    "", // set in Initialize()
		forceGapLimits: forceGapLimits,

		log:        log,
		httpClient: httpClient,
	}
	return account
}

// String returns a representation of the account for logging.
func (account *Account) String() string {
	return fmt.Sprintf("%s-%s", account.Coin().Code(), account.Config().Config.Code)
}

// FilesFolder implements accounts.Interface.
func (account *Account) FilesFolder() string {
	if account.dbSubfolder == "" {
		panic("Initialize() must be run first")
	}
	return account.dbSubfolder
}

// defaultGapLimits returns the default gap limits for this account.
func (account *Account) defaultGapLimits(signingConfiguration *signing.Configuration) types.GapLimits {
	limits := types.GapLimits{
		Receive: 20,
		Change:  6,
	}

	if signingConfiguration.ScriptType() == signing.ScriptTypeP2PKH {
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
//
// The default gap limits can be different for each subaccount (e.g. legacy script type needs a
// higher gap limit), but if the gap limits are forced and stored (user wants higher gap limits),
// one set of gap limits is used for all subaccounts for simplicity.
func (account *Account) gapLimits(
	signingConfiguration *signing.Configuration) (types.GapLimits, error) {
	if account.forceGapLimits != nil {
		account.log.Infof(
			"persisting gap limits: receive=%d, change=%d",
			account.forceGapLimits.Receive,
			account.forceGapLimits.Change,
		)
		err := transactions.DBUpdate(account.db, func(dbTx transactions.DBTxInterface) error {
			return dbTx.PutGapLimits(*account.forceGapLimits)
		})
		if err != nil {
			return types.GapLimits{}, err
		}
	}

	defaultLimits := account.defaultGapLimits(signingConfiguration)

	return transactions.DBView(account.db, func(dbTx transactions.DBTxInterface) (types.GapLimits, error) {
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
	})
}

// getMinRelayFeeRate fetches the min relay fee from the server and returns it. The value is cached
// so that subsequent calls are instant. This is important as this function can be called many times
// in succession when validating tx proposals.
func (account *Account) getMinRelayFeeRate() (btcutil.Amount, error) {
	defer account.minRelayFeeRateLock.Lock()()
	cached := account.minRelayFeeRate
	if cached != nil {
		return *cached, nil
	}

	feeRate, err := account.coin.Blockchain().RelayFee()
	if err != nil {
		return 0, err
	}
	account.minRelayFeeRate = &feeRate
	account.log.Infof("min relay fee rate: %s", feeRate)
	return feeRate, nil
}

func (account *Account) isInitialized() bool {
	defer account.initializedLock.RLock()()
	return account.initialized
}

// Initialize initializes the account.
func (account *Account) Initialize() error {
	// Early returns that do not require a write-lock.
	if account.isClosed() {
		return errp.New("Initialize: account was closed, init only works once.")
	}
	if account.isInitialized() {
		return nil
	}

	defer account.initializedLock.Lock()()
	if account.closed {
		return errp.New("Initialize: account was closed, init only works once.")
	}
	if account.initialized {
		return nil
	}
	account.initialized = true

	signingConfigurations := account.Config().Config.SigningConfigurations
	if len(signingConfigurations) == 0 {
		return errp.New("There must be a least one signing configuration")
	}
	account.notifier = account.Config().GetNotifier(signingConfigurations)

	accountIdentifier := fmt.Sprintf("account-%s", account.Config().Config.Code)
	account.dbSubfolder = path.Join(account.Config().DBFolder, accountIdentifier)
	if err := os.MkdirAll(account.dbSubfolder, 0700); err != nil {
		return errp.WithStack(err)
	}

	dbName := fmt.Sprintf("%s.db", accountIdentifier)
	account.log.Debugf("Opening the database '%s' to persist the transactions.", dbName)
	db, err := transactionsdb.NewDB(path.Join(account.Config().DBFolder, dbName))
	if err != nil {
		return err
	}
	account.db = db
	account.log.Debugf("Opened the database '%s' to persist the transactions.", dbName)

	onConnectionStatusChanged := func(err error) {
		if err != nil {
			account.log.WithError(err).Warn("Connection to blockchain backend lost")
			account.SetOffline(err)
		} else {
			// when we have previously been offline, the initial sync status is set back
			// as we need to synchronize with the new backend.
			account.ResetSynced()
			account.SetOffline(nil)
			account.minRelayFeeRate = nil
			account.log.Debug("Connection to blockchain backend established")
		}
	}
	account.coin.Initialize()
	account.SetOffline(account.coin.Blockchain().ConnectionError())
	account.coin.Blockchain().RegisterOnConnectionErrorChangedEvent(onConnectionStatusChanged)
	theHeaders := account.coin.Headers()
	theHeaders.SubscribeEvent(func(event headers.Event) {
		if event == headers.EventSynced {
			account.Config().OnEvent(accountsTypes.EventHeadersSynced)
		}
	})
	account.transactions = transactions.NewTransactions(
		account.coin.Net(), account.db, theHeaders, account.Synchronizer,
		account.coin.Blockchain(), account.notifier, account.log)

	for _, signingConfiguration := range signingConfigurations {
		signingConfiguration := signingConfiguration

		var subacc subaccount
		subacc.signingConfiguration = signingConfiguration
		gapLimits, err := account.gapLimits(signingConfiguration)
		if err != nil {
			return err
		}
		account.log.Infof("gap limits: receive=%d, change=%d", gapLimits.Receive, gapLimits.Change)

		subacc.receiveAddresses = addresses.NewAddressChain(
			signingConfiguration, account.coin.Net(), int(gapLimits.Receive), 0, account.isAddressUsed, account.log)
		subacc.changeAddresses = addresses.NewAddressChain(
			signingConfiguration, account.coin.Net(), int(gapLimits.Change), 1, account.isAddressUsed, account.log)

		account.subaccounts = append(account.subaccounts, subacc)
	}
	account.ensureAddresses()
	account.coin.Blockchain().HeadersSubscribe(account.onNewHeader)

	return account.BaseAccount.Initialize(accountIdentifier)
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

// Info returns account info, such as the signing configuration (xpubs). Returns nil if the account
// is not initialized.
func (account *Account) Info() *accounts.Info {
	if !account.isInitialized() {
		return nil
	}
	// The internal extended key representation always uses the same version bytes (prefix xpub). We
	// convert it here to the account-specific version (zpub, ypub, tpub, ...).
	isInsuredAccount := account.Config().Config.InsuranceStatus == string(bitsurance.ActiveStatus)
	var signingConfigurations []*signing.Configuration
	for _, subacc := range account.subaccounts {
		isNativeSegwit := subacc.signingConfiguration.ScriptType() == signing.ScriptTypeP2WPKH
		// hiding legacy/taproot xpubs as an insured account should only receive on native segwit.
		if isInsuredAccount && !isNativeSegwit {
			continue
		}
		xpub := subacc.signingConfiguration.ExtendedPublicKey()
		if xpub.IsPrivate() {
			panic("xpub can't be private")
		}
		xpubCopy, err := hdkeychain.NewKeyFromString(xpub.String())
		if err != nil {
			panic(err)
		}
		xpubCopy.SetNet(
			&chaincfg.Params{
				HDPublicKeyID: XPubVersionForScriptType(
					account.coin, subacc.signingConfiguration.ScriptType()),
			},
		)
		signingConfiguration := signing.NewBitcoinConfiguration(
			subacc.signingConfiguration.ScriptType(),
			subacc.signingConfiguration.BitcoinSimple.KeyInfo.RootFingerprint,
			subacc.signingConfiguration.AbsoluteKeypath(),
			xpubCopy,
		)
		signingConfigurations = append(signingConfigurations, signingConfiguration)
	}
	return &accounts.Info{
		SigningConfigurations: signingConfigurations,
	}
}

func (account *Account) onNewHeader(header *electrumTypes.Header) {
	if account.isClosed() {
		account.log.Debug("Ignoring new header after the account was closed")
		return
	}
	account.log.WithField("block-height", header.Height).Debug("Received new header")
}

// FatalError returns true if the account had a fatal error.
func (account *Account) FatalError() bool {
	return account.fatalError.Load()
}

// Close stops the account.
func (account *Account) Close() {
	defer account.initializedLock.Lock()()
	if account.closed {
		account.log.Debug("account aleady closed")
		return
	}
	account.BaseAccount.Close()
	account.log.Info("Closed account")
	// TODO: deregister from json RPC client. The client can be closed when no account uses
	// the client any longer.
	account.ResetSynced()
	if account.transactions != nil {
		account.transactions.Close()
	}

	if account.db != nil {
		if err := account.db.Close(); err != nil {
			account.log.WithError(err).Error("couldn't close db")
		}
		account.log.Info("Closed DB")
	}

	account.Config().OnEvent(accountsTypes.EventStatusChanged)
	account.closed = true
}

func (account *Account) isClosed() bool {
	defer account.initializedLock.RLock()()
	return account.closed
}

// Notifier implements accounts.Interface.
func (account *Account) Notifier() accounts.Notifier {
	return account.notifier
}

// feeTargets fetches the available fees. For mainnet BTC it uses mempool.space estimation.
//
// For the other coins or in case mempool.space is not available it fallbacks on Bitcoin Core.
// The minimum relay fee is used as a last resource fallback in case also Bitcoin Core is
// unavailable.
func (account *Account) feeTargets() []*FeeTarget {
	// for mainnet BTC we fetch mempool.space fees, as they should be more reliable.
	var mempoolFees *accounts.MempoolSpaceFees
	if account.coin.Code() == coin.CodeBTC {
		mempoolFees = &accounts.MempoolSpaceFees{}
		_, err := util.APIGet(account.httpClient, mempoolSpaceMirror, "", 1000, mempoolFees)
		if err != nil {
			mempoolFees = nil
			account.log.WithError(err).Errorf("Fetching fees from %s failed", mempoolSpaceMirror)
		}
	}

	// feeTargets must be sorted by ascending priority.
	var feeTargets []*FeeTarget
	if mempoolFees != nil {
		feeTargets = []*FeeTarget{
			{blocks: 12, code: accounts.FeeTargetCodeMempoolEconomy},
			{blocks: 3, code: accounts.FeeTargetCodeMempoolHour},
			{blocks: 2, code: accounts.FeeTargetCodeMempoolHalfHour},
			{blocks: 1, code: accounts.FeeTargetCodeMempoolFastest},
		}
	} else {
		feeTargets = []*FeeTarget{
			{blocks: 24, code: accounts.FeeTargetCodeEconomy},
			{blocks: 12, code: accounts.FeeTargetCodeLow},
			{blocks: 6, code: accounts.FeeTargetCodeNormal},
			{blocks: 2, code: accounts.FeeTargetCodeHigh},
		}
	}

	var minRelayFeeRate *btcutil.Amount
	minRelayFeeRateVal, err := account.getMinRelayFeeRate()
	if err == nil {
		minRelayFeeRate = &minRelayFeeRateVal
	}

	for _, feeTarget := range feeTargets {
		var feeRatePerKb btcutil.Amount

		if mempoolFees != nil {
			feeRatePerKb = mempoolFees.GetFeeRate(feeTarget.code)
		} else {
			// If mempool.space fees are not available, we fallback on Bitcoin Core estimation.
			// If even that one is not available, we just offer the min relay fee.
			feeRatePerKb, err = account.coin.Blockchain().EstimateFee(feeTarget.blocks)
			if err != nil {
				if account.coin.Code() != coin.CodeTLTC {
					account.log.WithField("fee-target", feeTarget.blocks).
						Warning("Fee could not be estimated. Taking the minimum relay fee instead")
				}
				if minRelayFeeRate == nil {
					account.log.WithField("fee-target", feeTarget.blocks).
						Warning("Minimum relay fee could not be determined")
					continue
				}
				feeRatePerKb = *minRelayFeeRate
			}
		}
		// If the minrelayfee is available the estimated fee rate is smaller than the minrelayfee,
		// we use the minrelayfee instead. If the minrelayfee is unknown, we leave the fee
		// estimation as is, hoping it will be enough for a transaction to get relayed.
		if minRelayFeeRate != nil && feeRatePerKb < *minRelayFeeRate {
			feeRatePerKb = *minRelayFeeRate
		}
		feeTarget.feeRatePerKb = &feeRatePerKb
		account.log.WithFields(logrus.Fields{"blocks": feeTarget.blocks,
			"fee-rate-per-kb": feeRatePerKb}).Debug("Fee estimate per kb")
	}

	return feeTargets
}

// FeeTargets returns the fee targets and the default fee target.
func (account *Account) FeeTargets() ([]accounts.FeeTarget, accounts.FeeTargetCode) {
	// Return only fee targets with a valid fee rate (drop if fee could not be estimated).
	fetchedFeeTargets := account.feeTargets()
	feeTargets := []accounts.FeeTarget{}
	defaultFee := accounts.FeeTargetCodeCustom

	for _, feeTarget := range fetchedFeeTargets {
		if feeTarget.feeRatePerKb == nil {
			continue
		}

		switch feeTarget.code {
		case accounts.DefaultFeeTarget:
			fallthrough
		case accounts.DefaultMempoolFeeTarget:
			defaultFee = feeTarget.code
		}
		feeTargets = append(feeTargets, feeTarget)
	}
	// If the default fee level was dropped, use the cheapest.
	// If no fee targets are available, use custom (the user can manually enter a fee rate).
	if defaultFee == accounts.FeeTargetCodeCustom {
		if len(feeTargets) != 0 {
			defaultFee = feeTargets[0].Code()
		}
	}
	return feeTargets, defaultFee
}

// Balance implements the interface.
func (account *Account) Balance() (*accounts.Balance, error) {
	if account.fatalError.Load() {
		return nil, errp.New("can't call Balance() after a fatal error")
	}
	balance, err := account.transactions.Balance()
	if err != nil {
		// TODO
		panic(err)
	}
	return balance, nil
}

func (account *Account) incAndEmitSyncCounter() {
	if !account.Synced() {
		synced := atomic.AddUint32(&account.syncedAddressesCount, 1)
		account.Notify(observable.Event{
			Subject: fmt.Sprintf("account/%s/synced-addresses-count", account.Config().Config.Code),
			Action:  action.Replace,
			Object:  synced,
		})
	}
}

func (account *Account) getAddressHistory(address *addresses.AccountAddress) (blockchain.TxHistory, error) {
	return transactions.DBView(account.db, func(dbTx transactions.DBTxInterface) (blockchain.TxHistory, error) {
		return dbTx.AddressHistory(address.PubkeyScriptHashHex())
	})
}

func (account *Account) isAddressUsed(address *addresses.AccountAddress) (bool, error) {
	history, err := account.getAddressHistory(address)
	if err != nil {
		return false, err
	}
	return len(history) > 0, nil
}

// onAddressStatus is called when the status (tx history) of an address might have changed. It is
// called when the address is initialized, and when the backend notifies us of changes to it. If
// there was indeed change, the tx history is downloaded and processed.
func (account *Account) onAddressStatus(address *addresses.AccountAddress, status string) {
	if account.isClosed() {
		account.log.Debug("Ignoring result of ScriptHashSubscribe after the account was closed")
		return
	}
	addressHistory, err := account.getAddressHistory(address)
	if err != nil {
		if account.isClosed() {
			account.log.WithError(err).Error("stopping sync because account was closed")
			return
		}
		// TODO
		account.log.WithError(err).Panic("getAddressHistory failed")
	}
	if status == addressHistory.Status() {
		account.incAndEmitSyncCounter()
		// Address didn't change.  Note: there is a potential race condition where to concurrent
		// onAddressStatus calls with the same `status` can pass this check and continue below, but
		// that only leads to too much work (downloading the history again), not an invalid state.
		return
	}

	account.log.Debug("Address status changed, fetching history.")

	defer account.Synchronizer.IncRequestsCounter()()
	history, err := account.coin.Blockchain().ScriptHashGetHistory(address.PubkeyScriptHashHex())
	if err != nil {
		// We are not closing client.blockchain here, as it is reused per coin with
		// different accounts.
		account.fatalError.Store(true)
		account.Config().OnEvent(accountsTypes.EventStatusChanged)
		return
	}
	// Safe some work in case account was closed in the meantime.
	if account.isClosed() {
		account.log.Debug("Ignoring result of ScriptHashGetHistory after the account was closed")
		return
	}

	account.transactions.UpdateAddressHistory(address.PubkeyScriptHashHex(), history)
	account.incAndEmitSyncCounter()
	account.ensureAddresses()
}

// ensureAddresses is the entry point of syncing up the account. It extends the receive and change
// address chains to discover all funds, with respect to the gap limit. In the end, there are
// `gapLimit` unused addresses in the tail. It is also called whenever the status (tx history) of
// changes, to keep the gapLimit tail.
func (account *Account) ensureAddresses() {
	defer account.Synchronizer.IncRequestsCounter()()

	syncSequence := func(addressChain *addresses.AddressChain) {
		for {
			newAddresses, err := addressChain.EnsureAddresses()
			if err != nil {
				if account.isClosed() {
					account.log.WithError(err).Error("stopping sync because account was closed")
					return
				}
				// TODO
				account.log.WithError(err).Panic("EnsureAddresses failed")
			}
			if len(newAddresses) == 0 {
				break
			}
			for _, address := range newAddresses {
				account.subscribeAddress(address)
			}
		}
	}
	for _, subacc := range account.subaccounts {
		syncSequence(subacc.receiveAddresses)
		syncSequence(subacc.changeAddresses)
	}
}

func (account *Account) subscribeAddress(address *addresses.AccountAddress) {
	account.coin.Blockchain().ScriptHashSubscribe(
		account.Synchronizer.IncRequestsCounter,
		address.PubkeyScriptHashHex(),
		func(status string) {
			go account.onAddressStatus(address, status)
		},
	)
}

// Transactions implements accounts.Interface.
func (account *Account) Transactions() (accounts.OrderedTransactions, error) {
	if !account.isInitialized() {
		return nil, errp.New("account not initialized")
	}
	if account.fatalError.Load() {
		return nil, errp.New("can't call Transactions() after a fatal error")
	}
	return account.transactions.Transactions(
		func(scriptHashHex blockchain.ScriptHashHex) bool {
			for _, subacc := range account.subaccounts {
				if subacc.changeAddresses.LookupByScriptHashHex(scriptHashHex) != nil {
					return true
				}
			}
			return false
		})
}

// GetUnusedReceiveAddresses returns a number of unused addresses. Returns nil if the account is not initialized.
func (account *Account) GetUnusedReceiveAddresses() []accounts.AddressList {
	if !account.isInitialized() {
		return nil
	}
	account.Synchronizer.WaitSynchronized()
	account.log.Debug("Get unused receive address")
	var addresses []accounts.AddressList
	for _, subacc := range account.subaccounts {
		scriptType := subacc.signingConfiguration.ScriptType()
		if account.Config().Config.InsuranceStatus == string(bitsurance.ActiveStatus) && scriptType != signing.ScriptTypeP2WPKH {
			// Insured accounts can only receive on native segwit
			continue
		}

		var addressList accounts.AddressList
		addressList.ScriptType = &scriptType
		unusedAddresses, err := subacc.receiveAddresses.GetUnused()
		if err != nil {
			// TODO
			panic(err)
		}
		for idx, address := range unusedAddresses {
			if idx >= receiveAddressesLimit {
				// Limit to gap limit for receive addresses, even if the actual limit is higher when
				// scanning.
				break
			}
			addressList.Addresses = append(addressList.Addresses, address)
		}
		addresses = append(addresses, addressList)
	}
	return addresses
}

// VerifyAddress verifies a receive address on a keystore. Returns false, nil if no secure output
// exists.
func (account *Account) VerifyAddress(addressID string) (bool, error) {
	if !account.isInitialized() {
		return false, errp.New("account must be initialized")
	}
	account.Synchronizer.WaitSynchronized()

	keystore, err := account.Config().ConnectKeystore()
	if err != nil {
		return false, err
	}

	scriptHashHex := blockchain.ScriptHashHex(addressID)
	var address *addresses.AccountAddress
	for _, subacc := range account.subaccounts {
		if addr := subacc.receiveAddresses.LookupByScriptHashHex(scriptHashHex); addr != nil {
			address = addr
			break
		}
	}
	if address == nil {
		return false, errp.New("unknown address not found")
	}
	canVerifyAddress, _, err := keystore.CanVerifyAddress(account.Coin())
	if err != nil {
		return false, err
	}
	if canVerifyAddress {
		return true, keystore.VerifyAddress(address.Configuration, account.Coin())
	}
	return false, nil
}

// CanVerifyAddresses wraps Keystores().CanVerifyAddresses(), see that function for documentation.
func (account *Account) CanVerifyAddresses() (bool, bool, error) {
	keystore, err := account.Config().ConnectKeystore()
	if err != nil {
		return false, false, err
	}
	return keystore.CanVerifyAddress(account.Coin())
}

// addressOutputsSum holds the address and sum of outputs for that address.
type addressOutputsSum struct {
	address string
	sum     int64
}

// sortByAddresses sorts the outputs by grouping them based on their addresses and then sorting each group
// from outputs with the biggest amounts to those with the lowest amounts.
func sortByAddresses(result []*SpendableOutput) []*SpendableOutput {
	// Create a map to store outputs grouped by address
	grouped := make(map[string][]*SpendableOutput)

	// Group outputs by address
	for _, output := range result {
		grouped[output.Address.String()] = append(grouped[output.Address.String()], output)
	}

	// Create a slice to store the sums of outputs and addresses
	sums := make([]addressOutputsSum, 0, len(grouped))

	// Calculate sums of values for each group and store in the sums slice
	for address, outputs := range grouped {
		var sum int64
		for _, output := range outputs {
			sum += output.TxOut.Value
		}
		sums = append(sums, addressOutputsSum{
			address: address,
			sum:     sum,
		})
	}

	// Sort the sums slice by the sum of values in descending order
	sort.Slice(sums, func(i, j int) bool {
		return sums[i].sum > sums[j].sum
	})

	// Create a new result grouped by addresses, sort them by value
	newResult := make([]*SpendableOutput, 0, len(result))
	for _, s := range sums {
		outputs := grouped[s.address]
		sort.Slice(outputs, func(i, j int) bool {
			return outputs[i].Value > outputs[j].Value
		})
		newResult = append(newResult, outputs...)
	}

	return newResult
}

// SpendableOutput is an unspent coin.
type SpendableOutput struct {
	*transactions.SpendableOutput
	OutPoint wire.OutPoint
	Address  *addresses.AccountAddress
	IsChange bool
}

// SpendableOutputs returns the utxo set, sorted by the value descending.
func (account *Account) SpendableOutputs() []*SpendableOutput {
	account.Synchronizer.WaitSynchronized()
	result := []*SpendableOutput{}
	utxos, err := account.transactions.SpendableOutputs()
	if err != nil {
		// TODO
		panic(err)
	}
	for outPoint, txOut := range utxos {
		isChange := false
		for _, subacc := range account.subaccounts {
			if subacc.changeAddresses.LookupByScriptHashHex(blockchain.NewScriptHashHex(txOut.PkScript)) != nil {
				isChange = true
			}
		}
		result = append(
			result,
			&SpendableOutput{
				OutPoint:        outPoint,
				SpendableOutput: txOut,
				Address:         account.getAddress(blockchain.NewScriptHashHex(txOut.TxOut.PkScript)),
				IsChange:        isChange,
			})
	}
	return sortByAddresses(result)
}

// VerifyExtendedPublicKey verifies an account's public key. Returns false, nil if no secure output
// exists.
//
// signingConfigIndex refers to the subaccount / signing config.
func (account *Account) VerifyExtendedPublicKey(signingConfigIndex int) (bool, error) {
	if !account.isInitialized() {
		return false, errp.New("account not initialized")
	}

	keystore, err := account.Config().ConnectKeystore()
	if err != nil {
		return false, err
	}

	if keystore.CanVerifyExtendedPublicKey() {
		return true, keystore.VerifyExtendedPublicKey(
			account.Coin(),
			account.subaccounts[signingConfigIndex].signingConfiguration,
		)
	}
	return false, nil
}

// SignBTCAddress returns an unused address and makes the user sign a message to prove ownership.
// Input params:
//
//	`account` is the account from which the address is derived.
//	`message` is the message that will be signed by the user with the private key linked to the address.
//	`format` is the script type that should be used in the address derivation.
//		If format is empty, native segwit type is used as a fallback.
//
// Returned values:
//
//	#1: is the first unused address corresponding to the account and the script type identified by the input values.
//	#2: base64 encoding of the message signature, obtained using the private key linked to the address.
//	#3: is an optional error that could be generated during the execution of the function.
func SignBTCAddress(account accounts.Interface, message string, scriptType signing.ScriptType) (string, string, error) {
	keystore, err := account.Config().ConnectKeystore()
	if err != nil {
		return "", "", err
	}

	canSign := keystore.CanSignMessage(account.Coin().Code())
	if !canSign {
		return "", "", errp.Newf("The connected device or keystore cannot sign messages for %s",
			account.Coin().Code())
	}

	unused := account.GetUnusedReceiveAddresses()
	// Use the format hint to get a compatible address
	if len(scriptType) == 0 {
		scriptType = signing.ScriptTypeP2WPKH
	}
	signingConfigIdx := account.Config().Config.SigningConfigurations.FindScriptType(scriptType)
	if signingConfigIdx == -1 {
		err := errp.Newf("Unsupported format: %s", scriptType)
		return "", "", err
	}
	addr := unused[signingConfigIdx].Addresses[0]

	sig, err := keystore.SignBTCMessage(
		[]byte(message),
		addr.AbsoluteKeypath(),
		account.Config().Config.SigningConfigurations[signingConfigIdx].ScriptType(),
	)
	if err != nil {
		return "", "", err
	}

	return addr.EncodeForHumans(), base64.StdEncoding.EncodeToString(sig), nil
}
