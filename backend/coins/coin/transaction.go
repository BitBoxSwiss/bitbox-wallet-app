package coin

import "time"

// ProposedTransaction models a proposed but not yet fully signed transaction of the given coin.
type ProposedTransaction interface {
	// Coin() Coin
	// Fee() uint64
	// Inputs() []Input // Needed or rather make "private" (within implementation)?
	// Outputs() []Output

	// // ChangeAddress can be nil for account-based blockchains.
	// ChangeAddress() WalletAddress

	// // AccountConfiguration returns the configuration of the account whose inputs are spent.
	// AccountConfiguration() *signing.Configuration

	// // IsFullySigned returns whether each input is signed by the required amount of cosigners.
	// IsFullySigned() bool

	// // MakeSignedTransaction makes a signed transaction from the fully signed proposed transaction.
	// // Please note that this does not work for off-chain transactions.
	// MakeSignedTransaction() (SignedTransaction, error)
}

// SignedTransaction models a signed but not yet broadcasted transaction of the given coin.
type SignedTransaction interface {
	ProposedTransaction
	Valid() bool
	Broadcast() error // TODO: Not desirable here (because also present in types below)?
}

// PendingTransaction models a broadcasted but not yet confirmed transaction of the given coin.
type PendingTransaction interface {
	ProposedTransaction
	BroadcastTime() time.Time
}

// ConfirmedTransaction models a confirmed transaction of the given coin.
type ConfirmedTransaction interface {
	PendingTransaction
	ConfirmationTime() time.Time
}
