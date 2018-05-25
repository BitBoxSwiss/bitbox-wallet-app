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

	// Unit is the unit code of the string for formatting amounts.
	Unit() string

	// FormatAmount the given amount as a number followed by the currency code in a suitable denomination.
	FormatAmount(int64) string

	// // Server returns the host and port of the full node used for blockchain synchronization.
	// Server() string

	// // Returns whether the coin is account-based (instead of UTXO).
	// // Account-based transactions can have only one output and need no change address.
	// AccountBased() bool

	// // BlockExplorerTransactionURLPrefix returns the URL prefix of the block explorer.
	// BlockExplorerTransactionURLPrefix() string
}
