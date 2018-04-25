package btc

// Event instances are sent to the onEvent callback of the wallet.
type Event string

const (
	// EventStatusChanged is fired when the status changes. Check the status using Initialized().
	EventStatusChanged Event = "statusChanged"

	// EventSyncStarted is fired when syncing with the blockchain starts. This happens in the very
	// beginning for the initial sync, and repeatedly afterwards when the wallet is updated (new
	// transactions, confirmations, etc.).
	EventSyncStarted Event = "syncstarted"

	// EventSyncDone follows EventSyncStarted.
	EventSyncDone Event = "syncdone"

	// EventHeadersSynced is fired when the headers finished syncing.
	EventHeadersSynced Event = "headersSynced"

	// EventFeeTargetsChanged is fired when the fee targets change.
	EventFeeTargetsChanged Event = "feeTargetsChanged"
)
