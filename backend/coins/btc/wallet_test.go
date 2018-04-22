package btc_test

import (
	"testing"

	"github.com/btcsuite/btcd/chaincfg"
	"github.com/btcsuite/btcutil/hdkeychain"
	"github.com/shiftdevices/godbb/backend/coins/btc"
	"github.com/shiftdevices/godbb/backend/coins/btc/addresses"
	blockchainMock "github.com/shiftdevices/godbb/backend/coins/btc/blockchain/mocks"
	headersMock "github.com/shiftdevices/godbb/backend/coins/btc/headers/mocks"
	"github.com/shiftdevices/godbb/backend/coins/btc/mocks"
	"github.com/shiftdevices/godbb/backend/db/transactionsdb"
	"github.com/shiftdevices/godbb/util/logging"
	"github.com/shiftdevices/godbb/util/test"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/suite"
)

type walletSuite struct {
	suite.Suite

	net            *chaincfg.Params
	keyStoreMock   mocks.KeyStoreWithoutKeyDerivation
	blockchainMock blockchainMock.Interface
	onEvent        func(btc.Event)
	wallet         *btc.Wallet

	log *logrus.Entry
}

func (s *walletSuite) SetupTest() {
	s.log = logging.Log.WithGroup("btc_test")
	s.net = &chaincfg.TestNet3Params
	s.onEvent = func(btc.Event) {}
	var err error

	const xpubSerialized = "tpubDEXZPZzoVxHQdZg6ndWKoDXwsPtfTKpYsF6SDCm2dHxydcNvoKM58RmA7FDj3hXqy8BrxfwoTNaV5SzWgCzurTaQmDNywHVvv5tPSj6Evgr"
	xpub, err := hdkeychain.NewKeyFromString(xpubSerialized)
	if err != nil || xpub.IsPrivate() {
		panic(err)
	}

	db, err := transactionsdb.NewDB(test.TstTempFile("godbb-db-"))
	if err != nil {
		panic(err)
	}
	s.keyStoreMock.On("XPub").Return(xpub)
	s.wallet, err = btc.NewWallet(
		s.net,
		db.SubDB("test", s.log),
		&s.keyStoreMock,
		&s.blockchainMock,
		&headersMock.Interface{},
		addresses.AddressTypeP2PKH,
		s.onEvent,
		s.log,
	)
	if err != nil {
		panic(err)
	}
}

func TestWalletSuite(t *testing.T) {
	suite.Run(t, &walletSuite{})
}
