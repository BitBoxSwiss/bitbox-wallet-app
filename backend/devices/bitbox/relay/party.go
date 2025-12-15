// SPDX-License-Identifier: Apache-2.0

package relay

import "strconv"

// Party enumerates the endpoints of the pairing.
type Party int

const (
	// Desktop is the endpoint that is connected to the BitBox.
	Desktop Party = 0

	// Mobile is the endpoint that acts as a trusted screen.
	Mobile Party = 1
)

// Encode encodes the party as a string.
func (party Party) Encode() string {
	return strconv.Itoa(int(party))
}
