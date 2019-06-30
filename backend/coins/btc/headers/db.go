// Copyright 2018 Shift Devices AG
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

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
}
