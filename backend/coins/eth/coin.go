package eth

import (
	"math/big"
	"strings"
	"sync"

	coinpkg "github.com/digitalbitbox/bitbox-wallet-app/backend/coins/coin"
	"github.com/digitalbitbox/bitbox-wallet-app/util/observable"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/ethereum/go-ethereum/params"
)

// Coin models an Ethereum coin.
type Coin struct {
	observable.Implementation
	initOnce              sync.Once
	client                *ethclient.Client
	code                  string
	net                   *params.ChainConfig
	blockExplorerTxPrefix string
}

// NewCoin creates a new coin with the given parameters.
func NewCoin(
	code string,
	net *params.ChainConfig,
	blockExplorerTxPrefix string,
) *Coin {
	return &Coin{
		code:                  code,
		net:                   net,
		blockExplorerTxPrefix: blockExplorerTxPrefix,
	}
}

// Net returns the network (mainnet, testnet, etc.).
func (coin *Coin) Net() *params.ChainConfig { return coin.net }

// Initialize implements coin.Coin.
func (coin *Coin) Initialize() {
	coin.initOnce.Do(func() {
		url := `https://mainnet.infura.io`
		if coin.code == "teth" {
			url = `https://ropsten.infura.io`
		}
		client, err := ethclient.Dial(url)
		if err != nil {
			// TODO: init conn lazily, feed error via EventStatusChanged
			panic(err)
		}
		coin.client = client
	})
}

// Code implements coin.Coin.
func (coin *Coin) Code() string {
	return strings.ToUpper(coin.code)
}

// Unit implements coin.Coin.
func (coin *Coin) Unit() string {
	return strings.ToUpper(coin.code)
}

// Denomination implements coin.Coin.
func (coin *Coin) Denomination() *big.Int {
	return big.NewInt(1e18)
}

// FormatAmount implements coin.Coin.
func (coin *Coin) FormatAmount(amount coinpkg.Amount) string {
	return strings.TrimRight(
		new(big.Rat).SetFrac(amount.BigInt(), coin.Denomination()).FloatString(18),
		"0.",
	)
}

// AccountBased implements coin.Coin.
func (coin *Coin) AccountBased() bool {
	return true
}

// BlockExplorerTransactionURLPrefix implements coin.Coin.
func (coin *Coin) BlockExplorerTransactionURLPrefix() string {
	return coin.blockExplorerTxPrefix
}
