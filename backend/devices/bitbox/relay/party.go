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
