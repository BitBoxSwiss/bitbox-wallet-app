// SPDX-License-Identifier: Apache-2.0

package relay

// Server models the relay server, which relays messages between the paired parties.
type Server string

const (
	// DefaultServer stores the default server.
	DefaultServer Server = "https://digitalbitbox.com/smartverification/index.php"
)
