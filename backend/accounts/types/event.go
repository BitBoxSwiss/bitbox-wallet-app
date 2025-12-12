// SPDX-License-Identifier: Apache-2.0

package types

// Event instances are sent to the onEvent callback of the wallet.
type Event string

const (
	// EventStatusChanged is fired when the status changes.
	EventStatusChanged Event = "status"

	// EventSyncDone happens when a sync is completed, i.e. when the wallet is updated (new
	// transactions, confirmations, etc.).
	EventSyncDone Event = "sync-done"

	// EventSyncedAddressesCount is emitted when the frontend should receives a sync progress update.
	EventSyncedAddressesCount Event = "synced-addresses-count"
)
