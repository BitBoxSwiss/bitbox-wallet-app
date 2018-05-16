package headers

import (
	"errors"
	"fmt"

	"github.com/btcsuite/btcd/chaincfg"
	"github.com/btcsuite/btcd/wire"
	"github.com/shiftdevices/godbb/backend/coins/btc/blockchain"
	"github.com/shiftdevices/godbb/backend/coins/btc/electrum/client"
	"github.com/shiftdevices/godbb/util/errp"
	"github.com/shiftdevices/godbb/util/locker"
	"github.com/sirupsen/logrus"
)

const reorgLimit = 100

// Event instances are sent to the onEvent callback.
type Event string

const (
	// EventSynced is fired when the headers finished syncing.
	EventSynced Event = "synced"
	// EventNewTip is fired when a new tip is known.
	EventNewTip Event = "newTip"
)

// Interface represents the public API of this package.
//go:generate mockery -name Interface
type Interface interface {
	Init() error
	SubscribeEvent(f func(Event)) func()
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
	kickChan     chan struct{}

	eventCallbacks []func(Event)
	events         chan Event
}

// Status represents the syncing status.
type Status struct {
	Tip          int           `json:"tip"`
	TipHashHex   client.TXHash `json:"tipHashHex"`
	TargetHeight int           `json:"targetHeight"`
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
		kickChan:        make(chan struct{}, 1),

		eventCallbacks: []func(Event){},
		events:         make(chan Event),
	}
}

// SubscribeEvent subscribes to header events. The provided callback will be notified of events. The
// returned function unsubscribes.
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

// Init starts the syncing process.
func (headers *Headers) Init() error {
	go headers.download()
	if err := headers.blockchain.HeadersSubscribe(
		func(header *client.Header) error {
			return headers.update(header.BlockHeight)
		},
		func() {},
	); err != nil {
		return err
	}
	headers.kickChan <- struct{}{}
	return nil
}

type batchInfo struct {
	blockHeaders []*wire.BlockHeader
	max          int
}

func (headers *Headers) download() {
	for {
		select {
		case <-headers.kickChan:
			func() {
				defer headers.lock.Lock()()
				dbTx, err := headers.db.Begin()
				if err != nil {
					// TODO
					panic(err)
				}
				defer func() {
					_ = dbTx.Commit()
				}()
				tip, err := dbTx.Tip()
				if err != nil {
					// TODO
					panic(err)
				}
				batchChan := make(chan batchInfo)
				err = headers.blockchain.Headers(
					tip+1, headers.headersPerBatch,
					func(blockHeaders []*wire.BlockHeader, max int) error {
						batchChan <- batchInfo{blockHeaders, max}
						return nil
					}, func() {})
				if err != nil {
					// TODO
					panic(err)
				}
				batch := <-batchChan
				if err := headers.processBatch(dbTx, tip, batch.blockHeaders, batch.max); err != nil {
					// TODO
					panic(err)
				}
			}()
		}
	}
}

var errPrevHash = errors.New("header prevhash does not match")

func (headers *Headers) canConnect(dbTx DBTxInterface, tip int, header *wire.BlockHeader) error {
	if tip == 0 {
		if header.BlockHash() != *headers.net.GenesisHash {
			return errp.Newf("wrong genesis hash, got %s, expected %s",
				header.BlockHash(), *headers.net.GenesisHash)
		}
	} else {
		// TODO: check difficulty target, PoW.

		previousHeader, err := dbTx.HeaderByHeight(tip - 1)
		if err != nil {
			return err
		}
		prevBlock := previousHeader.BlockHash()
		if header.PrevBlock != prevBlock {
			return errp.Wrap(errPrevHash,
				fmt.Sprintf("%s (%d) does not connect to %s (%d)",
					header.PrevBlock, tip, prevBlock, tip-1))
		}
	}
	return nil
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func (headers *Headers) reorg(dbTx DBTxInterface, tip int) {
	// Simple reorg method: re-fetch headers up to the maximum reorg limit. The server can shorten
	// our chain by sending a fake header and set us back by `reorgLimit` blocks, but it needs to
	// contain the correct PoW to do so.
	newTip := tip - reorgLimit
	if newTip < -1 {
		newTip = -1
	}
	if err := dbTx.PutTip(newTip); err != nil {
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
	dbTx DBTxInterface, tip int, blockHeaders []*wire.BlockHeader, max int) error {
	for _, header := range blockHeaders {
		err := headers.canConnect(dbTx, tip+1, header)
		if errp.Cause(err) == errPrevHash {
			headers.log.WithError(err).Infof("Reorg detected at height %d", tip+1)
			headers.reorg(dbTx, tip)
			return nil
		}
		if err != nil {
			return errp.WithMessage(err, "unexpected blockchain reply")
		}
		tip++
		if err := dbTx.PutHeader(tip, header); err != nil {
			return err
		}
	}
	if len(blockHeaders) == min(max, headers.headersPerBatch) {
		// Received max number of headers per batch, so there might be more.
		headers.kick()
		headers.log.Debugf("Syncing headers; tip: %d", tip)
	} else if len(blockHeaders) != 0 {
		headers.log.Debugf("Synced headers; tip: %d", tip)
		headers.notifyEvent(EventSynced)
	}
	headers.headersPerBatch = max
	return nil
}

// HeaderByHeight returns the header at the given height. Returns nil if the headers are not synced
// up to this height yet.
func (headers *Headers) HeaderByHeight(height int) (*wire.BlockHeader, error) {
	defer headers.lock.RLock()()
	dbTx, err := headers.db.Begin()
	if err != nil {
		return nil, err
	}
	defer dbTx.Rollback()
	return dbTx.HeaderByHeight(height)
}

func (headers *Headers) kick() {
	select {
	case headers.kickChan <- struct{}{}:
	default:
	}
}

// update should be called when there is a new header.
func (headers *Headers) update(blockHeight int) error {
	headers.log.Debugf("new target %d", blockHeight)
	headers.kick()
	headers.targetHeight = blockHeight
	headers.notifyEvent(EventNewTip)
	return nil
}

// Status returns the current sync status.
func (headers *Headers) Status() (*Status, error) {
	defer headers.lock.RLock()()
	dbTx, err := headers.db.Begin()
	if err != nil {
		return nil, err
	}
	defer dbTx.Rollback()
	tip, err := dbTx.Tip()
	if err != nil {
		return nil, err
	}
	header, err := dbTx.HeaderByHeight(tip)
	if err != nil {
		return nil, err
	}
	return &Status{
		Tip:          tip,
		TargetHeight: headers.targetHeight,
		TipHashHex:   client.TXHash(header.BlockHash()),
	}, nil
}
