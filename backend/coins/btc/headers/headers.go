// SPDX-License-Identifier: Apache-2.0

package headers

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"time"

	_ "embed"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/blockchain"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/ltc"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/locker"
	"github.com/BitBoxSwiss/block-client-go/electrum/types"
	btcdBlockchain "github.com/btcsuite/btcd/blockchain"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/btcsuite/btcd/chaincfg/chainhash"
	"github.com/btcsuite/btcd/wire"
	"github.com/sirupsen/logrus"
	"golang.org/x/crypto/scrypt"
)

const reorgLimit = 100

//go:embed checkpoints.json
var checkpointsJSONRaw []byte

var checkpointsByNet = mustLoadCheckpoints(checkpointsJSONRaw)

func mustLoadCheckpoints(jsonRaw []byte) map[wire.BitcoinNet]*chaincfg.Checkpoint {
	var file CheckpointsJSONFile
	if err := json.Unmarshal(jsonRaw, &file); err != nil {
		panic(errp.WithStack(err))
	}

	mustUnhex := func(s string) *chainhash.Hash {
		hash, err := chainhash.NewHashFromStr(s)
		if err != nil {
			panic(err)
		}
		return hash
	}

	mustCheckpoint := func(label string, checkpoint CheckpointJSON) *chaincfg.Checkpoint {
		if checkpoint.Height <= 0 {
			panic(errp.Newf("invalid checkpoint height for %s: %d", label, checkpoint.Height))
		}
		if checkpoint.Hash == "" {
			panic(errp.Newf("missing checkpoint hash for %s", label))
		}
		return &chaincfg.Checkpoint{
			Height: checkpoint.Height,
			Hash:   mustUnhex(checkpoint.Hash),
		}
	}

	return map[wire.BitcoinNet]*chaincfg.Checkpoint{
		chaincfg.MainNetParams.Net:  mustCheckpoint("btc/mainnet", file.BTC.Mainnet),
		chaincfg.TestNet3Params.Net: mustCheckpoint("btc/testnet3", file.BTC.Testnet3),
		ltc.MainNetParams.Net:       mustCheckpoint("ltc/mainnet", file.LTC.Mainnet),
		ltc.TestNet4Params.Net:      mustCheckpoint("ltc/testnet4", file.LTC.Testnet4),
	}
}

// Event instances are sent to the onEvent callback.
type Event string

const (
	// EventSyncing is fired when the headers are syncing (a batch was downloaded but more are
	// coming). At the end, EventSynced is fired.
	EventSyncing Event = "syncing"
	// EventSynced is fired when the headers finished syncing.
	EventSynced Event = "synced"
	// EventNewTip is fired when a new tip is known.
	EventNewTip Event = "newTip"
)

// Interface represents the public API of this package.
//
//go:generate mockery -name Interface
type Interface interface {
	Initialize()
	SubscribeEvent(f func(Event)) func()
	VerifiedHeaderByHeight(int) (*wire.BlockHeader, error)
	HeaderByHeight(int) (*wire.BlockHeader, error)
	TipHeight() int
	Status() (*Status, error)
}

// Headers manages syncing blockchain headers.
type Headers struct {
	log *logrus.Entry

	net             *chaincfg.Params
	db              DBInterface
	blockchain      blockchain.Interface
	headersPerBatch int
	lock            locker.Locker
	// targetHeight is the potential tip height we are syncing up to.
	targetHeight int
	// tipAtInitTime is the tip at init time, i.e. the last tip known, loaded from the DB. It is
	// used to show the sync progress since the last time (catch up).
	tipAtInitTime int
	kickChan      chan struct{}
	quitChan      chan struct{}

	eventCallbacks []func(Event)

	closed bool

	// Only for testing, must be nil in production.
	testDownloadFinished func()
}

// Status represents the syncing status.
type Status struct {
	TipAtInitTime int `json:"tipAtInitTime"`
	Tip           int `json:"tip"`
	// Only well defined if Tip >= 0
	TipHashHex   blockchain.TXHash `json:"tipHashHex"`
	TargetHeight int               `json:"targetHeight"`
}

// NewHeaders creates a new Headers instance.
func NewHeaders(
	net *chaincfg.Params,
	db DBInterface,
	blockchain blockchain.Interface,
	log *logrus.Entry) *Headers {
	return &Headers{
		log: log,

		net:        net,
		db:         db,
		blockchain: blockchain,
		// We start with a small batch size and increase to the maximum allowed one with the first
		// response.
		headersPerBatch: 10,
		targetHeight:    0,
		tipAtInitTime:   0,
		kickChan:        make(chan struct{}, 1),
		quitChan:        make(chan struct{}),

		eventCallbacks: []func(Event){},
	}
}

// checkpoint returns the latest checkpoint for the current chain.
func (headers *Headers) checkpoint() *chaincfg.Checkpoint {
	// We define our own checkpoints over using headers.net.Checkpoints, because they are defined in
	// the vendored btcd dep, and we want to control it. Furthermore, the chaincfg.Params are evil
	// globals registered in the lib's `init()`, so we can't replicate the instances ourselves.

	checkpoint, ok := checkpointsByNet[headers.net.Net]
	if !ok {
		return nil
	}
	return checkpoint
}

// SubscribeEvent subscribes to header events. The provided callback will be notified of events. The
// returned function unsubscribes.
// FIXME: Unsafe for concurrent use.
func (headers *Headers) SubscribeEvent(f func(event Event)) func() {
	headers.eventCallbacks = append(headers.eventCallbacks, f)
	index := len(headers.eventCallbacks) - 1
	return func() {
		headers.eventCallbacks[index] = nil
	}
}

// TipHeight returns the height of the tip.
func (headers *Headers) TipHeight() int {
	return headers.targetHeight
}

// Initialize starts the syncing process.
func (headers *Headers) Initialize() {
	headers.tipAtInitTime = headers.tip()
	headers.log.Infof("last tip loaded: %d", headers.tipAtInitTime)
	go headers.download()
	go headers.blockchain.HeadersSubscribe(
		func(header *types.Header) {
			headers.update(header.Height)
		},
	)
	headers.kickChan <- struct{}{}
}

func (headers *Headers) download() {
	defer func() {
		// Only for testing.
		if headers.testDownloadFinished != nil {
			headers.testDownloadFinished()
		}
	}()

	defer headers.log.Debug("stopped downloading")

	downloadAndProcessBatch := func() {
		defer headers.lock.Lock()()
		if headers.closed {
			return
		}
		db := headers.db
		tip, err := db.Tip()
		if err != nil {
			// TODO
			return
		}
		headersResult, err := headers.blockchain.Headers(tip+1, headers.headersPerBatch)
		if err != nil {
			// TODO
			headers.log.WithError(err).Error("blockchain.Headers")
			return
		}
		if err := headers.processBatch(db, tip, headersResult.Headers, headersResult.Max); err != nil {
			// TODO
			headers.log.WithError(err).Error("processBatch")
			return
		}
	}

	for {
		select {
		case <-headers.quitChan:
			return
		default:
			select {
			case <-headers.quitChan:
				return
			case <-headers.kickChan:
				downloadAndProcessBatch()
			}
		}
	}
}

var errPrevHash = errors.New("header prevhash does not match")

func (headers *Headers) getTarget(db DBInterface, index int) (*big.Int, error) {
	targetTimespan := int64(headers.net.TargetTimespan / time.Second)
	targetTimePerBlock := int64(headers.net.TargetTimePerBlock / time.Second)
	blocksPerRetarget := int(targetTimespan / targetTimePerBlock)
	chunkIndex := (index / blocksPerRetarget) - 1
	if chunkIndex == -1 {
		return btcdBlockchain.CompactToBig(headers.net.GenesisBlock.Header.Bits), nil
	}

	firstIndex := chunkIndex * blocksPerRetarget
	if headers.net.Net == ltc.MainNetParams.Net && chunkIndex > 0 {
		// Litecoin includes the last block of the previous window to fix a time warp attack:
		// https://litecoin.info/index.php/Time_warp_attack#cite_note-2
		firstIndex--
	}
	first, err := db.HeaderByHeight(firstIndex)
	if err != nil {
		return nil, err
	}
	if first == nil {
		return nil, errp.Newf("header at %d not found", firstIndex)
	}
	lastIndex := (chunkIndex+1)*blocksPerRetarget - 1
	last, err := db.HeaderByHeight(lastIndex)
	if err != nil {
		return nil, err
	}
	if last == nil {
		return nil, errp.Newf("header at %d not found", lastIndex)
	}
	lastTarget := btcdBlockchain.CompactToBig(last.Bits)
	timespan := last.Timestamp.Unix() - first.Timestamp.Unix()

	minRetargetTimespan := targetTimespan / headers.net.RetargetAdjustmentFactor
	maxRetargetTimespan := targetTimespan * headers.net.RetargetAdjustmentFactor
	if timespan < minRetargetTimespan {
		timespan = minRetargetTimespan
	} else if timespan > maxRetargetTimespan {
		timespan = maxRetargetTimespan
	}
	newTarget := new(big.Int).Mul(lastTarget, big.NewInt(timespan))
	newTarget.Div(newTarget, big.NewInt(targetTimespan))
	if newTarget.Cmp(headers.net.PowLimit) > 0 {
		newTarget.Set(headers.net.PowLimit)
	}
	return newTarget, nil
}

func (headers *Headers) powHash(msg []byte) chainhash.Hash {
	switch headers.net.Net {
	case chaincfg.MainNetParams.Net:
		return chainhash.DoubleHashH(msg)
	case ltc.MainNetParams.Net:
		const (
			N = 1024
			r = 1
			p = 1
		)
		hashBytes, err := scrypt.Key(msg, msg, N, r, p, 32)
		if err != nil {
			panic(errp.WithStack(err))
		}
		hash := chainhash.Hash{}
		if err := hash.SetBytes(hashBytes); err != nil {
			panic(errp.WithStack(err))
		}
		return hash
	default:
		panic("unsupported coin")
	}
}

func (headers *Headers) canConnect(db DBInterface, tip int, header *wire.BlockHeader) error {
	if tip == 0 {
		if header.BlockHash() != *headers.net.GenesisHash {
			return errp.Newf("wrong genesis hash, got %s, expected %s",
				header.BlockHash(), *headers.net.GenesisHash)
		}
	} else {
		previousHeader, err := db.HeaderByHeight(tip - 1)
		if err != nil {
			return err
		}
		if previousHeader == nil {
			return errp.Newf("header at %d not found", tip-1)
		}
		prevBlock := previousHeader.BlockHash()
		if header.PrevBlock != prevBlock {
			return errp.Wrap(errPrevHash,
				fmt.Sprintf("%s (%d) does not connect to %s (%d)",
					header.PrevBlock, tip, prevBlock, tip-1))
		}

		lastCheckpoint := headers.checkpoint()
		if lastCheckpoint != nil && tip == int(lastCheckpoint.Height) {
			if *lastCheckpoint.Hash != header.BlockHash() {
				return errp.Newf("checkpoint mismatch at %d. Expected %s, got %s",
					tip, lastCheckpoint.Hash, header.BlockHash())
			}
			headers.log.Infof("checkpoint at %d matches", tip)
		}
		// Check Difficulty, PoW.
		if headers.net.Net == chaincfg.MainNetParams.Net || headers.net.Net == ltc.MainNetParams.Net {
			newTarget, err := headers.getTarget(db, tip)
			if err != nil {
				return err
			}
			if header.Bits != btcdBlockchain.BigToCompact(newTarget) {
				return errp.Newf("header %d has an unexpected difficulty", tip)
			}
			headerSerialized := &bytes.Buffer{}
			if err := header.BtcEncode(headerSerialized, 0, wire.BaseEncoding); err != nil {
				panic(errp.WithStack(err))
			}
			// Skip PoW check before the checkpoint for performance.
			if lastCheckpoint != nil && tip > int(lastCheckpoint.Height) {
				powHash := headers.powHash(headerSerialized.Bytes())
				proofOfWork := btcdBlockchain.HashToBig(&powHash)
				if proofOfWork.Cmp(newTarget) > 0 {
					return errp.Newf("header %d, %s has insufficient proof of work.", tip, powHash)
				}
			}
		}
	}
	return nil
}

func (headers *Headers) reorg(db DBInterface, tip int) {
	// Simple reorg method: re-fetch headers up to the maximum reorg limit. The server can shorten
	// our chain by sending a fake header and set us back by `reorgLimit` blocks, but it needs to
	// contain the correct PoW to do so.
	newTip := max(tip-reorgLimit, -1)
	if err := db.RevertTo(newTip); err != nil {
		panic(err)
	}
	headers.kick()
}

func (headers *Headers) notifyEvent(event Event) {
	for _, f := range headers.eventCallbacks {
		if f != nil {
			go f(event)
		}
	}
}

func (headers *Headers) processBatch(
	db DBInterface, tip int, blockHeaders []*wire.BlockHeader, max int) error {
	for _, header := range blockHeaders {
		err := headers.canConnect(db, tip+1, header)
		if errp.Cause(err) == errPrevHash {
			headers.log.WithError(err).Infof("Reorg detected at height %d", tip+1)
			headers.reorg(db, tip)
			return nil
		}
		if err != nil {
			return errp.WithMessage(err, "can't connect header, unexpected blockchain reply")
		}
		tip++
		if err := db.PutHeader(tip, header); err != nil {
			return err
		}
	}
	if err := db.Flush(); err != nil {
		// Ignore error, not critical.
		headers.log.WithError(err).Error("Failed to flush")
	}
	if len(blockHeaders) == min(max, headers.headersPerBatch) {
		// Received max number of headers per batch, so there might be more.
		headers.kick()
		headers.log.Debugf("Syncing headers; tip: %d", tip)
		headers.notifyEvent(EventSyncing)
	} else if len(blockHeaders) != 0 {
		headers.log.Debugf("Synced headers; tip: %d", tip)
		headers.notifyEvent(EventSynced)
	}
	headers.headersPerBatch = max
	return nil
}

// VerifiedHeaderByHeight returns the header at the given height. Returns nil if the headers are not synced
// up to this height yet OR if the headers are not synced up to the latest checkpoint yet.
func (headers *Headers) VerifiedHeaderByHeight(height int) (*wire.BlockHeader, error) {
	defer headers.lock.RLock()()

	tip, err := headers.db.Tip()
	if err != nil {
		return nil, err
	}

	checkpoint := headers.checkpoint()
	if checkpoint != nil && tip < int(checkpoint.Height) {
		return nil, nil
	}

	return headers.db.HeaderByHeight(height)
}

// HeaderByHeight returns the header at the given height. Returns nil if the headers are not synced
// up to this height yet.
func (headers *Headers) HeaderByHeight(height int) (*wire.BlockHeader, error) {
	defer headers.lock.RLock()()
	return headers.db.HeaderByHeight(height)
}

func (headers *Headers) kick() {
	select {
	case headers.kickChan <- struct{}{}:
	default:
	}
}

// update should be called when there is a new header.
func (headers *Headers) update(blockHeight int) {
	headers.log.Debugf("new target %d", blockHeight)
	headers.kick()
	headers.targetHeight = blockHeight
	headers.notifyEvent(EventNewTip)
}

func (headers *Headers) tip() int {
	defer headers.lock.RLock()()
	tip, err := headers.db.Tip()
	if err != nil {
		panic(err)
	}
	return tip
}

// Status returns the current sync status.
func (headers *Headers) Status() (*Status, error) {
	defer headers.lock.RLock()()
	tip, err := headers.db.Tip()
	if err != nil {
		return nil, err
	}
	header, err := headers.db.HeaderByHeight(tip)
	if err != nil {
		return nil, err
	}
	if header == nil {
		return nil, errp.Newf("header at %d not found", tip)
	}
	var tipHashHex blockchain.TXHash
	if header != nil {
		tipHashHex = blockchain.TXHash(header.BlockHash())
	}
	return &Status{
		TipAtInitTime: headers.tipAtInitTime,
		Tip:           tip,
		TargetHeight:  headers.targetHeight,
		TipHashHex:    tipHashHex,
	}, nil
}

// Close shuts down the downloading goroutine and closes the database.
func (headers *Headers) Close() error {
	defer headers.lock.Lock()()
	close(headers.quitChan)
	headers.closed = true
	return headers.db.Close()
}
