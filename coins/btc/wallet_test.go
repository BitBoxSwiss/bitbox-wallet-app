package btc_test

import (
	"testing"

	"github.com/btcsuite/btcd/chaincfg"
	"github.com/btcsuite/btcutil/hdkeychain"
	"github.com/shiftdevices/godbb/coins/btc"
	"github.com/shiftdevices/godbb/coins/btc/addresses"
	blockchainMock "github.com/shiftdevices/godbb/coins/btc/blockchain/mocks"
	"github.com/shiftdevices/godbb/coins/btc/mocks"
	"github.com/shiftdevices/godbb/util/logging"
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

	logEntry *logrus.Entry
}

func (s *walletSuite) SetupTest() {
	s.logEntry = logging.Log.WithGroup("btc_test")
	s.net = &chaincfg.TestNet3Params
	s.onEvent = func(btc.Event) {}
	var err error

	const xpubSerialized = "tpubDEXZPZzoVxHQdZg6ndWKoDXwsPtfTKpYsF6SDCm2dHxydcNvoKM58RmA7FDj3hXqy8BrxfwoTNaV5SzWgCzurTaQmDNywHVvv5tPSj6Evgr"
	xpub, err := hdkeychain.NewKeyFromString(xpubSerialized)
	if err != nil || xpub.IsPrivate() {
		panic(err)
	}

	s.keyStoreMock.On("XPub").Return(xpub)
	s.wallet, err = btc.NewWallet(
		s.net,
		&s.keyStoreMock,
		&s.blockchainMock,
		addresses.AddressTypeP2PKH,
		s.onEvent,
		s.logEntry,
	)
	if err != nil {
		panic(err)
	}
}

func TestWalletSuite(t *testing.T) {
	suite.Run(t, &walletSuite{})
}
