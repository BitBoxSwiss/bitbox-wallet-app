// SPDX-License-Identifier: Apache-2.0

package headers

import "github.com/btcsuite/btcd/wire"

// DBInterface can be implemented by database backends to store/retrieve headers.
type DBInterface interface {
	// PutHeader stores a header at the specified height.
	PutHeader(height int, header *wire.BlockHeader) error
	// HeaderByHeight retrieves a header stored at the specified height. If no header was found, nil
	// is returned.
	HeaderByHeight(height int) (*wire.BlockHeader, error)
	// RevertTo deletes all headers after tip.
	RevertTo(tip int) error
	// Tip retrieves the current max. height.
	Tip() (int, error)
	// Flush forces the db changes to the filesystem.
	Flush() error
	// Close closes the database.
	Close() error
}
