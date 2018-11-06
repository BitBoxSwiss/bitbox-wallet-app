package eth

import (
	"math/big"
	"strings"
	"sync"

	coinpkg "github.com/digitalbitbox/bitbox-wallet-app/backend/coins/coin"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/eth/etherscan"
	"github.com/digitalbitbox/bitbox-wallet-app/util/logging"
	"github.com/digitalbitbox/bitbox-wallet-app/util/observable"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/ethereum/go-ethereum/params"
	"github.com/sirupsen/logrus"
)

// Coin models an Ethereum coin.
type Coin struct {
	observable.Implementation
	initOnce              sync.Once
	client                *ethclient.Client
	code                  string
	net                   *params.ChainConfig
	blockExplorerTxPrefix string
	nodeURL               string
	etherScan             *etherscan.EtherScan

	log *logrus.Entry
}

// NewCoin creates a new coin with the given parameters.
func NewCoin(
	code string,
	net *params.ChainConfig,
	blockExplorerTxPrefix string,
	nodeURL string,
) *Coin {
	return &Coin{
		code:                  code,
		net:                   net,
		blockExplorerTxPrefix: blockExplorerTxPrefix,
		nodeURL:               nodeURL,

		log: logging.Get().WithGroup("coin").WithField("code", code),
	}
}

// Net returns the network (mainnet, testnet, etc.).
func (coin *Coin) Net() *params.ChainConfig { return coin.net }

// Initialize implements coin.Coin.
func (coin *Coin) Initialize() {
	coin.initOnce.Do(func() {
		etherScanURL := "https://api.etherscan.io/api"
		if coin.code == "teth" {
			etherScanURL = "https://api-rinkeby.etherscan.io/api"
		}
		coin.log.Infof("connecting to %s", coin.nodeURL)
		client, err := ethclient.Dial(coin.nodeURL)
		if err != nil {
			// TODO: init conn lazily, feed error via EventStatusChanged
			panic(err)
		}
		coin.client = client

		coin.etherScan = etherscan.NewEtherScan(etherScanURL)
	})
}

// Code implements coin.Coin.
func (coin *Coin) Code() string {
	return coin.code
}

// Unit implements coin.Coin.
func (coin *Coin) Unit() string {
	return strings.ToUpper(coin.code)
}

// FormatAmount implements coin.Coin.
func (coin *Coin) FormatAmount(amount coinpkg.Amount) string {
	ether := big.NewInt(1e18)
	return strings.TrimRight(strings.TrimRight(
		new(big.Rat).SetFrac(amount.BigInt(), ether).FloatString(18),
		"0"), ".")
}

// ToUnit implements coin.Coin.
func (coin *Coin) ToUnit(amount coinpkg.Amount) float64 {
	ether := big.NewInt(1e18)
	result, _ := new(big.Rat).SetFrac(amount.BigInt(), ether).Float64()
	return result
}

// BlockExplorerTransactionURLPrefix implements coin.Coin.
func (coin *Coin) BlockExplorerTransactionURLPrefix() string {
	return coin.blockExplorerTxPrefix
}

// EtherScan returns an instance of EtherScan.
func (coin *Coin) EtherScan() *etherscan.EtherScan {
	return coin.etherScan
}
