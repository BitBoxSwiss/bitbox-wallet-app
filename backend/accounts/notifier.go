// SPDX-License-Identifier: Apache-2.0

package accounts

// Notifier juggles transaction IDs for the purpose of notifications and unread counts.
//
//go:generate mockery -name Notifier
type Notifier interface {
	// Put adds the id to the 'unnotified' set, unless it is already in the 'seen' set.
	Put(id []byte) error
	// Delete removes the id from all sets.
	Delete(id []byte) error
	// UnnotifiedCount returns the number ids in the 'unnotified' set.
	UnnotifiedCount() (int, error)
	// MarkAllNotified moves all ids from the 'unnotified' set to the 'seen' set.
	MarkAllNotified() error
}
