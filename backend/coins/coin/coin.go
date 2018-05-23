package coin

// Coin models the currency of a blockchain.
type Coin interface {
	// Code returns the acronym of the currency in lowercase.
	// Code() string

	// Name returns the written-out name of the coin.
	Name() string

	// // Type returns the coin type according to BIP44:
	// // https://github.com/satoshilabs/slips/blob/master/slip-0044.md
	// Type() uint32

	// // Format the given amount as a number followed by the currency code in a suitable denomination.
	// Format(uint64) string

	// // Server returns the host and port of the full node used for blockchain synchronization.
	// Server() string

	// // Returns whether the coin is account-based (instead of UTXO).
	// // Account-based transactions can have only one output and need no change address.
	// AccountBased() bool

	// // BlockExplorerTransactionURLPrefix returns the URL prefix of the block explorer.
	// BlockExplorerTransactionURLPrefix() string
}

type implementation struct {
	code     string
	name     string
	coinType uint32
	server   string

	denomination float64
	accountBased bool

	blockExplorerTransactionURLPrefix string
}

// NewCoin creates a new Coin.
func NewCoin(
	code string,
	name string,
	coinType uint32,
	server string,

	denomination uint64,
	accountBased bool,

	blockExplorerTransactionURLPrefix string,
) Coin {
	return &implementation{
		code:     code,
		name:     name,
		coinType: coinType,
		server:   server,

		denomination: float64(denomination),
		accountBased: accountBased,

		blockExplorerTransactionURLPrefix: blockExplorerTransactionURLPrefix,
	}
}

// func (coin *Coin) Code() string {
// 	return coin.code
// }

// Name returns the coin name.
func (coin *implementation) Name() string {
	return coin.name
}

// func (coin *Coin) Type() uint32 {
// 	return coin.coinType
// }

// func (coin *Coin) Format(amount uint64) string {
// 	return fmt.Sprintf("%f %s", float64(amount)/coin.denomination, strings.ToUpper(coin.code))
// }

// func (coin *Coin) Server() string {
// 	return coin.server
// }

// func (coin *Coin) AccountBased() bool {
// 	return coin.accountBased
// }

// func (coin *Coin) BlockExplorerTransactionURLPrefix() string {
// 	return coin.blockExplorerTransactionURLPrefix
// }
