package deterministicwallet_test

import (
	"testing"

	"github.com/btcsuite/btcd/chaincfg"
	"github.com/btcsuite/btcutil"
	"github.com/btcsuite/btcutil/hdkeychain"
	"github.com/shiftdevices/godbb/deterministicwallet"
	"github.com/shiftdevices/godbb/deterministicwallet/addresses"
	blockchainMock "github.com/shiftdevices/godbb/deterministicwallet/blockchain/mocks"
	"github.com/shiftdevices/godbb/deterministicwallet/mocks"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
)

type walletSuite struct {
	suite.Suite

	net            *chaincfg.Params
	keystoreMock   mocks.HDKeyStoreInterface
	blockchainMock blockchainMock.InterfaceMock
	onEvent        func(deterministicwallet.Event)
	wallet         *deterministicwallet.DeterministicWallet
}

func (s *walletSuite) SetupTest() {
	s.net = &chaincfg.TestNet3Params
	s.onEvent = func(deterministicwallet.Event) {}
	var err error

	const xpubSerialized = "tpubDEXZPZzoVxHQdZg6ndWKoDXwsPtfTKpYsF6SDCm2dHxydcNvoKM58RmA7FDj3hXqy8BrxfwoTNaV5SzWgCzurTaQmDNywHVvv5tPSj6Evgr"
	xpub, err := hdkeychain.NewKeyFromString(xpubSerialized)
	if err != nil || xpub.IsPrivate() {
		panic(err)
	}

	s.keystoreMock.On("XPub").Return(xpub)
	s.wallet, err = deterministicwallet.NewDeterministicWallet(
		s.net,
		&s.keystoreMock,
		&s.blockchainMock,
		addresses.AddressTypeP2PKH,
		s.onEvent,
	)
	if err != nil {
		panic(err)
	}
	s.blockchainMock.EstimateFeeFunc = func(
		number int,
		success func(btcutil.Amount) error,
		cleanup func(error)) error {
		return nil
	}
}

func TestWalletSuite(t *testing.T) {
	suite.Run(t, &walletSuite{})
}

func (s *walletSuite) TestEmptyWallet() {
	s.blockchainMock.ScriptHashSubscribeFunc =
		func(_ string, success func(string) error, _ func(error)) error {
			require.NoError(s.T(), success(""))
			return nil
		}
	s.wallet.Init()
}
